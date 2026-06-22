// auth.js — authentication module (local accounts + Google OAuth)
// Pure Node built-ins: crypto + simple signed-cookie sessions.
// No external dependencies (passport/bcrypt avoided to keep deps minimal).

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, 'users.json');
const RESET_FILE = path.join(__dirname, 'resets.json'); // password-reset tokens

// ---------- user store ----------
function loadUsers(){
  try {
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '{"users":[]}');
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')).users || [];
  } catch (e) {
    console.warn('Could not read users.json:', e.message);
    return [];
  }
}

function saveUsers(users){
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
  } catch (e) {
    console.warn('Could not write users.json:', e.message);
  }
}

// ---------- password hashing (PBKDF2) ----------
function hashPassword(password, saltHex){
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512');
  return salt.toString('hex') + ':' + hash.toString('hex');
}

function verifyPassword(password, stored){
  if (!stored || typeof stored !== 'string') return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const hash = crypto.pbkdf2Sync(String(password), Buffer.from(saltHex, 'hex'), 100000, 64, 'sha512');
  return crypto.timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

// ---------- account operations ----------
function findUserByEmail(email){
  return loadUsers().find(u => u.email.toLowerCase() === String(email || '').toLowerCase());
}

function findUserById(id){
  return loadUsers().find(u => u.id === id);
}

function createUser({ email, name, password, provider }){
  const users = loadUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())){
    return { error: 'EMAIL_EXISTS' };
  }
  const user = {
    id: 'u_' + crypto.randomBytes(8).toString('hex'),
    email: String(email).toLowerCase().trim(),
    name: name || email.split('@')[0],
    provider: provider || 'local',
    password: password ? hashPassword(password) : null,
    avatar: null,
    createdAt: Date.now()
  };
  users.push(user);
  saveUsers(users);
  return { user };
}

function authenticateLocal(email, password){
  const user = findUserByEmail(email);
  if (!user || user.provider !== 'local' || !user.password) return null;
  return verifyPassword(password, user.password) ? user : null;
}

// ===================== PASSWORD RESET =====================
// Tokens are stored in resets.json: { token: { uid, email, exp } }
const RESET_TTL = 1000 * 60 * 30; // 30 minutes

function loadResets(){
  try {
    if (!fs.existsSync(RESET_FILE)) fs.writeFileSync(RESET_FILE, '{}');
    return JSON.parse(fs.readFileSync(RESET_FILE, 'utf8'));
  } catch (e) { return {}; }
}

function saveResets(map){
  try { fs.writeFileSync(RESET_FILE, JSON.stringify(map, null, 2)); } catch (e) {}
}

// Purge expired tokens before any read/write to keep the store tidy
function gcResets(){
  const map = loadResets();
  const now = Date.now();
  let changed = false;
  for (const k of Object.keys(map)){
    if (map[k].exp && now > map[k].exp){ delete map[k]; changed = true; }
  }
  if (changed) saveResets(map);
  return map;
}

function createResetToken(user){
  const map = gcResets();
  const token = crypto.randomBytes(32).toString('hex');
  map[token] = { uid: user.id, email: user.email, exp: Date.now() + RESET_TTL };
  saveResets(map);
  return token;
}

function consumeResetToken(token){
  if (!token) return null;
  const map = gcResets();
  const entry = map[token];
  if (!entry) return null;          // invalid / already used / expired
  delete map[token];                // one-time use
  saveResets(map);
  return entry;
}

function peekResetToken(token){
  if (!token) return null;
  const map = gcResets();
  return map[token] || null;
}

// Update a local user's password by id
function updatePassword(uid, newPassword){
  const users = loadUsers();
  const idx = users.findIndex(u => u.id === uid);
  if (idx === -1) return { error: 'NOT_FOUND' };
  if (String(newPassword).length < 6) return { error: 'WEAK' };
  users[idx].password = hashPassword(newPassword);
  saveUsers(users);
  return { ok: true };
}

// Link/update a Google user (create on first login)
function upsertGoogleUser(profile){
  const existing = findUserByEmail(profile.email);
  if (existing){
    // refresh name/avatar each login
    existing.name   = profile.name   || existing.name;
    existing.avatar = profile.avatar || existing.avatar;
    if (!existing.googleSub) existing.googleSub = profile.sub;
    saveUsers(loadUsers().map(u => u.id === existing.id ? existing : u));
    return existing;
  }
  const res = createUser({
    email: profile.email,
    name:  profile.name,
    provider: 'google'
  });
  if (res.user){
    res.user.avatar   = profile.avatar || null;
    res.user.googleSub = profile.sub || null;
    saveUsers(loadUsers().map(u => u.id === res.user.id ? u : res.user));
  }
  return res.user;
}

// ---------- simple signed-cookie session ----------
// Session = base64url(payload).hmac, stored in httpOnly cookie.
const SESSION_SECRET = process.env.SESSION_SECRET ||
  require('crypto').randomBytes(32).toString('hex');
function sign(payload){
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}

function verify(token){
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}

// ---------- Express middleware ----------
function sessionCookie(){
  const isHttps = process.env.NODE_ENV === 'production' || process.env.PORT;
  return {
    name: 'wforex_sid',
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true' || isHttps && process.env.RENDER,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      path: '/'
    }
  };
}

function makeSessionToken(user){
  return sign({
    uid: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar || null,
    provider: user.provider,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  });
}

// Middleware: attach req.user if valid session, else null
function attachUser(req){
  const c = sessionCookie();
  const token = (req.headers.cookie || '').split('; ').find(x => x.startsWith(c.name + '='));
  if (!token) { req.user = null; return null; }
  const val = token.split('=')[1];
  const payload = verify(val);
  if (!payload) { req.user = null; return null; }
  req.user = payload;
  return payload;
}

// Middleware factory: require login
function requireAuth(req, res, next){
  attachUser(req);
  if (!req.user) return res.redirect('/login');
  next();
}

module.exports = {
  loadUsers, saveUsers,
  findUserByEmail, findUserById,
  createUser, authenticateLocal, upsertGoogleUser,
  makeSessionToken, sessionCookie, attachUser, requireAuth,
  verifyPassword, hashPassword,
  createResetToken, consumeResetToken, peekResetToken, updatePassword, gcResets,
  SESSION_SECRET
};

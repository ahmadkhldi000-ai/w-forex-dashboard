// W-Forex-Dashboard server — v5.0 (Complete Production Build)
// Receives live data from the MT5 EA and serves the dashboard web UI + mobile app.
// Features: Google OAuth, local auth, SSE live stream, Telegram channel preview,
//           real gold price, SIM mode, EA data persistence, rate limiting, security headers.

'use strict';

const http      = require('http');
const https     = require('https');
const fs        = require('fs');
const path      = require('path');
const crypto    = require('crypto');
const url       = require('url');

const express   = require('express');
const cors      = require('cors');

// ─── Load .env manually (no dotenv dependency) ────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    });
}

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT            = parseInt(process.env.PORT, 10) || 3000;
const SIM_MODE        = (process.env.SIM_MODE || '').toLowerCase() === 'on';
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/auth/google/callback`;
const BOT_TOKEN       = process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || '';
const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL_USERNAME || 'wforexvip';
const TELEGRAM_CHAT   = process.env.TELEGRAM_CHAT || '';
const TELEGRAM_API     = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : '';
const AUTH_TOKEN      = process.env.AUTH_TOKEN || 'WFOREX_SECRET';
const SESSION_SECRET  = process.env.SESSION_SECRET || AUTH_TOKEN;
const DATA_FILE       = path.join(__dirname, 'data.json');
const USERS_FILE      = path.join(__dirname, 'users.json');
const PUBLIC_DIR      = path.join(__dirname, 'public');

// ─── Express Setup ────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Static files
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}

// ─── Rate Limiter (in-memory) ────────────────────────────────────────────────
const rateLimitWindows = new Map();

function rateLimit(req, res, next, opts = {}) {
  const { windowMs = 60000, max = 10 } = opts;
  const key = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  if (!rateLimitWindows.has(key)) {
    rateLimitWindows.set(key, { timestamps: [], count: 0 });
  }
  const entry = rateLimitWindows.get(key);
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
  if (entry.timestamps.length >= max) {
    return res.status(429).json({ ok: false, error: 'Too many requests. Try again later.' });
  }
  entry.timestamps.push(now);
  next();
}

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitWindows) {
    entry.timestamps = entry.timestamps.filter(t => now - t < 60000);
    if (entry.timestamps.length === 0) rateLimitWindows.delete(key);
  }
}, 300000);

// ─── JSON Database Helpers ─────────────────────────────────────────────────────
let data = {
  bot: { name: 'W Forex Hedge Scalper', symbol: '-', version: '3.00', online: false, lastUpdate: 0, uptime: 0 },
  account: { balance: 0, equity: 0, margin: 0, freeMargin: 0, marginLevel: 0, leverage: 100, currency: 'USD', profit: 0 },
  trades: [],
  candles: [],
  history: [],
  signals: [],
  performance: { totalTrades: 0, wins: 0, losses: 0, winRate: 0, profitFactor: 0, sharpeRatio: 0, maxDrawdown: 0, totalProfit: 0, totalLoss: 0 },
  positions: [],
  stats: { hedge: { trades: 0, wins: 0, profit: 0, riskMult: 1, gridMult: 1 }, spike: { trades: 0, wins: 0, profit: 0, riskMult: 1, gridMult: 1 } }
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      data = { ...data, ...parsed };
      if (!data.performance) data.performance = { totalTrades: 0, wins: 0, losses: 0, winRate: 0, profitFactor: 0, sharpeRatio: 0, maxDrawdown: 0, totalProfit: 0, totalLoss: 0 };
      if (!data.signals) data.signals = [];
      if (!data.positions) data.positions = [];
      if (!data.stats) data.stats = { hedge: { trades: 0, wins: 0, profit: 0, riskMult: 1, gridMult: 1 }, spike: { trades: 0, wins: 0, profit: 0, riskMult: 1, gridMult: 1 } };
    }
  } catch (e) {
    console.error('[DATA] Error loading data.json:', e.message);
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[DATA] Error saving data.json:', e.message);
  }
}

let usersDB = { users: [] };

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      usersDB = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      if (!Array.isArray(usersDB.users)) usersDB.users = [];
    }
  } catch (e) {
    console.error('[USERS] Error loading users.json:', e.message);
    usersDB = { users: [] };
  }
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersDB, null, 2));
  } catch (e) {
    console.error('[USERS] Error saving users.json:', e.message);
  }
}

loadData();
loadUsers();

// Auto-save every 30 seconds
setInterval(() => {
  saveData();
}, 30000);

// ─── Password Hashing (PBKDF2 — no bcrypt dependency) ────────────────────────
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, derived] = stored.split(':');
  if (!salt || !derived) return false;
  const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return check === derived;
}

// ─── Session Management ────────────────────────────────────────────────────────
function makeSessionToken(userId) {
  const payload = `${userId}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${hmac}`).toString('base64url');
}

function verifySessionToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const dotIdx = decoded.lastIndexOf('.');
    const payload = decoded.slice(0, dotIdx);
    const hmac = decoded.slice(dotIdx + 1);
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    if (hmac !== expected) return null;
    const [userId, ts] = payload.split(':');
    const age = Date.now() - parseInt(ts, 10);
    if (age > 30 * 24 * 60 * 60 * 1000) return null; // 30-day expiry
    return userId;
  } catch {
    return null;
  }
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/'
  };
}

function attachUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.session;
  if (token) {
    const userId = verifySessionToken(token);
    if (userId) {
      const user = usersDB.users.find(u => u.id === userId);
      if (user) {
        req.user = user;
        req.userId = userId;
      }
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }
  next();
}

// Cookie parser middleware (simple, no cookie-parser dep)
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie || '';
  req.cookies = {};
  cookieHeader.split(';').forEach(pair => {
    const [key, ...vals] = pair.trim().split('=');
    if (key) req.cookies[key.trim()] = vals.join('=').trim();
  });
  next();
});

// ─── SSE (Server-Sent Events) ─────────────────────────────────────────────────
const sseClients = new Set();

function broadcastSSE(event, payload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(msg);
    } catch {
      sseClients.delete(client);
    }
  }
}

function broadcastAll() {
  broadcastSSE('account', data.account);
  broadcastSSE('trades', data.trades);
  broadcastSSE('candles', data.candles.slice(-200));
  broadcastSSE('performance', data.performance);
}

// ─── Google OAuth Helpers ──────────────────────────────────────────────────────
function googleStateKey() {
  return crypto.randomBytes(16).toString('hex');
}

const googleStates = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of googleStates) {
    if (now - v.ts > 600000) googleStates.delete(k);
  }
}, 300000);

function googleAuthUrl() {
  if (!GOOGLE_CLIENT_ID) return null;
  const state = googleStateKey();
  googleStates.set(state, { ts: Date.now() });
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    access_type: 'offline',
    prompt: 'consent',
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function exchangeGoogleCode(code) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    }).toString();

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.error) return reject(new Error(result.error_description || result.error));
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function fetchGoogleUser(accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.googleapis.com',
      path: '/oauth2/v2/userinfo',
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function generateUserId() {
  return 'u_' + crypto.randomBytes(6).toString('hex');
}

// ─── Auth Endpoints ───────────────────────────────────────────────────────────

// GET /api/auth/google — redirect to Google OAuth
app.get('/api/auth/google', (req, res) => {
  const authUrl = googleAuthUrl();
  if (!authUrl) {
    return res.status(500).json({ ok: false, error: 'Google OAuth is not configured' });
  }
  res.redirect(authUrl);
});

// GET /api/auth/google/callback — handle callback
app.get('/api/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.redirect('/?error=no_code');
  if (!state || !googleStates.has(state)) return res.redirect('/?error=invalid_state');

  googleStates.delete(state);

  try {
    const tokenResult = await exchangeGoogleCode(code);
    const userInfo = await fetchGoogleUser(tokenResult.access_token);

    const email = userInfo.email;
    let user = usersDB.users.find(u => u.email === email && u.provider === 'google');
    if (!user) {
      user = {
        id: generateUserId(),
        email,
        name: userInfo.name || email.split('@')[0],
        provider: 'google',
        password: null,
        avatar: userInfo.picture || null,
        googleId: userInfo.id,
        createdAt: Date.now()
      };
      usersDB.users.push(user);
      saveUsers();
    }

    const token = makeSessionToken(user.id);
    res.cookie('session', token, sessionCookieOptions());
    res.redirect('/');
  } catch (err) {
    console.error('[GOOGLE OAuth] Error:', err.message);
    res.redirect('/?error=oauth_failed');
  }
});

// POST /api/login — email/password login
app.post('/api/login', rateLimit, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password are required' });
  }
  const user = usersDB.users.find(u => u.email === email && u.provider === 'local');
  if (!user) {
    return res.status(401).json({ ok: false, error: 'Invalid email or password' });
  }
  if (!verifyPassword(password, user.password)) {
    return res.status(401).json({ ok: false, error: 'Invalid email or password' });
  }
  const token = makeSessionToken(user.id);
  res.cookie('session', token, sessionCookieOptions());
  res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, provider: user.provider, createdAt: user.createdAt } });
});

// POST /api/register — register new user
app.post('/api/register', rateLimit, (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
  }
  if (usersDB.users.find(u => u.email === email)) {
    return res.status(409).json({ ok: false, error: 'Email already registered' });
  }
  const user = {
    id: generateUserId(),
    email,
    name: name || email.split('@')[0],
    provider: 'local',
    password: hashPassword(password),
    avatar: null,
    createdAt: Date.now()
  };
  usersDB.users.push(user);
  saveUsers();
  const token = makeSessionToken(user.id);
  res.cookie('session', token, sessionCookieOptions());
  res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar, provider: user.provider, createdAt: user.createdAt } });
});

// GET /api/me — return current user
app.get('/api/me', attachUser, (req, res) => {
  if (!req.user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  res.json({
    ok: true,
    user: { id: req.user.id, email: req.user.email, name: req.user.name, avatar: req.user.avatar, provider: req.user.provider, createdAt: req.user.createdAt }
  });
});

// POST /api/logout — clear session
app.post('/api/logout', (req, res) => {
  res.clearCookie('session', { path: '/' });
  res.json({ ok: true });
});

// ─── EA Data Endpoints (from MT5) ─────────────────────────────────────────────

// POST /api/ea/data — receive EA data and broadcast via SSE
app.post('/api/ea/data', (req, res) => {
  try {
    const d = req.body || {};
    const authHeader = (req.headers.authorization || '').replace('Bearer ', '');
    if (AUTH_TOKEN && authHeader !== AUTH_TOKEN) {
      return res.status(401).json({ ok: false, error: 'Invalid auth token' });
    }

    if (d.bot) {
      data.bot = { ...data.bot, ...d.bot, online: true, lastUpdate: Date.now() };
    }
    if (d.account) {
      data.account = { ...data.account, ...d.account };
    }
    if (Array.isArray(d.trades)) {
      data.trades = d.trades;
    }
    if (Array.isArray(d.positions)) {
      data.positions = d.positions;
    }
    if (Array.isArray(d.candles) && d.candles.length) {
      data.candles = d.candles.slice(-500);
    }
    if (Array.isArray(d.signals)) {
      data.signals = d.signals;
    }
    if (Array.isArray(d.history)) {
      data.history = d.history.slice(0, 200);
    }
    if (d.performance) {
      data.performance = { ...data.performance, ...d.performance };
    }
    if (d.stats) {
      data.stats = { ...data.stats, ...d.stats };
    }

    data.bot.online = true;
    data.bot.lastUpdate = Date.now();

    computePerformance();
    broadcastSSE('account', data.account);
    broadcastSSE('trades', data.trades);
    broadcastSSE('candles', data.candles.slice(-200));
    broadcastSSE('performance', data.performance);
    if (data.signals.length) broadcastSSE('signals', data.signals.slice(-20));

    res.json({ ok: true, ts: Date.now() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/ea/status — return EA status
app.get('/api/ea/status', (req, res) => {
  const now = Date.now();
  const elapsed = data.bot.lastUpdate ? (now - data.bot.lastUpdate) : Infinity;
  const isOnline = elapsed < 30000;
  res.json({
    ok: true,
    status: {
      connected: isOnline,
      lastUpdate: data.bot.lastUpdate,
      uptime: data.bot.uptime || 0,
      botName: data.bot.name,
      botVersion: data.bot.version,
      symbol: data.bot.symbol
    }
  });
});

// GET /api/ea/trades — return all trades
app.get('/api/ea/trades', (req, res) => {
  res.json({ ok: true, trades: data.trades });
});

// GET /api/positions — alias for frontend compatibility
app.get('/api/positions', (req, res) => {
  res.json({ ok: true, positions: data.trades || [] });
});

// GET /api/telegram — alias for /api/telegram/posts
app.get('/api/telegram', async (req, res) => {
  try {
    const tgRes = await fetch(`${TELEGRAM_API}/getUpdates?offset=-1&limit=10&allowed_updates=["message"]`);
    const json = await tgRes.json();
    const messages = (json.ok ? json.result : [])
      .filter(u => u.message && u.message.chat.id == TELEGRAM_CHAT)
      .map(u => ({
        id: u.update_id,
        date: u.message.date,
        text: u.message.text || (u.message.caption || ''),
        from: u.message.from ? (u.message.from.first_name || '') : '',
      }))
      .reverse();
    res.json({ ok: true, messages });
  } catch {
    res.json({ ok: true, messages: [] });
  }
});

// GET /api/ea/account — return account info
app.get('/api/ea/account', (req, res) => {
  res.json({ ok: true, account: data.account });
});

// GET /api/ea/history — return trade history
app.get('/api/ea/history', (req, res) => {
  res.json({ ok: true, history: data.history });
});

// GET /api/ea/performance — return performance metrics
app.get('/api/ea/performance', (req, res) => {
  computePerformance();
  res.json({ ok: true, performance: data.performance });
});

// ─── Performance Computation ───────────────────────────────────────────────────
function computePerformance() {
  const trades = data.trades || [];
  const history = data.history || [];
  const all = [...trades, ...history].filter(t => typeof t.profit === 'number');

  const totalTrades = all.length;
  const wins = all.filter(t => t.profit > 0).length;
  const losses = all.filter(t => t.profit <= 0).length;
  const totalProfit = all.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0);
  const totalLoss = Math.abs(all.filter(t => t.profit < 0).reduce((s, t) => s + t.profit, 0));

  // Profit factor
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;

  // Win rate
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  // Max drawdown from equity curve
  let peak = 0, maxDD = 0, running = 0;
  for (const t of all) {
    running += t.profit;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }

  // Sharpe ratio (simplified: mean profit / std dev * sqrt(N))
  let sharpe = 0;
  if (all.length > 1) {
    const profits = all.map(t => t.profit);
    const mean = profits.reduce((a, b) => a + b, 0) / profits.length;
    const variance = profits.reduce((s, p) => s + (p - mean) ** 2, 0) / profits.length;
    const stdDev = Math.sqrt(variance);
    sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(all.length) : 0;
  }

  data.performance = {
    totalTrades,
    wins,
    losses,
    winRate: Math.round(winRate * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    sharpeRatio: Math.round(sharpe * 100) / 100,
    maxDrawdown: Math.round(maxDD * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    totalLoss: Math.round(totalLoss * 100) / 100
  };
}

// ─── Telegram Channel Endpoints ────────────────────────────────────────────────

// GET /api/telegram/posts — latest posts from Telegram channel
app.get('/api/telegram/posts', async (req, res) => {
  if (!BOT_TOKEN) {
    return res.json({
      ok: true,
      source: 'mock',
      posts: [
        { id: 1, date: Date.now() - 3600000, text: '📈 XAUUSD BUY signal triggered at 2320.50 — TP: 2330, SL: 2315', views: 156 },
        { id: 2, date: Date.now() - 7200000, text: '✅ Trade closed +$85.20 — Gold scalper hitting targets consistently!', views: 203 },
        { id: 3, date: Date.now() - 14400000, text: '📊 Weekly performance: 87% win rate, 1.92 profit factor. Account up +$2,340 this week.', views: 178 },
        { id: 4, date: Date.now() - 21600000, text: '⚠️ Market alert: High volatility expected during NFP. Grid EA adjusting parameters.', views: 145 },
        { id: 5, date: Date.now() - 86400000, text: '🚀 New feature: Telegram signal integration is now live! Get real-time alerts.', views: 312 }
      ]
    });
  }

  try {
    const posts = await fetchTelegramPosts();
    res.json({ ok: true, source: 'telegram', posts });
  } catch (err) {
    console.error('[TELEGRAM] Error fetching posts:', err.message);
    res.json({
      ok: true,
      source: 'error_fallback',
      posts: [{ id: 0, date: Date.now(), text: 'Unable to fetch Telegram posts: ' + err.message, views: 0 }]
    });
  }
});

function fetchTelegramPosts() {
  return new Promise((resolve, reject) => {
    const safeUsername = CHANNEL_USERNAME.replace('@', '');
    const endpoint = `/bot${BOT_TOKEN}/getUpdates?allowed_updates=[%22channel_post%22]&limit=20&offset=-20`;
    const options = {
      hostname: 'api.telegram.org',
      path: endpoint,
      method: 'GET'
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (!result.ok) return reject(new Error(result.description || 'Telegram API error'));
          const posts = (result.result || [])
            .filter(u => u.channel_post && u.channel_post.chat && u.channel_post.chat.username === safeUsername)
            .map(u => {
              const cp = u.channel_post;
              return {
                id: cp.message_id,
                date: cp.date * 1000,
                text: cp.text || cp.caption || '[Media post]',
                views: cp.views || 0
              };
            })
            .reverse();
          resolve(posts);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Telegram request timeout')); });
    req.end();
  });
}

// GET /api/telegram/channel-link — return channel URL
app.get('/api/telegram/channel-link', (req, res) => {
  const username = CHANNEL_USERNAME.replace('@', '');
  res.json({ ok: true, link: `https://t.me/${username}` });
});

// ─── Live Data Endpoints ──────────────────────────────────────────────────────

// GET /api/candles — return candlestick data (XAUUSD)
app.get('/api/candles', (req, res) => {
  res.json({ ok: true, symbol: 'XAUUSD', candles: data.candles.slice(-500) });
});

// GET /api/gold-price — current gold price
app.get('/api/gold-price', async (req, res) => {
  try {
    const price = await fetchGoldPrice();
    res.json({ ok: true, symbol: 'XAUUSD', price, source: price._source || 'cache' });
  } catch (err) {
    // Return last known price from candles
    const lastCandle = data.candles[data.candles.length - 1];
    if (lastCandle) {
      res.json({ ok: true, symbol: 'XAUUSD', price: { bid: lastCandle.close, ask: lastCandle.close + 0.3, mid: lastCandle.close }, source: 'candle_fallback' });
    } else {
      res.json({ ok: true, symbol: 'XAUUSD', price: { bid: 0, ask: 0, mid: 0 }, source: 'unavailable' });
    }
  }
});

let cachedGoldPrice = null;
let cachedGoldPriceTs = 0;

function fetchGoldPrice() {
  return new Promise((resolve, reject) => {
    // Use cache if less than 10 seconds old
    if (cachedGoldPrice && Date.now() - cachedGoldPriceTs < 10000) {
      resolve({ ...cachedGoldPrice, _source: 'cache' });
      return;
    }
    const endpoint = '/v8/finance/chart/GC=F?range=1d&interval=5m&includePrePost=false';
    const options = {
      hostname: 'query1.finance.yahoo.com',
      path: endpoint,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WForexBot/1.0)'
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const raw = JSON.parse(body);
          const meta = raw.chart && raw.chart.result && raw.chart.result[0] && raw.chart.result[0].meta;
          if (meta && meta.regularMarketPrice) {
            const mid = meta.regularMarketPrice;
            const spread = 0.3;
            cachedGoldPrice = { bid: mid - spread / 2, ask: mid + spread / 2, mid };
            cachedGoldPriceTs = Date.now();
            resolve({ ...cachedGoldPrice, _source: 'yahoo' });
          } else {
            reject(new Error('No price data in Yahoo response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Yahoo Finance timeout')); });
    req.end();
  });
}

// ─── Full State Endpoint ───────────────────────────────────────────────────────
app.get('/api/state', (req, res) => {
  computePerformance();
  res.json({
    ok: true,
    bot: { name: data.bot.name, symbol: data.bot.symbol, version: data.bot.version, online: data.bot.online, lastUpdate: data.bot.lastUpdate },
    account: data.account,
    trades: data.trades,
    candles: data.candles.slice(-200),
    history: data.history,
    signals: data.signals.slice(-20),
    performance: data.performance,
    positions: data.positions,
    stats: data.stats,
    simMode: SIM_MODE
  });
});

// ─── SSE Stream ────────────────────────────────────────────────────────────────
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial state
  res.write(`event: init\ndata: ${JSON.stringify({
    bot: data.bot,
    account: data.account,
    trades: data.trades,
    candles: data.candles.slice(-200),
    performance: data.performance
  })}\n\n`);

  const client = res;
  sseClients.add(client);

  req.on('close', () => {
    sseClients.delete(client);
  });

  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    try { client.write(':heartbeat\n\n'); }
    catch { clearInterval(heartbeat); sseClients.delete(client); }
  }, 30000);
});

// ─── SIM_MODE: Simulated Gold Price + Demo Trades ──────────────────────────────
if (SIM_MODE) {
  let simPrice = 2325.50;
  let simCandleBase = Date.now() - 600000;
  let simTrades = [];
  let tradeIdCounter = 1000;
  let simBalance = 10000;
  let simEquity = 10000;
  let simDayPL = 0;

  console.log('[SIM] Generating simulated market data every 2s');

  async function refreshRealGoldHistory() {
    try {
      const price = await fetchGoldPrice();
      if (price && price.mid) {
        simPrice = price.mid;
        data.account.balance = simBalance;
        data.account.equity = simEquity;
      }
    } catch {
      // continue with simulated price
    }
  }

  function simStep() {
    // Random walk for gold price
    const change = (Math.random() - 0.498) * 1.2; // slight upward bias
    simPrice = Math.max(2200, Math.min(2500, simPrice + change));

    // Generate candle data
    const now = Date.now();
    const candle = {
      time: now,
      open: simPrice - change * (Math.random() * 0.5),
      high: simPrice + Math.random() * 2,
      low: simPrice - Math.random() * 2,
      close: simPrice,
      volume: Math.floor(Math.random() * 5000 + 1000)
    };
    candle.open = Math.round(candle.open * 100) / 100;
    candle.high = Math.round(candle.high * 100) / 100;
    candle.low = Math.round(candle.low * 100) / 100;
    candle.close = Math.round(candle.close * 100) / 100;

    data.candles.push(candle);
    if (data.candles.length > 500) data.candles = data.candles.slice(-500);

    // Random demo trade generation
    if (Math.random() < 0.08) {
      const isBuy = Math.random() > 0.45;
      const type = isBuy ? 'BUY' : 'SELL';
      const lotSize = (Math.random() * 0.5 + 0.01).toFixed(2);
      const entry = simPrice;
      const tp = isBuy ? entry + (Math.random() * 10 + 3) : entry - (Math.random() * 10 + 3);
      const sl = isBuy ? entry - (Math.random() * 5 + 2) : entry + (Math.random() * 5 + 2);

      // Simulate some trades closing
      if (simTrades.length > 0 && Math.random() < 0.4) {
        const closingIdx = Math.floor(Math.random() * simTrades.length);
        const closed = simTrades.splice(closingIdx, 1)[0];
        const profit = closed.type === 'BUY'
          ? (simPrice - closed.entry) * closed.lots * 100
          : (closed.entry - simPrice) * closed.lots * 100;
        const profitRounded = Math.round(profit * 100) / 100;

        data.history.unshift({
          id: closed.id,
          symbol: 'XAUUSD',
          type: closed.type,
          lots: closed.lots,
          entry: closed.entry,
          exit: simPrice,
          tp: closed.tp,
          sl: closed.sl,
          profit: profitRounded,
          closeTime: now,
          duration: now - closed.openTime
        });
        if (data.history.length > 200) data.history = data.history.slice(0, 200);

        simBalance += profitRounded;
        simDayPL += profitRounded;
        simEquity = simBalance;
      }

      const newTrade = {
        id: ++tradeIdCounter,
        symbol: 'XAUUSD',
        type,
        lots: parseFloat(lotSize),
        entry: Math.round(entry * 100) / 100,
        tp: Math.round(tp * 100) / 100,
        sl: Math.round(sl * 100) / 100,
        profit: 0,
        openTime: now
      };
      simTrades.push(newTrade);
    }

    // Update open trade P&L
    for (const t of simTrades) {
      t.profit = t.type === 'BUY'
        ? Math.round((simPrice - t.entry) * t.lots * 100 * 100) / 100
        : Math.round((t.entry - simPrice) * t.lots * 100 * 100) / 100;
    }

    const openPL = simTrades.reduce((s, t) => s + t.profit, 0);
    simEquity = simBalance + openPL;

    // Update state
    data.account = {
      balance: Math.round(simBalance * 100) / 100,
      equity: Math.round(simEquity * 100) / 100,
      margin: Math.round(simTrades.length * 200 * 100) / 100,
      freeMargin: Math.round((simEquity - simTrades.length * 200) * 100) / 100,
      marginLevel: simTrades.length > 0 ? Math.round((simEquity / (simTrades.length * 200)) * 10000) / 100 : 0,
      leverage: 100,
      currency: 'USD',
      profit: Math.round(openPL * 100) / 100
    };

    data.trades = simTrades.map(t => ({ ...t }));
    data.bot = {
      name: 'W Forex Hedge Scalper',
      symbol: 'XAUUSD',
      version: '3.00',
      online: true,
      lastUpdate: now,
      uptime: Math.floor((now - (data.bot.startTime || now)) / 1000)
    };
    if (!data.bot.startTime) data.bot.startTime = now;

    // Random signals
    if (Math.random() < 0.03) {
      const signalTypes = ['BUY', 'SELL', 'CLOSE_ALL', 'GRID_START', 'SPIKE_ENTRY'];
      const type = signalTypes[Math.floor(Math.random() * signalTypes.length)];
      data.signals.push({ type, time: now, price: simPrice, confidence: Math.round(Math.random() * 40 + 60) });
      if (data.signals.length > 50) data.signals = data.signals.slice(-50);
    }

    computePerformance();
    broadcastSSE('gold', { price: simPrice, _source: 'sim' });
    broadcastSSE('account', data.account);
    broadcastSSE('trades', data.trades);
    broadcastSSE('candles', data.candles.slice(-200));
    broadcastSSE('performance', data.performance);
  }

  // Initialize sim
  data.bot.startTime = Date.now();
  refreshRealGoldHistory().then(() => {
    setInterval(simStep, 2000);
  });
}

// ─── Health / Fallback ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), memory: process.memoryUsage(), simMode: SIM_MODE, clients: sseClients.size });
});

app.get('/', (req, res) => {
  if (fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  } else {
    res.type('text').send(`
      <!DOCTYPE html>
      <html>
      <head><title>W Forex Dashboard</title>
      <style>
        body{font-family:system-ui;margin:2rem;color:#e0e0e0;background:#111}
        h1{color:#ffd700} a{color:#4af} code{background:#222;padding:2px 6px;border-radius:4px}
      </style></head>
      <body>
      <h1>🪙 W Forex Hedge Scalper</h1>
      <p>Server is running. API endpoints:</p>
      <ul>
        <li><code>/api/state</code> — Full dashboard state</li>
        <li><code>/api/stream</code> — SSE live stream</li>
        <li><code>/api/gold-price</code> — Current gold price</li>
        <li><code>/api/candles</code> — Candlestick data</li>
        <li><code>/api/telegram/posts</code> — Telegram channel posts</li>
        <li><code>/api/health</code> — Server health</li>
      </ul>
      <p>SIM mode: ${SIM_MODE ? '<strong>ON</strong>' : 'OFF'}</p>
      </body></html>
    `);
  }
});

// Serve login page at /login
app.get('/login', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

// Serve mobile-friendly page at /m
app.get('/m', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'm.html'));
});

// Combined stats endpoint (convenience)
app.get('/api/stats', (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    simMode: SIM_MODE,
    clients: sseClients.size,
    positions: currentPositions.length,
    trades: allTrades.length,
  });
});

// 404 handler
app.use((req, res) => {
  if (!req.path.startsWith('/api/')) {
    const fallback = path.join(PUBLIC_DIR, req.path);
    if (fs.existsSync(fallback) && fs.statSync(fallback).isFile()) {
      return res.sendFile(fallback);
    }
  }
  res.status(404).json({ ok: false, error: 'Not found' });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('========================================');
  console.log('  W Forex Hedge Scalper — Server v5.0');
  console.log('========================================');
  console.log(`  Port        : ${PORT}`);
  console.log(`  Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Google OAuth: ${GOOGLE_CLIENT_ID ? 'configured' : 'not configured'}`);
  console.log(`  Telegram    : ${BOT_TOKEN ? 'configured' : 'mock data'}`);
  console.log(`  SIM mode    : ${SIM_MODE ? 'ON (simulated gold + demo trades)' : 'OFF (waiting for EA)'}`);
  console.log(`  SSE clients : ${sseClients.size}`);
  console.log('========================================');
});

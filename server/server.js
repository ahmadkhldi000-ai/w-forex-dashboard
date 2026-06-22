// W-Forex-Dashboard server
// Receives live data from the MT5 EA and serves the dashboard web UI
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

// Load .env (portable loader — no dotenv dependency)
(function loadEnv(){
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)){
      fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
        if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
      });
    }
  } catch (e) { /* ignore */ }
})();

const authLib = require('./auth');
const google  = require('./google');

const app  = express();
const PORT = process.env.PORT || 3000;

// Authorization token — MUST match the one inside the EA (DashToken input)
// Read from environment first (for cloud deployment), fallback to hardcoded default
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.DASHBOARD_TOKEN || 'WFOREX_SECRET_2026';

// ---------- in-memory + on-disk state ----------
const DATA_FILE = path.join(__dirname, 'data.json');

// Default structure
let state = {
  bot: {
    name: 'W Forex Hedge Scalper',
    symbol: '-',
    version: '3.00',
    online: false,
    lastUpdate: 0,
    uptime: 0
  },
  // OHLC candle buffer (newest pushed by the EA, capped at 500)
  candles: [],
  account: {
    balance: 0,
    equity: 0,
    currency: 'USD',
    profit: 0,
    margin: 0,
    freeMargin: 0
  },
  stats: {
    dayTrades: 0,
    dayWins: 0,
    dayProfit: 0,
    bestTrade: 0,
    worstTrade: 0,
    profitFactor: 0,
    winRate: 0,
    consecutiveLosses: 0,
    totalTrades: 0
  },
  regime: 'TREND',
  strategy: '-',
  confidence: 0,
  positions: [],
  learning: {
    trend: { trades: 0, wins: 0, profit: 0, riskMult: 1, gridMult: 1 },
    range: { trades: 0, wins: 0, profit: 0, riskMult: 1, gridMult: 1 },
    spike: { trades: 0, wins: 0, profit: 0, riskMult: 1, gridMult: 1 }
  },
  history: []
};

// Load persisted state if exists
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    state = { ...state, ...JSON.parse(raw) };
    console.log('✓ Loaded saved state from data.json');
  } else {
    // First run on a fresh cloud instance — seed demo candles so the chart isn't empty
    console.log('ℹ️ No data.json — seeding demo candles');
    const now = Math.floor(Date.now() / 1000);
    let price = 2340;
    for (let i = 120; i > 0; i--) {
      const open = price;
      const close = open + (Math.random() - 0.5) * 3;
      state.candles.push({
        time: now - i * 60,
        open: +open.toFixed(2),
        high: +Math.max(open, close, open + Math.random()).toFixed(2),
        low:  +Math.min(open, close, open - Math.random()).toFixed(2),
        close: +close.toFixed(2),
        volume: Math.round(100 + Math.random() * 400)
      });
      price = close;
    }
  }
} catch (e) {
  console.warn('Could not load data.json:', e.message);
}

function persist() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.warn('Persist failed:', e.message);
  }
}

// ---------- middleware ----------
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Minimal cookie parser (no external dependency)
app.use((req, res, next) => {
  req.cookies = {};
  const h = req.headers.cookie || '';
  h.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) req.cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  next();
});

// Attach the logged-in user to every request (req.user or null)
app.use((req, res, next) => { authLib.attachUser(req); next(); });

// Serve static assets (css, js) publicly, but NOT the dashboard HTML
// Disable caching for HTML/JS during development so fixes always load
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html') || req.path.endsWith('.js')){
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  setHeaders: (res, filePath) => {
    // Never cache HTML entry points — ensures auth checks always run fresh
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  }
}));

// ---------- auth helper (EA token) ----------
function auth(req, res, next) {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// ===================== USER AUTHENTICATION =====================
const cookie = authLib.sessionCookie();

function setSession(res, user){
  res.cookie(cookie.name, authLib.makeSessionToken(user), cookie.options);
}
function clearSession(res){
  res.clearCookie(cookie.name, cookie.options);
}

// ---------- GET /login ----------
app.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ---------- POST /api/signup (local account) ----------
app.post('/api/signup', (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  if (String(password).length < 6)  return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address.' });

  const result = authLib.createUser({ email, name, password, provider: 'local' });
  if (result.error === 'EMAIL_EXISTS') return res.status(409).json({ error: 'An account with this email already exists.' });
  setSession(res, result.user);
  res.json({ ok: true, user: { email: result.user.email, name: result.user.name } });
});

// ---------- POST /api/login (local account) ----------
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = authLib.authenticateLocal(email, password);
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  setSession(res, user);
  res.json({ ok: true, user: { email: user.email, name: user.name } });
});

// ---------- GET /auth/google — start OAuth ----------
app.get('/auth/google', (req, res) => {
  if (!google.isConfigured()){
    return res.status(503).send('Google Sign-In is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env');
  }
  const state = google.newState();
  // stash state in a short-lived cookie to verify on callback
  res.cookie('wforex_oauth_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 5 });
  res.redirect(google.buildAuthUrl(state));
});

// ---------- GET /auth/google/callback ----------
app.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query;
  const storedState = req.cookies['wforex_oauth_state'];

  if (!code) return res.redirect('/login?error=google_cancelled');
  if (!state || state !== storedState) return res.redirect('/login?error=state_mismatch');

  try {
    const profile = await google.exchangeCode(code);
    const user = authLib.upsertGoogleUser(profile);
    if (!user) return res.redirect('/login?error=signup_failed');
    setSession(res, user);
    res.clearCookie('wforex_oauth_state');
    res.redirect('/');
  } catch (e) {
    console.warn('Google OAuth error:', e.message);
    res.redirect('/login?error=oauth_failed');
  }
});

// ---------- GET /api/me ----------
app.get('/api/me', (req, res) => {
  res.json({
    user: req.user ? { email: req.user.email, name: req.user.name, avatar: req.user.avatar, provider: req.user.provider } : null,
    googleEnabled: google.isConfigured()
  });
});

// ---------- POST /api/logout ----------
app.post('/api/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

// ===================== PASSWORD RESET =====================
// NOTE: Email sending requires SMTP credentials in .env (optional).
// Without SMTP, the reset link is printed to the server console so you can
// complete the flow during development.

function sendResetEmail(toEmail, resetLink){
  const smtp = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
  if (!smtp){
    // Dev fallback: log the link instead of sending email
    console.log('──────────────────────────────────────────');
    console.log('  PASSWORD RESET for ' + toEmail);
    console.log('  Link: ' + resetLink);
    console.log('──────────────────────────────────────────');
    return Promise.resolve({ sent: false, logged: true });
  }
  // Real SMTP send would go here (kept dependency-free; integrate nodemailer if needed)
  // For now, just log — replace with your email provider's HTTP API.
  console.log('  (SMTP configured but sender not implemented — logging link)');
  console.log('  Link: ' + resetLink);
  return Promise.resolve({ sent: true });
}

// 1) Request a reset link by email
app.post('/api/password/request-reset', (req, res) => {
  const { email } = req.body || {};
  const user = authLib.findUserByEmail(email);
  // Always respond ok to avoid leaking which emails exist (timing/enumeration)
  if (user && user.provider === 'local'){
    const token = authLib.createResetToken(user);
    // Build the reset link from the request's own origin (works on localhost + cloud)
    const origin = req.headers['x-forwarded-proto'] + '://' + req.get('host');
    const link = origin + '/reset-password?token=' + token;
    sendResetEmail(user.email, link);
  }
  res.json({ ok: true, message: 'If that account exists, a reset link has been sent.' });
});

// 2) Verify a token is still valid (before showing the new-password form)
app.get('/api/password/verify-token', (req, res) => {
  const entry = authLib.peekResetToken(req.query.token);
  if (!entry) return res.status(400).json({ error: 'invalid_or_expired' });
  res.json({ ok: true, email: entry.email });
});

// 3) Set a new password using the token
app.post('/api/password/reset', (req, res) => {
  const { token, password } = req.body || {};
  const entry = authLib.consumeResetToken(token);
  if (!entry) return res.status(400).json({ error: 'invalid_or_expired' });
  const result = authLib.updatePassword(entry.uid, password);
  if (result.error === 'WEAK')    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (result.error === 'NOT_FOUND') return res.status(404).json({ error: 'Account not found.' });
  res.json({ ok: true });
});

// ---------- Reset password page ----------
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset.html'));
});

// ---------- Protect the dashboard ----------
app.get('/', authLib.requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- EA ingestion endpoint ----------
// POST /api/update  — called by the EA on every tick / bar
app.post('/api/update', auth, (req, res) => {
  const d = req.body;
  if (!d || typeof d !== 'object') return res.status(400).json({ error: 'bad payload' });

  // Merge incoming data
  if (d.bot)      Object.assign(state.bot, d.bot);
  if (d.account)  Object.assign(state.account, d.account);
  if (d.stats)    Object.assign(state.stats, d.stats);
  if (d.learning) Object.assign(state.learning, d.learning);
  if (d.regime !== undefined)   state.regime = d.regime;
  if (d.strategy !== undefined) state.strategy = d.strategy;
  if (d.confidence !== undefined) state.confidence = d.confidence;

  // Positions: replace the full list each update (source of truth = EA)
  if (Array.isArray(d.positions)) state.positions = d.positions;

  // Candles: EA pushes either a single candle {time,o,h,l,c} or an array
  if (d.candle && typeof d.candle === 'object') {
    pushCandle(d.candle);
  }
  if (Array.isArray(d.candles)) {
    d.candles.forEach(pushCandle);
  }

  // Record a closed trade into history
  if (d.closedTrade) {
    state.history.unshift({
      ...d.closedTrade,
      time: Date.now()
    });
    if (state.history.length > 200) state.history.length = 200;
  }

  state.bot.online     = true;
  state.bot.source     = 'ea';
  state.bot.lastUpdate = Date.now();

  // Throttle disk writes (every ~10s) — handled by the interval below
  res.json({ ok: true, received: Date.now() });
});

// ---------- candle helper ----------
// Accepts {time, open, high, low, close, volume?} and keeps the buffer capped.
function pushCandle(c) {
  if (!c || typeof c !== 'object') return;
  const candle = {
    time: Math.floor(Number(c.time) || (Date.now() / 1000)),
    open:  Number(c.open  ?? c.o),
    high:  Number(c.high  ?? c.h),
    low:   Number(c.low   ?? c.l),
    close: Number(c.close ?? c.c)
  };
  if (c.volume !== undefined) candle.volume = Number(c.volume ?? c.v);
  if (!candle.time || isNaN(candle.open) || isNaN(candle.high) ||
      isNaN(candle.low) || isNaN(candle.close)) return;

  // Merge into the last candle if same time (update in place) — else append
  const last = state.candles[state.candles.length - 1];
  if (last && last.time === candle.time) {
    last.high  = Math.max(last.high, candle.high);
    last.low   = Math.min(last.low, candle.low);
    last.close = candle.close;
    if (candle.volume !== undefined) last.volume = candle.volume;
  } else {
    state.candles.push(candle);
    if (state.candles.length > 500) state.candles.shift();
  }
}

// ---------- demo data generator (SIM mode) ----------
// When SIM_MODE=on, the server fabricates live-looking candles + positions
// so the dashboard animates without a connected EA. Turned off when the real
// EA starts pushing data (detected via /api/update).
const SIM_MODE = (process.env.SIM_MODE || '').toLowerCase() === 'on';
let simLastPush = 0;
let simPrice = 1.08500;            // starting EURUSD price
let simDir = 1;                    // +1 up, -1 down
const SIM_SYMBOL = process.env.SIM_SYMBOL || 'EURUSD';

function simStep() {
  if (!SIM_MODE) return;

  // If a real EA pushed recently, stay quiet (don't fight it).
  // SIM marks lastUpdate with a sentinel so it never trips its own guard.
  if (state.bot.online && state.bot.source === 'ea' &&
      Date.now() - state.bot.lastUpdate < 30000) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const barLen = 60;               // 1-minute candles
  const bucket = Math.floor(nowSec / barLen) * barLen;

  // Random-walk the price with mild momentum
  const drift = (Math.random() - 0.5) * 0.00040;
  simPrice = Math.max(0.5, simPrice + drift + simDir * 0.00005);
  if (Math.random() < 0.08) simDir *= -1;   // occasional reversal

  const last = state.candles[state.candles.length - 1];
  let candle;
  if (last && last.time === bucket) {
    candle = last;
    candle.high = Math.max(candle.high, simPrice);
    candle.low  = Math.min(candle.low,  simPrice);
    candle.close = simPrice;
    candle.volume = (candle.volume || 0) + Math.floor(Math.random() * 50);
  } else {
    candle = {
      time: bucket,
      open:  last ? last.close : simPrice,
      high:  simPrice,
      low:   simPrice,
      close: simPrice,
      volume: Math.floor(Math.random() * 100)
    };
    state.candles.push(candle);
    if (state.candles.length > 500) state.candles.shift();
  }

  // Mark the bot as online (SIM source)
  state.bot = {
    name: 'W Forex Hedge Scalper (SIM)',
    symbol: SIM_SYMBOL,
    online: true,
    source: 'sim',
    lastUpdate: Date.now(),
    uptime: (state.bot.uptime || 0) + 2
  };

  // Occasionally open/close demo positions so the "Open Positions" panel animates
  if (Math.random() < 0.25 && state.positions.length < 6) {
    const isBuy = Math.random() < 0.5;
    const entry = simPrice;
    const lot   = [0.01, 0.02, 0.05][Math.floor(Math.random()*3)];
    state.positions.push({
      ticket: 100000 + Math.floor(Math.random()*899999),
      symbol: SIM_SYMBOL,
      type: isBuy ? 'buy' : 'sell',
      lots: lot,
      open: entry,
      current: simPrice,
      sl: isBuy ? entry - 0.0015 : entry + 0.0015,
      tp: isBuy ? entry + 0.0010 : entry - 0.0010,
      profit: (isBuy ? (simPrice - entry) : (entry - simPrice)) * lot * 100000,
      tag: ['Trend','Range','Spike'][Math.floor(Math.random()*3)],
      time: Date.now()
    });
  }
  // occasionally close a profitable position → record into history
  for (let i = state.positions.length - 1; i >= 0; i--) {
    const p = state.positions[i];
    // simulate price moving toward TP/SL with mild randomness
    if (p.type === 'buy') p.current = simPrice;
    else p.current = simPrice;
    p.profit = (p.type === 'buy' ? (p.current - p.open) : (p.open - p.current)) * p.lots * 100000;
    if (p.profit > 1.8 || p.profit < -4 || Math.random() < 0.04) {
      const closed = state.positions.splice(i, 1)[0];
      state.history.unshift({
        ticket: closed.ticket,
        symbol: closed.symbol,
        type: closed.type,
        lots: closed.lots,
        profit: closed.profit,
        time: Date.now()
      });
      if (state.history.length > 200) state.history.length = 200;
    }
  }

  // Rolling account stats derived from open positions
  const openProfit = state.positions.reduce((s,p) => s + p.profit, 0);
  const baseBalance = 10000;
  state.account = {
    balance: baseBalance,
    equity: baseBalance + openProfit,
    profit: openProfit,
    margin: 50,
    freeMargin: baseBalance + openProfit - 50,
    marginLevel: ((baseBalance + openProfit) / 50) * 100,
    leverage: 500,
    login: 9999999,
    server: 'SIM-Demo',
    currency: 'USD',
    startBalance: baseBalance,
    dayStartEquity: baseBalance
  };

  const wins = state.history.filter(h => h.profit > 0).length;
  state.stats = {
    openPositions: state.positions.length,
    totalTrades: state.history.length,
    wins,
    losses: state.history.length - wins,
    winRate: state.history.length ? (wins / state.history.length) * 100 : 0,
    todayProfit: state.history.reduce((s,h)=>s+h.profit,0),
    grossProfit: state.history.filter(h=>h.profit>0).reduce((s,h)=>s+h.profit,0),
    grossLoss: Math.abs(state.history.filter(h=>h.profit<0).reduce((s,h)=>s+h.profit,0)),
    profitFactor: 0
  };
  const gp = state.stats.grossProfit, gl = state.stats.grossLoss;
  state.stats.profitFactor = gl > 0 ? gp/gl : (gp > 0 ? 99 : 0);

  simLastPush = Date.now();
}

// ---------- heartbeat (EA confirms it's alive) ----------
app.post('/api/heartbeat', auth, (req, res) => {
  state.bot.online     = true;
  state.bot.lastUpdate = Date.now();
  if (req.body && req.body.uptime) state.bot.uptime = req.body.uptime;
  res.json({ ok: true });
});

// ---------- public read endpoint ----------
app.get('/api/state', (req, res) => {
  // If no update in 60s, mark offline
  if (Date.now() - state.bot.lastUpdate > 60000) state.bot.online = false;
  res.json(state);
});

// ---------- SPA fallback ----------
// Protect ALL non-API routes behind auth so the dashboard HTML/data
// is never served to an unauthenticated browser.
app.get('*', authLib.requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- periodic persistence ----------
setInterval(persist, 10000);

// ---------- SIM data generator tick ----------
if (SIM_MODE) {
  // seed initial history so the chart isn't empty on first load
  simStep();
  setInterval(simStep, 2000);
  console.log('  → SIM_MODE: ON (fabricating demo candles/positions every 2s)');
}

app.listen(PORT, () => {
  // First-run: ensure a demo account exists for testing
  if (!authLib.findUserByEmail('demo@wforex.io')) {
    authLib.createUser({ email: 'demo@wforex.io', name: 'Demo Trader', password: 'demo123', provider: 'local' });
    console.log('✓ Seeded demo account: demo@wforex.io / demo123');
  }

  console.log('========================================');
  console.log('  W-Forex Dashboard server running');
  console.log('  → Port: ' + PORT);
  console.log('  → EA posts to: /api/update  (token: ' + AUTH_TOKEN + ')');
  console.log('  → Google Sign-In: ' + (google.isConfigured() ? 'enabled' : 'disabled (set GOOGLE_CLIENT_ID in .env)'));
  console.log('  → Users file: ' + path.join(__dirname, 'users.json'));
  console.log('  → Environment: ' + (process.env.NODE_ENV || 'development'));
  console.log('========================================');
});

// W-Forex Dashboard — frontend logic (SaaSPlus UI)
const API = '/api/state';

// Cache frequently used elements
const $ = id => document.getElementById(id);
const els = {
  navStatus: $('navStatus'), navStatusText: $('navStatusText'),
  botVersion: $('botVersion'), footerVersion: $('footerVersion'),
  heroSymbol: $('heroSymbol'), heroUptime: $('heroUptime'), heroLastUpdate: $('heroLastUpdate'),
  balance: $('balance'), equity: $('equity'), profit: $('profit'), freeMargin: $('freeMargin'),
  balanceFoot: $('balanceFoot'), equityFoot: $('equityFoot'), profitFoot: $('profitFoot'), freeMarginFoot: $('freeMarginFoot'),
  margin: $('margin'), currency: $('currency'), marginLevel: $('marginLevel'), drawPower: $('drawPower'),
  regimeTag: $('regimeTag'), regimeCurrent: $('regimeCurrent'), regimeVol: $('regimeVol'),
  posCount: $('posCount'), positionsBody: $('positionsBody'),
  histCount: $('histCount'), historyBody: $('historyBody'),
  trendTrades: $('trendTrades'), trendWins: $('trendWins'), trendProfit: $('trendProfit'),
  trendRisk: $('trendRisk'), trendGrid: $('trendGrid'),
  rangeTrades: $('rangeTrades'), rangeWins: $('rangeWins'), rangeProfit: $('rangeProfit'),
  rangeRisk: $('rangeRisk'), rangeGrid: $('rangeGrid'),
  spikeTrades: $('spikeTrades'), spikeWins: $('spikeWins'), spikeProfit: $('spikeProfit'),
  spikeRisk: $('spikeRisk'), spikeGrid: $('spikeGrid'),
  lastUpdate: $('lastUpdate')
};

// ===================== CANDLESTICK CHART =====================
let chart = null, candleSeries = null, volumeSeries = null;
let currentTf = 5; // minutes
let lastCandleTime = 0;

function initChart(){
  if (typeof LightweightCharts === 'undefined' || chart) return;
  const container = $('candleChart');
  if (!container) return;

  chart = LightweightCharts.createChart(container, {
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: '#8a8a98',
      fontFamily: "'Inter', sans-serif"
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.04)' },
      horzLines: { color: 'rgba(255,255,255,0.04)' }
    },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
    timeScale: {
      borderColor: 'rgba(255,255,255,0.08)',
      timeVisible: true, secondsVisible: false
    },
    autoSize: true
  });

  candleSeries = chart.addCandlestickSeries({
    upColor: '#22c55e', downColor: '#ef4444',
    borderUpColor: '#22c55e', borderDownColor: '#ef4444',
    wickUpColor: '#22c55e', wickDownColor: '#ef4444'
  });
  candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.28 } });

  volumeSeries = chart.addHistogramSeries({
    priceFormat: { type: 'volume' },
    priceScaleId: '', color: 'rgba(124,92,255,0.5)'
  });
  volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });

  // Crosshair legend update
  chart.subscribeCrosshairMove(param => {
    if (!param || !param.time || !param.seriesData.size) return;
    const d = param.seriesData.get(candleSeries);
    const v = param.seriesData.get(volumeSeries);
    if (!d) return;
    $('legendO').textContent = num(d.open, 2);
    $('legendH').textContent = num(d.high, 2);
    $('legendL').textContent = num(d.low, 2);
    $('legendC').textContent = num(d.close, 2);
    $('legendVol').textContent = v ? num(v.value, 0) : '—';
    paintLegend(d.open, d.close);
  });

  const ro = new ResizeObserver(() => { if (chart) chart.applyOptions({}); });
  ro.observe(container);
}

// Group raw candles into the chosen timeframe bucket
function bucketCandles(raw, tfMinutes){
  if (!raw || raw.length === 0) return [];
  const tf = tfMinutes * 60;
  const map = new Map();
  raw.forEach(c => {
    const t = Math.floor(c.time / tf) * tf;
    if (!map.has(t)) {
      map.set(t, { time: t, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume || 0 });
    } else {
      const b = map.get(t);
      b.high = Math.max(b.high, c.high);
      b.low  = Math.min(b.low, c.low);
      b.close = c.close;
      b.volume += (c.volume || 0);
    }
  });
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

function paintLegend(open, close){
  const up = close >= open;
  ['legendO','legendH','legendL','legendC'].forEach(id => {
    $(id).className = up ? 'pos' : 'neg';
  });
}

function updateChart(state){
  const raw = state.candles || [];
  const empty = $('chartEmpty');
  if (empty) empty.style.display = raw.length === 0 ? 'flex' : 'none';
  if (raw.length === 0 || !chart) return;

  const bucketed = bucketCandles(raw, currentTf);
  candleSeries.setData(bucketed.map(c => ({
    time: c.time, open: c.open, high: c.high, low: c.low, close: c.close
  })));
  volumeSeries.setData(bucketed.map(c => ({
    time: c.time, value: c.volume,
    color: c.close >= c.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'
  })));

  const last = bucketed[bucketed.length - 1];
  if (last){
    $('legendO').textContent = num(last.open, 2);
    $('legendH').textContent = num(last.high, 2);
    $('legendL').textContent = num(last.low, 2);
    $('legendC').textContent = num(last.close, 2);
    $('legendVol').textContent = num(last.volume, 0);
    paintLegend(last.open, last.close);
  }

  const newest = bucketed[bucketed.length - 1].time;
  if (newest !== lastCandleTime){
    chart.timeScale().scrollToRealTime();
    lastCandleTime = newest;
  }
}

// Timeframe switcher
document.addEventListener('click', e => {
  const btn = e.target.closest('.tf-btn');
  if (!btn) return;
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentTf = parseInt(btn.dataset.tf, 10);
  if (window.__lastState) updateChart(window.__lastState);
});

// ---------- helpers ----------
function money(v){
  const n = Number(v || 0);
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function num(v, d = 2){
  return Number(v || 0).toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
}
function fmtUptime(sec){
  sec = Number(sec || 0);
  if (sec < 60) return sec + 's';
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return m + 'm ' + s + 's';
  const h = Math.floor(m / 60), mm = m % 60;
  if (h < 24) return h + 'h ' + mm + 'm';
  const d = Math.floor(h / 24);
  return d + 'd ' + (h % 24) + 'h';
}
function fmtTime(ts){
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
}
function relTime(ts){
  if (!ts) return '—';
  const diff = Math.round((Date.now() - ts) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  return Math.floor(diff / 3600) + 'h ago';
}
function colored(n){
  const cls = n >= 0 ? 'pos' : 'neg';
  const sign = n >= 0 ? '+' : '';
  return `<span class="${cls}">${sign}${money(n)}</span>`;
}

// ---------- render ----------
function render(state){
  window.__lastState = state;
  initChart();
  updateChart(state);
  const b = state.bot || {};
  const a = state.account || {};
  const r = state.regime || {};
  const l = state.learn || {};
  const online = !!b.online;

  // Status pill
  els.navStatus.classList.toggle('online', online);
  els.navStatusText.textContent = online ? 'Online' : 'Offline';

  // Hero meta
  els.botVersion.textContent = b.version || '3.00';
  els.footerVersion.textContent = b.version || '3.00';
  els.heroSymbol.textContent = b.symbol && b.symbol !== '-' ? b.symbol : '—';
  const cs = $('chartSym');
  if (cs) cs.textContent = b.symbol && b.symbol !== '-' ? b.symbol : '—';
  els.heroUptime.textContent = fmtUptime(b.uptime);
  els.heroLastUpdate.textContent = relTime(b.lastUpdate);
  els.lastUpdate.textContent = relTime(b.lastUpdate);

  // Metrics
  const cur = a.currency || 'USD';
  els.balance.textContent = money(a.balance);
  els.equity.textContent = money(a.equity);
  els.profit.textContent = (a.profit >= 0 ? '+' : '') + money(a.profit).replace('-','');
  els.freeMargin.textContent = money(a.freeMargin);
  els.balanceFoot.textContent = cur;
  els.equityFoot.textContent = cur;
  els.freeMarginFoot.textContent = cur;
  // profit color + foot
  els.profit.style.color = a.profit >= 0 ? 'var(--green)' : 'var(--red)';
  els.profitFoot.textContent = a.profit >= 0 ? '▲ in profit' : '▼ in loss';
  els.profitFoot.style.color = a.profit >= 0 ? 'var(--green)' : 'var(--red)';

  // Account snapshot
  els.margin.textContent = money(a.margin);
  els.currency.textContent = cur;
  const lvl = a.margin > 0 ? (a.equity / a.margin) * 100 : 0;
  els.marginLevel.textContent = lvl > 0 ? num(lvl, 1) + '%' : '—';
  els.drawPower.textContent = money(a.freeMargin);

  // Regime
  const regCurrent = r.current && r.current !== '-' ? r.current : '—';
  const regVol = r.volatility && r.volatility !== '-' ? r.volatility : '—';
  els.regimeCurrent.textContent = regCurrent;
  els.regimeVol.textContent = regVol;
  els.regimeTag.textContent = regCurrent !== '—' ? regCurrent.toUpperCase() : 'IDLE';
  // color tag by regime
  els.regimeTag.style.background = ({
    trend: 'linear-gradient(135deg,#7c5cff,#a78bfa)',
    range: 'linear-gradient(135deg,#22c55e,#16a34a)',
    spike: 'linear-gradient(135deg,#f59e0b,#ef4444)'
  })[String(r.current).toLowerCase()] || 'var(--grad)';

  // Positions table
  const positions = state.positions || [];
  els.posCount.textContent = positions.length;
  if (positions.length === 0){
    els.positionsBody.innerHTML = '<tr><td colspan="7" class="empty">No open positions</td></tr>';
  } else {
    els.positionsBody.innerHTML = positions.map(p => {
      const sideCls = (p.type === 'buy' || p.side === 'buy') ? 'side-buy' : 'side-sell';
      const side = (p.type || p.side || '').toUpperCase();
      return `<tr>
        <td class="mono">${p.ticket}</td>
        <td><strong>${p.symbol}</strong></td>
        <td><span class="${sideCls}">${side}</span></td>
        <td class="mono">${num(p.volume, 2)}</td>
        <td class="mono">${num(p.openPrice, 2)}</td>
        <td class="mono">${num(p.currentPrice, 2)}</td>
        <td>${colored(p.profit)}</td>
      </tr>`;
    }).join('');
  }

  // Adaptive learning
  function fill(prefix, obj){
    obj = obj || {};
    els[prefix + 'Trades'].textContent = obj.trades || 0;
    els[prefix + 'Wins'].textContent = obj.wins || 0;
    els[prefix + 'Profit'].textContent = (obj.profit >= 0 ? '+' : '') + money(obj.profit).replace('-','');
    els[prefix + 'Profit'].style.color = obj.profit >= 0 ? 'var(--green)' : 'var(--red)';
    els[prefix + 'Risk'].textContent = num(obj.riskMult, 1);
    els[prefix + 'Grid'].textContent = num(obj.gridMult, 1);
  }
  fill('trend', l.trend);
  fill('range', l.range);
  fill('spike', l.spike);

  // Telegram-style signal feed
  detectSignals(state);

  // History
  const history = state.history || [];
  els.histCount.textContent = history.length;
  if (history.length === 0){
    els.historyBody.innerHTML = '<tr><td colspan="5" class="empty">No history yet</td></tr>';
  } else {
    els.historyBody.innerHTML = history.slice(0, 50).map(h => {
      const side = (h.type || h.side || '').toUpperCase();
      const sideCls = (h.type === 'buy' || h.side === 'buy') ? 'side-buy' : 'side-sell';
      return `<tr>
        <td class="mono">${fmtTime(h.time)}</td>
        <td><span class="${sideCls}">${side}</span></td>
        <td class="mono">${num(h.volume, 2)}</td>
        <td>${colored(h.profit)}</td>
        <td>${h.reason || '—'}</td>
      </tr>`;
    }).join('');
  }
}

// ===================== TELEGRAM FEED =====================
const tgSeen = new Set();      // ticket-based dedup for OPEN events
const tgFeed = () => $('tgFeed');
const tgMsgs = [];             // newest first

function tgTimeLabel(ts){
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
}

function tgPush(html){
  tgMsgs.unshift(html);
  if (tgMsgs.length > 100) tgMsgs.pop();
  const feed = tgFeed();
  if (!feed) return;
  feed.innerHTML = tgMsgs.join('');
}

function tgAvatar(){
  return `<div class="tg-avatar"><svg viewBox="0 0 24 24"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg></div>`;
}

function tgRow(inner, ts){
  return `<div class="tg-msg">${tgAvatar()}
    <div class="tg-body">
      <div class="tg-meta">
        <span class="tg-name">W Forex Bot</span>
        <span class="tg-check">✓✓</span>
        <span class="tg-time">${tgTimeLabel(ts)}</span>
      </div>
      ${inner}
    </div>
  </div>`;
}

function detectSignals(state){
  const now = Date.now();
  const positions = state.positions || [];

  // OPEN events — detect new tickets
  positions.forEach(p => {
    const key = 'open:' + p.ticket;
    if (tgSeen.has(key)) return;
    tgSeen.add(key);
    const side = (p.type || p.side || '').toLowerCase();
    const cls = side === 'buy' ? 'buy' : 'sell';
    const arrow = side === 'buy' ? '🟢 BUY' : '🔴 SELL';
    const inner = `
      <div class="tg-content">
        <b>${p.symbol || '—'}</b> · ${arrow}
        <div style="margin-top:8px">
          <span class="tg-action ${cls}">▸ OPENED</span>
        </div>
        <div style="margin-top:8px;font-size:13px;color:var(--muted)">
          Volume: <b class="mono">${num(p.volume,2)}</b> · Entry: <b class="mono">${num(p.openPrice,2)}</b>
        </div>
      </div>`;
    tgPush(tgRow(inner, p.openTime || now));
  });

  // CLOSED events — from history that we haven't seen yet
  const history = state.history || [];
  history.forEach(h => {
    const key = 'close:' + (h.ticket || (h.time + ':' + h.symbol));
    if (tgSeen.has(key)) return;
    tgSeen.add(key);
    const side = (h.type || h.side || '').toLowerCase();
    const cls = side === 'buy' ? 'buy' : 'sell';
    const profit = Number(h.profit || 0);
    const amtCls = profit >= 0 ? 'pos' : 'neg';
    const sign = profit >= 0 ? '+' : '';
    const inner = `
      <div class="tg-content">
        <b>${h.symbol || '—'}</b> · position #${h.ticket || '—'} closed
        <div style="margin-top:8px">
          <span class="tg-action close">▸ CLOSED</span>
        </div>
        <div style="margin-top:8px;font-size:13px;color:var(--muted)">
          P/L: <span class="tg-amount ${amtCls}">${sign}${money(profit).replace('-','')}</span>
          ${h.reason ? ' · ' + h.reason : ''}
        </div>
      </div>`;
    tgPush(tgRow(inner, h.time || now));
  });

  // Show/hide empty hint
  const feed = tgFeed();
  if (feed && tgMsgs.length === 0){
    feed.innerHTML = '<div class="tg-empty">No signals yet — the bot will post here when it trades.</div>';
  }
}

// ---------- polling ----------
async function fetchState(){
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    render(data);
  } catch (e) {
    console.warn('fetch failed:', e.message);
  }
}

fetchState();
setInterval(fetchState, 2000);

// ---------- On load: jump to the bot view if requested via URL hash ----------
// e.g. /#chartSection — used by the "Back to bot view" links on login/reset pages
(function handleInitialHash(){
  const hash = (location.hash || '').replace('#', '');
  if (!hash) return;
  // Give the chart + DOM a tick to render before scrolling
  setTimeout(() => {
    const target = document.getElementById(hash);
    if (target){
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      target.classList.add('spotlight');
      setTimeout(() => target.classList.remove('spotlight'), 1200);
    }
  }, 300);
})();

// ===================== USER MENU / AUTH =====================
(function(){
  const userBtn = $('userBtn'), userDropdown = $('userDropdown');
  const userName = $('userName'), userAvatar = $('userAvatar');
  const ddEmail = $('ddEmail'), ddProvider = $('ddProvider');
  const logoutBtn = $('logoutBtn');

  // Load current user
  fetch('/api/me', { credentials: 'same-origin' })
    .then(r => r.json())
    .then(d => {
      if (!d.user) { window.location.href = '/login'; return; }
      userName.textContent = d.user.name || d.user.email.split('@')[0];
      if (d.user.avatar){
        userAvatar.style.backgroundImage = 'url(' + d.user.avatar + ')';
        userAvatar.textContent = '';
      } else {
        userAvatar.textContent = (d.user.name || d.user.email || '?')[0].toUpperCase();
      }
      ddEmail.textContent = d.user.email;
      ddProvider.textContent = d.user.provider === 'google' ? 'Google Account' : 'Local Account';
    })
    .catch(() => {});

  // Toggle dropdown
  userBtn.addEventListener('click', e => {
    e.stopPropagation();
    userDropdown.hidden = !userDropdown.hidden;
  });
  document.addEventListener('click', () => { userDropdown.hidden = true; });
  userDropdown.addEventListener('click', e => e.stopPropagation());

  // ---------- "Back to home" → jump to the bot live view (chart + positions) ----------
  function goHome(e){
    if (e) { e.preventDefault(); userDropdown.hidden = true; }
    // شاشة عرض البوت = قسم الشارت الحي
    const target = document.getElementById('chartSection') || document.getElementById('overview');
    if (target){
      // انتقال فوري (instant) إلى شاشة البوت
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
      // إبراز بصري قصير للقسم لإعلام المستخدم
      target.classList.add('spotlight');
      setTimeout(() => target.classList.remove('spotlight'), 1200);
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }
  $('homeBtn').addEventListener('click', goHome);
  $('navHomeBtn').addEventListener('click', goHome);
  $('brandHome').addEventListener('click', goHome);

  // Logout
  logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    logoutBtn.textContent = 'Signing out…';
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (e) {}
    window.location.href = '/login';
  });
})();

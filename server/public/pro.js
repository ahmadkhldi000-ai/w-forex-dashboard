/* ============================================================
   W Forex · Professional Dashboard JavaScript (pro.js)
   - SSE live stream from server (with polling fallback)
   - Candlestick chart with W watermark + trade markers (entries/SL/TP)
   - Account metrics, positions table, history table
   - Telegram popup modal + channel link
   ============================================================ */

/* ---------- State ---------- */
const TG_CHANNEL_FALLBACK = 'https://t.me/+iXalBkHABfBkYWQ0';
let tgChannelLink = TG_CHANNEL_FALLBACK;
let chart = null;
let candleSeries = null;
let volumeSeries = null;
let slPriceLines = [];           // active SL/TP price lines on the chart
let lastCandles = [];            // most recent candle batch
let lastTrades = [];             // open positions
let simMode = false;

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const fmtUSD = (v) => (v == null || isNaN(v)) ? '—' :
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtNum = (v, d = 2) => (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v) => (v == null || isNaN(v)) ? '—' : (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%';
const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts * 1000 : ts);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const pnlClass = (v) => (v > 0 ? 'pos' : (v < 0 ? 'neg' : ''));

/* ---------- Chart ---------- */
function initChart() {
  const container = $('mt5-chart');
  if (!container || typeof LightweightCharts === 'undefined') return;

  chart = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight || 520,
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: '#94a3b8',
      fontFamily: "'Inter', sans-serif",
      attributionLogo: false,
    },
    grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: 'rgba(255,210,74,0.4)', labelBackgroundColor: '#f5b800' },
      horzLine: { color: 'rgba(255,210,74,0.4)', labelBackgroundColor: '#f5b800' },
    },
    rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
    timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    handleScroll: { mouseWheel: true, horzTouchDrag: true, vertTouchDrag: true },
  });

  candleSeries = chart.addCandlestickSeries({
    upColor: '#22c55e', downColor: '#ef4444', borderVisible: false,
    wickUpColor: '#22c55e', wickDownColor: '#ef4444',
    priceLineColor: 'rgba(255,210,74,0.5)',
  });

  volumeSeries = chart.addHistogramSeries({
    color: 'rgba(59,130,246,0.4)', priceFormat: { type: 'volume' },
    priceScaleId: '', scaleMargins: { top: 0.85, bottom: 0 },
  });

  const ro = new ResizeObserver(() => {
    if (container.clientWidth > 0) chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
  });
  ro.observe(container);
}

/* Map server candle {time,open,high,low,close,volume} -> chart data */
function applyCandles(candles) {
  if (!candleSeries || !Array.isArray(candles) || candles.length === 0) return;
  lastCandles = candles;
  const cs = candles.map(c => ({
    time: typeof c.time === 'number' && c.time > 1e12 ? Math.floor(c.time / 1000) : c.time,
    open: +c.open, high: +c.high, low: +c.low, close: +c.close,
  })).filter(c => c.time && !isNaN(c.open));
  // de-dup + sort ascending by time
  const uniq = {}; cs.forEach(c => { uniq[c.time] = c; });
  const sorted = Object.values(uniq).sort((a, b) => a.time - b.time);
  candleSeries.setData(sorted);
  const vs = sorted.map(c => ({ time: c.time, value: +(c.volume || 0), color: c.close >= c.open ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)' }));
  if (volumeSeries) volumeSeries.setData(vs);
  const last = sorted[sorted.length - 1];
  if (last) updateHeroPrice(last.close);
  chart.timeScale().fitContent();
}

/* ---------- Trade markers + SL/TP lines on chart ---------- */
function renderTradeMarkers(trades) {
  if (!candleSeries) return;
  // Remove old price lines
  slPriceLines.forEach(line => candleSeries.removePriceLine(line));
  slPriceLines = [];

  if (!Array.isArray(trades) || trades.length === 0) return;

  // Markers (entry arrows) — must be sorted ascending by time
  const markers = trades
    .filter(t => t.openTime || t.time)
    .map(t => {
      const raw = t.openTime || t.time;
      let time = typeof raw === 'number' && raw > 1e12 ? Math.floor(raw / 1000) : raw;
      const isBuy = String(t.type).toUpperCase().indexOf('BUY') >= 0;
      return {
        time,
        position: isBuy ? 'belowBar' : 'aboveBar',
        color: isBuy ? '#22c55e' : '#ef4444',
        shape: isBuy ? 'arrowUp' : 'arrowDown',
        text: (isBuy ? 'BUY ' : 'SELL ') + (t.lots || t.volume || '') + (t.profit != null ? '  ' + fmtNum(t.profit) + '$' : ''),
      };
    })
    .filter(m => m.time && !isNaN(m.time))
    .sort((a, b) => a.time - b.time);

  try { candleSeries.setMarkers(markers); } catch (e) { /* version differences */ }

  // Draw SL/TP price lines for open positions
  trades.forEach(t => {
    if (t.sl != null && !isNaN(+t.sl)) {
      try {
        slPriceLines.push(candleSeries.createPriceLine({
          price: +t.sl, color: 'rgba(239,68,68,0.7)', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: 'SL',
        }));
      } catch (e) {}
    }
    if (t.tp != null && !isNaN(+t.tp) && +t.tp > 0) {
      try {
        slPriceLines.push(candleSeries.createPriceLine({
          price: +t.tp, color: 'rgba(34,197,94,0.7)', lineWidth: 1, lineStyle: 2,
          axisLabelVisible: true, title: 'TP',
        }));
      } catch (e) {}
    }
    // entry price line
    if (t.entry != null && !isNaN(+t.entry)) {
      try {
        slPriceLines.push(candleSeries.createPriceLine({
          price: +t.entry, color: 'rgba(255,210,74,0.6)', lineWidth: 1, lineStyle: 0,
          axisLabelVisible: true, title: String(t.type).toUpperCase(),
        }));
      } catch (e) {}
    }
  });
}

/* ---------- UI updates ---------- */
function updateHeroPrice(price) {
  if (price == null || isNaN(price)) return;
  $('heroPrice').textContent = fmtNum(price);
}

function applyAccount(acc) {
  if (!acc) return;
  const profit = acc.profit;
  $('heroBalance').textContent = fmtUSD(acc.balance);
  $('heroEquity').textContent = fmtUSD(acc.equity);
  const hp = $('heroProfit');
  hp.textContent = (profit >= 0 ? '+' : '') + fmtUSD(profit).replace(/^-/, '');
  hp.className = 'stat-value ' + (profit > 0 ? 'pos' : profit < 0 ? 'neg' : '');

  $('mBalance').textContent = fmtUSD(acc.balance);
  $('mEquity').textContent = fmtUSD(acc.equity);
  const mp = $('mProfit'); mp.textContent = fmtUSD(profit); mp.className = 'metric-value ' + pnlClass(profit);
  $('mMargin').textContent = fmtUSD(acc.margin);
  $('mFree').textContent = fmtUSD(acc.freeMargin);
  $('mLevel').textContent = acc.marginLevel != null ? fmtNum(acc.marginLevel, 1) + '%' : '—';
}

function applyPerformance(perf, trades) {
  if (perf) {
    $('pWin').textContent = perf.winRate != null ? perf.winRate.toFixed(1) + '%' : '—';
    $('pTotal').textContent = perf.totalTrades != null ? perf.totalTrades : '—';
    $('pPF').textContent = perf.profitFactor != null ? fmtNum(perf.profitFactor) : '—';
    const net = (perf.totalProfit || 0) + (perf.totalLoss || 0);
    const pn = $('pNet'); pn.textContent = fmtUSD(net); pn.className = 'metric-value ' + pnlClass(net);
  }
}

function applyPositions(trades) {
  lastTrades = trades || [];
  const body = $('positionsBody');
  $('posCount').textContent = '(' + lastTrades.length + ')';
  $('heroOpen').textContent = lastTrades.length;

  if (!lastTrades.length) {
    body.innerHTML = '<tr class="empty-row"><td colspan="9">No open positions right now.</td></tr>';
    renderTradeMarkers([]);
    return;
  }
  const cur = lastCandles.length ? lastCandles[lastCandles.length - 1].close : null;
  body.innerHTML = lastTrades.map((t, i) => {
    const isBuy = String(t.type).toUpperCase().indexOf('BUY') >= 0;
    const current = t.currentPrice != null ? t.currentPrice : cur;
    const profit = t.profit != null ? t.profit : 0;
    return `<tr>
      <td>${i + 1}</td>
      <td>${t.symbol || 'XAUUSD'}</td>
      <td><span class="tag ${isBuy ? 'tag-buy' : 'tag-sell'}">${String(t.type).toUpperCase()}</span></td>
      <td>${fmtNum(t.lots || t.volume || 0)}</td>
      <td>${fmtNum(t.entry)}</td>
      <td>${current != null ? fmtNum(current) : '—'}</td>
      <td>${t.sl != null ? fmtNum(t.sl) : '—'}</td>
      <td class="${pnlClass(profit)}">${fmtUSD(profit)}</td>
      <td>${fmtTime(t.openTime)}</td>
    </tr>`;
  }).join('');
  renderTradeMarkers(lastTrades);
}

function applyHistory(history) {
  const body = $('historyBody');
  if (!Array.isArray(history) || !history.length) {
    body.innerHTML = '<tr class="empty-row"><td colspan="8">No closed trades yet.</td></tr>';
    return;
  }
  body.innerHTML = history.slice(0, 50).map((h, i) => {
    const isBuy = String(h.type || h.side).toUpperCase().indexOf('BUY') >= 0;
    const profit = h.profit != null ? h.profit : 0;
    return `<tr>
      <td>${i + 1}</td>
      <td>${h.symbol || 'XAUUSD'}</td>
      <td><span class="tag ${isBuy ? 'tag-buy' : 'tag-sell'}">${String(h.type || h.side).toUpperCase()}</span></td>
      <td>${fmtNum(h.lots || h.volume || 0)}</td>
      <td>${fmtNum(h.entry || h.openPrice)}</td>
      <td>${fmtNum(h.close || h.closePrice)}</td>
      <td class="${pnlClass(profit)}">${fmtUSD(profit)}</td>
      <td>${fmtTime(h.closeTime || h.time)}</td>
    </tr>`;
  }).join('');
}

function applyStatus(state) {
  const pill = $('livePill'), txt = $('liveText'), st = $('heroStatus'), src = $('chartSource');
  simMode = !!state.simMode;
  if (state.bot && state.bot.online) {
    pill.className = 'live-pill online'; txt.textContent = 'Live · EA';
    st.className = 'status status-online'; st.textContent = '● Online';
    src.textContent = 'MT5'; src.style.color = 'var(--green)';
  } else if (simMode) {
    pill.className = 'live-pill sim'; txt.textContent = 'Live · Demo';
    st.className = 'status status-sim'; st.textContent = '● Demo data';
    src.textContent = 'SIM'; src.style.color = 'var(--gold)';
  } else {
    pill.className = 'live-pill'; txt.textContent = 'Offline';
    st.className = 'status status-offline'; st.textContent = '○ Waiting for EA';
    src.textContent = '—'; src.style.color = 'var(--t-3)';
  }
  if (state.bot) {
    if (state.bot.name) $('heroBotName').textContent = state.bot.name + ' · ' + (state.bot.symbol || 'XAUUSD');
  }
  const lu = state.bot && state.bot.lastUpdate ? fmtTime(state.bot.lastUpdate) : fmtTime(Date.now());
  $('lastUpdate').textContent = lu;
}

/* ---------- State ingestion ---------- */
function applyState(state) {
  if (!state || state.ok === false) return;
  applyStatus(state);
  if (state.account) applyAccount(state.account);
  if (Array.isArray(state.candles)) applyCandles(state.candles);
  if (Array.isArray(state.trades)) applyPositions(state.trades);
  if (Array.isArray(state.history)) applyHistory(state.history);
  if (state.performance) applyPerformance(state.performance, state.trades);
}

/* ---------- Data sources (SSE + polling fallback) ---------- */
async function loadInitial() {
  try {
    const [stateRes, tgRes] = await Promise.all([
      fetch('/api/state').then(r => r.json()),
      fetch('/api/telegram/channel-link').then(r => r.json()).catch(() => ({})),
    ]);
    applyState(stateRes);
    if (tgRes.link) { tgChannelLink = tgRes.link; syncTelegramLinks(); }
  } catch (e) { console.warn('initial load failed', e); }
}

let evtSource = null;
function connectSSE() {
  if (typeof EventSource === 'undefined') { startPolling(); return; }
  try {
    evtSource = new EventSource('/api/stream');
    evtSource.addEventListener('init', (e) => { try { applyState(JSON.parse(e.data)); } catch (_) {} });
    evtSource.addEventListener('account', (e) => { try { applyAccount(JSON.parse(e.data)); } catch (_) {} });
    evtSource.addEventListener('trades', (e) => { try { applyPositions(JSON.parse(e.data)); } catch (_) {} });
    evtSource.addEventListener('candles', (e) => { try { applyCandles(JSON.parse(e.data)); } catch (_) {} });
    evtSource.addEventListener('performance', (e) => { try { applyPerformance(JSON.parse(e.data), lastTrades); } catch (_) {} });
    evtSource.addEventListener('gold', (e) => { try { const d = JSON.parse(e.data); if (d.price != null) updateHeroPrice(d.price); } catch (_) {} });
    evtSource.onerror = () => {
      try { evtSource.close(); } catch (_) {}
      evtSource = null;
      setTimeout(connectSSE, 4000); // reconnect
    };
  } catch (e) { startPolling(); }
}

let pollTimer = null;
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    try { const s = await fetch('/api/state').then(r => r.json()); applyState(s); }
    catch (e) {}
  }, 5000);
}

/* ---------- Telegram ---------- */
function syncTelegramLinks() {
  ['tgJoinBtn', 'tgModalOpen', 'footerTg'].forEach(id => {
    const el = $(id);
    if (el) { el.href = tgChannelLink; el.target = '_blank'; el.rel = 'noopener'; }
  });
  const sub = $('tgModalLink'); if (sub) sub.textContent = tgChannelLink;
}

async function loadTelegramFeed(target) {
  const el = $(target);
  if (!el) return;
  el.innerHTML = '<div class="tg-loading">Loading recent messages…</div>';
  try {
    const res = await fetch('/api/telegram/posts').then(r => r.json());
    const posts = (res.posts || res.messages || res || []).slice(0, 8);
    if (!posts.length) {
      el.innerHTML = `<div class="tg-msg">📡 Latest signals from the W Forex bot appear here once connected.<br><br><a href="${tgChannelLink}" target="_blank" rel="noopener" style="color:var(--gold)">Open Telegram channel ↗</a></div>`;
      return;
    }
    el.innerHTML = posts.map(p => `<div class="tg-msg">${escapeHtml(p.text || p.message || '')}<span class="tg-time">${fmtTime(p.date || p.time)}</span></div>`).join('');
  } catch (e) {
    el.innerHTML = `<div class="tg-msg">📡 Open the channel to see live trade alerts.<br><br><a href="${tgChannelLink}" target="_blank" rel="noopener" style="color:var(--gold)">Open Telegram ↗</a></div>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function openTgModal() {
  $('tgModal').classList.add('open');
  $('tgModal').setAttribute('aria-hidden', 'false');
  loadTelegramFeed('tgModalFeed');
}
function closeTgModal() {
  $('tgModal').classList.remove('open');
  $('tgModal').setAttribute('aria-hidden', 'true');
}

/* ---------- Timeframe buttons (cosmetic; server controls real TF) ---------- */
function bindTimeframes() {
  document.querySelectorAll('.tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  $('year').textContent = new Date().getFullYear();

  // Mobile nav
  $('navMenu').addEventListener('click', () => $('navLinks').classList.toggle('open'));
  document.querySelectorAll('#navLinks a').forEach(a => a.addEventListener('click', () => $('navLinks').classList.remove('open')));

  // Navbar scroll shadow
  const nav = $('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Telegram triggers
  ['heroTgBtn', 'tgNavBtn', 'tgPreviewBtn', 'footerTg'].forEach(id => {
    const el = $(id); if (!el) return;
    el.addEventListener('click', (e) => {
      // preview/modal buttons open the popup; "go to telegram" buttons navigate
      if (id === 'tgPreviewBtn') { e.preventDefault(); openTgModal(); }
      else if (id === 'heroTgBtn' || id === 'tgNavBtn') { e.preventDefault(); openTgModal(); }
      // footerTg & tgJoinBtn are real anchors (href set by syncTelegramLinks)
    });
  });
  const mc = $('tgModalClose'); if (mc) mc.addEventListener('click', closeTgModal);
  $('tgModal').addEventListener('click', (e) => { if (e.target.id === 'tgModal') closeTgModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTgModal(); });

  bindTimeframes();
  syncTelegramLinks();

  // Init chart + load data
  initChart();
  loadInitial().then(() => { loadTelegramFeed('tgFeedPreview'); });
  connectSSE();
});

// Simulates the W Forex Bot EA pushing live data to the dashboard.
import https from 'https';
import http from 'http';

const ENDPOINT = 'http://localhost:3000/api/ea/data';
const TOKEN = 'WFOREX_SECRET_2026';

// Realistic XAUUSD price walk
let price = 2325.40;
let balance = 10420.00;
const candles = [];
const trades = [];
const history = [];
let id = 6000;

// seed 120 historical candles (1-min)
const now = Math.floor(Date.now() / 1000);
let p = 2310;
for (let i = 120; i > 0; i--) {
  const open = p;
  p += (Math.random() - 0.5) * 1.5;
  const close = p;
  const high = Math.max(open, close) + Math.random() * 0.8;
  const low = Math.min(open, close) - Math.random() * 0.8;
  candles.push({ time: now - i * 60, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2), volume: 800 + Math.floor(Math.random()*1200) });
}

function post(body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const u = new globalThis.URL(ENDPOINT);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': TOKEN,
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => { let b=''; res.on('data',c=>b+=c); res.on('end',()=>resolve(b)); });
    req.on('error', (e) => resolve('ERR:' + e.message));
    req.write(data); req.end();
  });
}

async function tick() {
  // price walk
  price += (Math.random() - 0.48) * 1.2;
  price = Math.round(price * 100) / 100;

  // new candle every tick (1-min sample for the test)
  const t = Math.floor(Date.now() / 1000);
  const last = candles[candles.length - 1];
  const open = last ? last.close : price;
  const high = Math.max(open, price) + Math.random() * 0.5;
  const low = Math.min(open, price) - Math.random() * 0.5;
  candles.push({ time: t, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: price, volume: 500 + Math.floor(Math.random()*1500) });
  if (candles.length > 200) candles.shift();

  // occasionally open a trade
  if (trades.length < 4 && Math.random() < 0.5) {
    const isBuy = Math.random() > 0.45;
    const entry = price;
    const sl = isBuy ? entry - (4 + Math.random()*3) : entry + (4 + Math.random()*3);
    const lots = 0.1;
    trades.push({ id: ++id, type: isBuy ? 'BUY' : 'SELL', symbol: 'XAUUSD', lots, entry: +entry.toFixed(2), currentPrice: +entry.toFixed(2), sl: +sl.toFixed(2), tp: 0, profit: 0, openTime: Date.now() });
    console.log(`  + OPEN ${isBuy?'BUY':'SELL'} @ ${entry.toFixed(2)} SL ${sl.toFixed(2)}`);
  }

  // update open trades + close some
  for (let i = trades.length - 1; i >= 0; i--) {
    const tr = trades[i];
    tr.currentPrice = price;
    tr.profit = Math.round(((tr.type === 'BUY' ? price - tr.entry : tr.entry - price) * tr.lots * 100) * 100) / 100;
    if (Math.random() < 0.18) {
      history.unshift({ type: tr.type, symbol: 'XAUUSD', volume: tr.lots, close: +price.toFixed(2), profit: tr.profit, closeTime: Date.now() });
      balance += tr.profit;
      console.log(`  - CLOSE ${tr.type} profit ${tr.profit}`);
      trades.splice(i, 1);
    }
  }

  const equity = Math.round((balance + trades.reduce((s,t)=>s+t.profit,0)) * 100) / 100;
  const wins = history.filter(h=>h.profit>0).length;
  const losses = history.filter(h=>h.profit<=0).length;
  const tot = wins+losses;

  const body = {
    bot: { name: 'W Forex Bot', symbol: 'XAUUSD', version: '2.00', status: 'running', online: true, lastUpdate: Date.now() },
    account: { balance: +balance.toFixed(2), equity, margin: trades.length*210, freeMargin: +(equity - trades.length*210).toFixed(2), marginLevel: trades.length ? +(equity/(trades.length*210)*100).toFixed(2) : 0, leverage: 100, currency: 'USD', profit: +(equity-balance).toFixed(2) },
    trades: trades.map(t=>({...t})),
    positions: trades.map(t=>({...t})),
    candles: candles.slice(),
    history: history.slice(0, 50),
    performance: { totalTrades: tot, wins, losses, winRate: tot? +(100*wins/tot).toFixed(1):0, sessionProfit: +history.reduce((s,h)=>s+h.profit,0).toFixed(2), openTrades: trades.length },
  };
  const r = await post(body);
  console.log(`[${new Date().toISOString().slice(11,19)}] price ${price} | open ${trades.length} | hist ${history.length} | bal ${balance.toFixed(2)} -> ${r}`);
}

(async () => {
  console.log('Simulating W Forex Bot EA →', ENDPOINT);
  await tick();
  setInterval(tick, 2000);
})();

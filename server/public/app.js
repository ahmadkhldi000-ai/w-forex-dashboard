// W Forex VIP - Professional Dashboard JavaScript with MT5 Chart
let mt5Chart = null;
let positions = [];
let startTime = Date.now();
let lastPrice = null;
let currentTimeframe = '1m';

// Format currency
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

// Format price
function formatPrice(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5
  }).format(value);
}

// Format time
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Update uptime
function updateUptime() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  document.getElementById('stat-uptime').textContent = `${hours}h ${minutes}m`;
}

// Initialize MT5 Candlestick Chart
function initMT5Chart() {
  const container = document.getElementById('mt5-chart');

  if (!container) return;

  mt5Chart = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: 500,
    layout: {
      background: { type: 'solid', color: 'rgba(17, 24, 39, 0.8)' },
      textColor: '#9ca3af',
    },
    grid: {
      vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
      horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
    rightPriceScale: {
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    timeScale: {
      borderColor: 'rgba(255, 255, 255, 0.1)',
      timeVisible: true,
      secondsVisible: false,
    },
    handleScale: {
      time: true,
      price: true,
    },
    handleScroll: {
      mouseWheel: true,
      pinch: true,
    },
  });

  // Create candlestick series
  const candleSeries = mt5Chart.addCandlestickSeries({
    upColor: '#10b981',
    downColor: '#ef4444',
    borderVisible: false,
    wickUpColor: '#10b981',
    wickDownColor: '#ef4444',
  });

  // Create volume series
  const volumeSeries = mt5Chart.addHistogramSeries({
    color: '#3b82f6',
    priceFormat: {
      type: 'volume',
    },
    priceScaleId: '',
    scaleMargins: {
      top: 0.85,
      bottom: 0,
    },
  });

  // Fetch and update chart data
  fetchMT5ChartData(currentTimeframe).then(data => {
    const candleData = data.map(d => ({
      time: d.time * 1000,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volumeData = data.map(d => ({
      time: d.time * 1000,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)',
    }));

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);

    // Get current price
    if (data.length > 0) {
      const lastCandle = data[data.length - 1];
      lastPrice = lastCandle.close;
      updateChartInfo(lastCandle);
    }
  });

  // Handle resize
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      if (entry.target === container) {
        mt5Chart.applyOptions({
          width: entry.contentRect.width,
          height: 500,
        });
      }
    }
  });

  resizeObserver.observe(container);

  // Handle window resize
  window.addEventListener('resize', () => {
    if (container) {
      mt5Chart.applyOptions({
        width: container.clientWidth,
      });
    }
  });

  // Handle time change
  const timeScale = mt5Chart.timeScale();
  timeScale.subscribeVisibleLogicalRangeChange(range => {
    // Keep chart at latest data
    if (range) {
      const end = range.to;
      const start = range.from;
      const date = new Date(end * 1000);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      if (date < twentyFourHoursAgo) {
        timeScale.setVisibleLogicalRange({
          from: end - 1440, // Show 24 hours
          to: end,
        });
      }
    }
  });
}

// Fetch MT5 Chart Data
async function fetchMT5ChartData(timeframe) {
  try {
    // Fetch positions first to get timeframe from EA
    const positionsResponse = await fetch('/api/positions');
    const positionsData = await positionsResponse.json();

    // Determine timeframe (default to 1m if no positions)
    if (positionsData.length > 0) {
      currentTimeframe = positionsData[0].timeframe || '1m';
    } else {
      currentTimeframe = timeframe;
    }

    // Fetch gold price (simplified data for demo)
    // In production, this would fetch real MT5 data via WebSocket
    const now = Math.floor(Date.now() / 1000);
    const hoursAgo = Math.floor(now / 3600) - 24;
    const data = [];

    // Generate candlestick data based on timeframe
    const interval = getTimeframeInterval(currentTimeframe);

    for (let i = 0; i < 100; i++) {
      const time = now - (i * interval);
      const open = lastPrice || 2650 + Math.random() * 10 - 5;
      const close = open + (Math.random() - 0.5) * 2;
      const high = Math.max(open, close) + Math.random() * 1;
      const low = Math.min(open, close) - Math.random() * 1;
      const volume = 100 + Math.random() * 50;

      data.push({
        time,
        open,
        high,
        low,
        close,
        volume,
        timeframe: currentTimeframe,
      });
    }

    return data.reverse();

  } catch (error) {
    console.error('Error fetching MT5 chart data:', error);

    // Return demo data
    const now = Math.floor(Date.now() / 1000);
    const data = [];

    for (let i = 0; i < 100; i++) {
      const time = now - (i * 60);
      const open = 2650 + Math.random() * 10 - 5;
      const close = open + (Math.random() - 0.5) * 2;
      const high = Math.max(open, close) + Math.random() * 1;
      const low = Math.min(open, close) - Math.random() * 1;
      const volume = 100 + Math.random() * 50;

      data.push({
        time,
        open,
        high,
        low,
        close,
        volume,
        timeframe: currentTimeframe,
      });
    }

    return data.reverse();
  }
}

// Get timeframe interval in seconds
function getTimeframeInterval(timeframe) {
  const intervals = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400,
  };
  return intervals[timeframe] || 60;
}

// Update chart info
function updateChartInfo(candle) {
  document.getElementById('current-price').textContent = formatPrice(candle.close);

  if (lastPrice) {
    const change = ((candle.close - lastPrice) / lastPrice) * 100;
    const changeEl = document.getElementById('price-change');
    changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
    changeEl.className = 'price-change ' + (change >= 0 ? 'positive' : 'negative');
  }
}

// Update positions
async function fetchPositions() {
  try {
    const response = await fetch('/api/positions');
    const data = await response.json();
    positions = data;

    updatePositionsTable();
    updatePositionStats();
    updateAnalytics();

    // Calculate win rate
    if (data.length > 0) {
      const winningTrades = data.filter(p => p.profit > 0).length;
      const winRate = Math.round((winningTrades / data.filter(p => p.profit !== null).length) * 100);
      document.getElementById('stat-winrate').textContent = winRate + '%';
    }

  } catch (error) {
    console.error('Error fetching positions:', error);
  }
}

// Update positions table
function updatePositionsTable() {
  const tbody = document.getElementById('positions-body');

  if (positions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div>No open positions</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = positions.map(pos => {
    const profitClass = pos.profit >= 0 ? 'profit-positive' : 'profit-negative';
    const profitSign = pos.profit >= 0 ? '+' : '';
    const time = pos.created_at ? new Date(pos.created_at).toLocaleTimeString() : '--:--';

    return `
      <tr>
        <td>${time}</td>
        <td>${pos.symbol}</td>
        <td><span class="type ${pos.type === 'BUY' ? 'buy' : 'sell'}">${pos.type}</span></td>
        <td>${pos.volume}</td>
        <td>${formatPrice(pos.open_price)}</td>
        <td>${formatPrice(pos.current_price)}</td>
        <td>${pos.spread ? pos.spread.toFixed(2) : '0.00'}</td>
        <td class="profit ${profitClass}">${profitSign}${formatCurrency(pos.profit)}</td>
        <td class="profit ${profitClass}">${profitSign}${pos.pnl_percent ? pos.pnl_percent.toFixed(2) : '0.00'}%</td>
        <td>
          <button class="btn btn-outline" style="padding: 4px 12px; font-size: 12px;">Manage</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Update position stats
function updatePositionStats() {
  const total = positions.length;
  const buy = positions.filter(p => p.type === 'BUY').length;
  const sell = positions.filter(p => p.type === 'SELL').length;

  document.getElementById('pos-total').textContent = total;
  document.getElementById('pos-buy').textContent = buy;
  document.getElementById('pos-sell').textContent = sell;

  // Update hero stats
  document.getElementById('stat-positions').textContent = total;

  const totalProfit = positions.reduce((sum, p) => sum + (p.profit || 0), 0);
  document.getElementById('stat-profit').textContent = formatCurrency(totalProfit);
}

// Update analytics
function updateAnalytics() {
  // Total trades
  const totalTrades = positions.filter(p => p.closed_at).length;
  document.getElementById('stat-total-trades').textContent = totalTrades;

  // Winning/losing trades
  const winning = positions.filter(p => p.profit > 0).length;
  const losing = positions.filter(p => p.profit < 0).length;

  document.getElementById('stat-wins').textContent = winning;
  document.getElementById('stat-losses').textContent = losing;

  // Profit factor
  const totalProfit = positions.filter(p => p.profit > 0).reduce((sum, p) => sum + p.profit, 0);
  const totalLoss = Math.abs(positions.filter(p => p.profit < 0).reduce((sum, p) => sum + p.profit, 0));
  const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : '∞';
  document.getElementById('stat-profit-factor').textContent = profitFactor;

  // Expected value
  const avgProfit = positions.length > 0
    ? positions.reduce((sum, p) => sum + p.profit, 0) / positions.length
    : 0;
  document.getElementById('stat-expected-value').textContent = formatCurrency(avgProfit);

  // Net profit
  const netProfit = positions.reduce((sum, p) => sum + p.profit, 0);
  document.getElementById('stat-net-profit').textContent = formatCurrency(netProfit);

  // Drawdown (simplified)
  const drawdown = 0; // Would need full history
  document.getElementById('stat-drawdown').textContent = formatCurrency(drawdown);

  // Sharpe ratio (simplified)
  const sharpe = 0; // Would need risk-free rate
  document.getElementById('stat-sharpe').textContent = sharpe.toFixed(2);

  // Max concurrent
  const maxConcurrent = 15;
  document.getElementById('stat-concurrent').textContent = maxConcurrent;

  // Average duration (simplified)
  const avgDuration = 0;
  document.getElementById('stat-duration').textContent = avgDuration + 'm';

  // Market sentiment (simplified)
  const bullish = 50;
  const bearish = 50;
  const neutral = 0;

  document.getElementById('sentiment-bullish').style.width = bullish + '%';
  document.getElementById('sentiment-bearish').style.width = bearish + '%';
  document.getElementById('sentiment-neutral').style.width = neutral + '%';
}

// Fetch gold price
async function fetchGoldPrice() {
  try {
    const response = await fetch('/api/gold-price');
    const data = await response.json();

    const price = data.price;
    lastPrice = price;

    document.getElementById('current-price').textContent = formatPrice(price);

    if (lastPrice) {
      const change = ((price - lastPrice) / lastPrice) * 100;
      const changeEl = document.getElementById('price-change');
      changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
      changeEl.className = 'price-change ' + (change >= 0 ? 'positive' : 'negative');
    }

    // Update chart if exists
    if (mt5Chart) {
      const candleSeries = mt5Chart.getSeriesByUid('candlestick');
      if (candleSeries) {
        const candleData = candleSeries.getData();
        if (candleData.length > 0) {
          const lastCandle = candleData[candleData.length - 1];
          updateChartInfo({
            close: candleData[candleData.length - 1].close,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error fetching gold price:', error);
  }
}

// Timeframe buttons
function setupTimeframeButtons() {
  const buttons = document.querySelectorAll('.timeframe-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', function() {
      buttons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentTimeframe = this.dataset.timeframe;

      if (mt5Chart) {
        fetchMT5ChartData(currentTimeframe).then(data => {
          const candleSeries = mt5Chart.getSeriesByUid('candlestick');
          const volumeSeries = mt5Chart.getSeriesByUid('histogram');

          const candleData = data.map(d => ({
            time: d.time * 1000,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          }));

          const volumeData = data.map(d => ({
            time: d.time * 1000,
            value: d.volume,
            color: d.close >= d.open ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)',
          }));

          candleSeries.setData(candleData);
          volumeSeries.setData(volumeData);
        });
      }
    });
  });
}

// Reset chart
function resetChart() {
  if (mt5Chart) {
    const candleSeries = mt5Chart.getSeriesByUid('candlestick');
    const volumeSeries = mt5Chart.getSeriesByUid('histogram');

    candleSeries.setData([]);
    volumeSeries.setData([]);

    fetchMT5ChartData(currentTimeframe).then(data => {
      const candleData = data.map(d => ({
        time: d.time * 1000,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      const volumeData = data.map(d => ({
        time: d.time * 1000,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)',
      }));

      candleSeries.setData(candleData);
      volumeSeries.setData(volumeData);
    });
  }
}

// Toggle fullscreen
function toggleFullscreen() {
  const chartSection = document.querySelector('.chart-section');
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    chartSection.requestFullscreen();
  }
}

// Login modal
function openLoginModal() {
  document.getElementById('loginModal').classList.add('active');
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.remove('active');
}

function loginWithGoogle() {
  alert('Google Sign-In integration coming soon!');
}

// Form submission
// Form submission (only bind if element exists on this page)
const loginFormEl = document.getElementById('loginForm');
if (loginFormEl) loginFormEl.addEventListener('submit', function(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  if (email === 'ahmadkhldi000@gmail.com' && password === 'admin123') {
    alert('Login successful!');
    closeLoginModal();
  } else {
    alert('Invalid credentials');
  }
});

// Close modal on overlay click (only bind if element exists)
const loginModalEl = document.getElementById('loginModal');
if (loginModalEl) loginModalEl.addEventListener('click', function(e) {
  if (e.target === this || e.target.classList.contains('modal-overlay')) {
    closeLoginModal();
  }
});

// Navigation scroll
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    const targetId = this.getAttribute('href').substring(1);
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Login button (only bind if element exists on this page)
const loginBtnEl = document.getElementById('loginBtn');
if (loginBtnEl) loginBtnEl.addEventListener('click', openLoginModal);

// Initialize
window.addEventListener('load', function() {
  // Initialize MT5 chart first
  initMT5Chart();

  // Setup timeframe buttons
  setupTimeframeButtons();

  fetchPositions();
  fetchGoldPrice();
  updateUptime();

  // Update every 5 seconds
  setInterval(() => {
    fetchPositions();
    fetchGoldPrice();
    updateUptime();
  }, 5000);
});

// Handle visibility change
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    fetchPositions();
    fetchGoldPrice();
  }
});

// WebSocket connection
function connectWebSocket() {
  const ws = new WebSocket('ws://localhost:3000/ws');

  ws.onopen = function() {
    console.log('WebSocket connected');
  };

  ws.onmessage = function(event) {
    const data = JSON.parse(event.data);

    if (data.type === 'position_update') {
      fetchPositions();
    } else if (data.type === 'price_update') {
      fetchGoldPrice();
    } else if (data.type === 'chart_update') {
      fetchMT5ChartData(currentTimeframe).then(chartData => {
        const candleSeries = mt5Chart.getSeriesByUid('candlestick');
        const volumeSeries = mt5Chart.getSeriesByUid('histogram');

        const candleData = chartData.map(d => ({
          time: d.time * 1000,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }));

        const volumeData = chartData.map(d => ({
          time: d.time * 1000,
          value: d.volume,
          color: d.close >= d.open ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)',
        }));

        candleSeries.setData(candleData);
        volumeSeries.setData(volumeData);
      });
    }
  };

  ws.onerror = function(error) {
    console.error('WebSocket error:', error);
  };

  ws.onclose = function() {
    console.log('WebSocket disconnected, reconnecting in 5 seconds...');
    setTimeout(connectWebSocket, 5000);
  };
}

connectWebSocket();

<div align="center">

# W Forex — Smart Gold Trading System

**A fully-automated smart-grid trading bot for gold (XAUUSD) on MT5**
Live web dashboard · MT5 expert advisor · Telegram alerts · Investor pitch deck

</div>

---

## What is this?

**W Forex** is a complete, transparent gold-trading system:

- 🤖 **`W Forex Bot.mq5`** — a MetaTrader 5 expert advisor that trades XAUUSD with a
  trend-aware smart grid, ATR-based stops, spread protection, a hard drawdown cap and
  trailing profit. While it trades it **streams the live account, candles, open trades and
  history to the website** every few seconds, and pushes every open/close to **Telegram**.
- 🌐 **Web dashboard** (English, professional) — a real-time candlestick chart with a **W
  logo watermark**, the bot's **live positions drawn directly on the chart** (entry arrows +
  SL/TP lines), account metrics, positions & history tables, a **Telegram popup** and a
  **"Go to Telegram"** feature.
- 🔑 **Google Sign-In** — one-click login, no email/password needed.
- 📊 **Investor presentation** — a 12-slide pitch deck at `/presentation`.

## Project structure

```
W-Forex-FINAL/
├── ea/
│   ├── W Forex Bot.mq5          ← the dashboard-enabled trading bot (copy this into MT5)
│   └── (legacy EAs)
├── server/
│   ├── server.js                ← Node/Express backend (API + SSE + Google OAuth)
│   ├── public/
│   │   ├── index.en.html        ← the professional English dashboard  (served at /)
│   │   ├── index.ar.html        ← Arabic dashboard  (served at /ar)
│   │   ├── presentation.html    ← investor pitch deck  (served at /presentation)
│   │   ├── pro.css / pro.js     ← dashboard styles & logic
│   │   ├── deck.css / deck.js   ← pitch deck styles & logic
│   │   └── login.html           ← Google sign-in page  (served at /login)
│   ├── .env.example             ← environment variables (copy to .env)
│   └── package.json
├── scripts/
│   └── sim-ea.mjs               ← a test simulator that pretends to be the EA
└── render.yaml                  ← one-click deploy to Render.com
```

## Quick start (local)

```bash
cd server
cp .env.example .env        # then edit values (see below)
npm install
npm start                   # → http://localhost:3000
```

With `SIM_MODE=on` (default) the dashboard shows **live gold + simulated demo trades**
so you can see everything working without MT5.

## Connecting your real MT5 account

1. **Copy the EA**: place `ea/W Forex Bot.mq5` into your MT5 `MQL5/Experts/` folder
   (File → Open Data Folder → `MQL5/Experts`).
2. **Compile**: open it in MetaEditor and press **F7** → produces `W Forex Bot.ex5`.
3. **Allow web requests**: in MT5 → **Tools → Options → Expert Advisors**,
   - tick *“Allow WebRequest for listed URL”*
   - add: `https://w-forex-dashboard.onrender.com`
   - add: `https://api.telegram.org`
4. **Attach to a XAUUSD chart** and enable **Algo Trading**. In the inputs set:
   - `DashboardURL`   = `https://w-forex-dashboard.onrender.com/api/ea/data`
   - `DashboardToken` = `WFOREX_SECRET_2026`  (must match the server `AUTH_TOKEN`)
   - `EnableDashboard` = `true`

Within seconds the dashboard lights up **“Live · EA”**, the chart shows your real gold
candles, and every trade the bot opens appears live on the chart and in the tables.

> The EA also writes `W Forex Bot.mq5` to your **Desktop** so you can copy it straight into MT5.

## Enabling Google Sign-In (no email/password)

Google OAuth is fully wired — it just needs credentials.

1. Go to **Google Cloud Console → APIs & Services → Credentials**
   (<https://console.cloud.google.com/apis/credentials>).
2. Create an **OAuth 2.0 Client ID** (type: *Web application*).
3. Add the **Authorized redirect URI**:
   - local:  `http://localhost:3000/api/auth/google/callback`
   - Render: `https://w-forex-dashboard.onrender.com/api/auth/google/callback`
4. Set these environment variables (in `server/.env` locally, or in the Render dashboard):
   ```
   GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxxxxxx
   GOOGLE_REDIRECT_URI=https://w-forex-dashboard.onrender.com/api/auth/google/callback
   ```
5. Restart the server. The **“Continue with Google”** button on `/login` then logs users
   in with one click — **no email or password typed**.

> Until Google credentials are added, the Google button is hidden automatically and the
> standard email/password login still works.

## Telegram channel

The dashboard shows a **“Go to Telegram”** button and an in-page popup that point to:

```
https://t.me/+iXalBkHABfBkYWQ0
```

Set the link via the `TELEGRAM_CHANNEL_LINK` environment variable (default is already the
channel above). Every trade open/close is also pushed there by the EA.

## Deploy to Render

The included `render.yaml` deploys the server to <https://render.com>:

- Build: `cd server && npm install`
- Start: `cd server && node server.js`
- Set the environment variables in the Render dashboard
  (`TELEGRAM_TOKEN`, `TELEGRAM_CHAT`, `TELEGRAM_CHANNEL_LINK`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `AUTH_TOKEN`).

Production URL: <https://w-forex-dashboard.onrender.com>

## API reference (key endpoints)

| Method | Path                       | Description                                  |
|--------|----------------------------|----------------------------------------------|
| GET    | `/`                        | Professional English dashboard               |
| GET    | `/presentation`            | Investor pitch deck                          |
| GET    | `/login`                   | Google / email sign-in                       |
| GET    | `/api/state`               | Full live state (bot, account, trades, …)    |
| GET    | `/api/stream`              | SSE live stream                              |
| GET    | `/api/candles`             | Candlestick data                             |
| GET    | `/api/telegram/channel-link`| Telegram invite link                        |
| GET    | `/api/telegram/posts`      | Recent channel messages                      |
| POST   | `/api/ea/data`             | **EA pushes** live data (auth: `AUTH_TOKEN`) |
| GET    | `/api/auth/google`         | Start Google OAuth                           |

## Risk notice

Trading foreign exchange and gold carries a high level of risk and may not be suitable for
all investors. Past performance is not indicative of future results. Never trade with money
you cannot afford to lose.

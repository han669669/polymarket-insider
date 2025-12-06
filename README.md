# 🐋 Polymarket Insider

**Whale Scanner** — Catch big money moves on Polymarket in real-time.

> Leave it open. Watch the whales. Make smarter bets.

---

## What is this?

A dead-simple dashboard that shows you **large trades ($1K+)** happening on Polymarket right now.

- ✅ **Auto-refreshes every 30 seconds**
- ✅ **Notifications when new whales appear**
- ✅ **Click any trade to see the trader's profile**
- ✅ **Dark/light mode**
- ✅ **Works on mobile**

No signup. No API keys. Just open and watch.

---

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 — done.

---

## How It Works

1. Scans Polymarket's public trade feed
2. Filters for trades **over $1,000**
3. Shows trader name, market, side (BUY/SELL), and amount
4. Auto-refreshes every 30s to catch new activity
5. Click "Scan More Trades" to load older trades (~3 min API limit)

---

## Notification Behavior

| Action | What You See |
|--------|--------------|
| **Check Now** — found whales | ✅ "Found X new whale trade(s)!" |
| **Check Now** — nothing new | ℹ️ "No new trades yet" |
| **Scan More** — found whales | ✅ "Found X more whale trade(s)" |
| **Scan More** — hit API limit | ℹ️ "No more trades in API range" |
| **Auto-refresh** — found whales | ✅ "X new whale(s) detected!" |
| **Auto-refresh** — nothing new | 🔇 *Silent (no spam)* |

---

## Tech Stack

- **React 19** + **Vite 7** + **TypeScript**
- **Tailwind CSS v4**
- **TanStack Query** (auto-refresh, caching)
- **Lucide** icons
- **Zod** (schema validation)
- **Axios** (HTTP client)

---

## API

Uses Polymarket's public endpoint:

```
GET https://data-api.polymarket.com/trades
```

No auth required. ~3 minute trade history available.

---

## License

MIT — do whatever you want.

---

**Built for degens, by degens.** 🎰

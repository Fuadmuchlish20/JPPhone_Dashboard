# JPPhone Dashboard (React + Vite)

Cloud-phone user dashboard: devices, buy device, redeem codes, subscriptions, orders, messages, wallet + top-up, support.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output in dist/
```

## Structure

```
src/
  config.js          brand name, support channels, currency
  api/index.js       data layer: store + every action (start/stop, buy plan, redeem, top-up…)
  api/pricing.js     rental packages (3/7/30/90 days) and discount
  api/format.js      price/date/time helpers
  data/mock.js       sample data (plans, devices, orders, messages, demo codes)
  data/topup.js      top-up amounts and payment methods
  data/games.js      "Choose by game" list
  components/        DeviceCard, DeviceSheet (gear menu), ProfileCard, AccountMenu, …
  pages/             one file per route
  styles.css         all styles
```

## Routes

| Path | Page |
| --- | --- |
| `/` | My Cloud Phones |
| `/new` | Buy device / create device |
| `/device/:id` | Cloud phone player |
| `/redeem` | Redeem code (`?type=plan` / `?type=renew`) |
| `/subscriptions` | Current plan + history |
| `/orders` | Order history |
| `/messages` | Messages |
| `/wallet`, `/wallet/topup` | Wallet and top-up |
| `/support` | Support + FAQ |
| `/section/:name` | Coming-soon pages (rewards, discover, guide) |

## Demo data

Everything runs in memory, so it resets on reload. Try:

- Redeem codes `DEMO-PLAN-2026` (plan) and `DEMO-RENEW-7D` (renew).
- Top-up → **Mark paid (demo)** to credit the wallet, then buy a plan on `/new`.

## Connecting a backend

Only `src/api/index.js` needs to change: replace each action's body with a `fetch()` to your API and
keep returning `{ ok, message? }` or `{ error }`. Load the initial state from the API instead of
`initialState()`. Because routes use `BrowserRouter`, configure your host to serve `index.html` for
unknown paths (SPA fallback).

## Backend & cloud phone engine

`server/` is the real backend: account rules plus the emulator engine (Redroid containers over ADB, or a mock engine for local work). Run the dashboard against it with:

```bash
npm --prefix server install
npm run server        # API on :8787 (mock engine)
npm run dev:backend   # dashboard talking to the API
```

See [server/README.md](server/README.md) for the Linux/Redroid setup and configuration.

Deploying to a real server (Ubuntu, HTTPS, systemd, Redroid phone host): see [deploy/README.md](deploy/README.md).

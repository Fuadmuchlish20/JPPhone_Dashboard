# JPPhone server (backend + emulator engine)

One Node process that:

- holds **accounts** (email + password, session cookie, email verification, password reset) and each user's data in SQLite;
- owns the business rules (plans, daily limits, wallet, gems, redeem codes, top-ups) — the browser can't change balances or skip limits;
- runs the cloud phones through an **engine**: `redroid` (real Android in Docker, driven over ADB, optionally across several region hosts) or `mock` (no Docker, for development);
- streams the phone screen as **H.264 video** (scrcpy → WebSocket → WebCodecs) with **touch/keys/text sent back over the same socket** to scrcpy's control channel, falling back to screenshots + `adb input`;
- lets browsers **measure real latency** to every region (`/api/ping` here, `server/ping.js` on region hosts);
- takes **payments** through Midtrans Snap (QRIS, GoPay, ShopeePay, DANA, cards…) or manual admin confirmation;
- serves the built dashboard.

```
browser ── cookie session ──► server/index.js ── logic.js (rules) ── store.js (SQLite: users, sessions, codes, per-user state)
   │  GET /api/state · POST /api/rpc/:name · POST /api/files            │
   │  WS /api/devices/:id/stream (video) · GET …/screen.png              ├── engines/redroid.js ── docker [-H region host] run redroid/redroid:<android>
   │                                                                     │                       └─ adb: scrcpy video, input, install, push, location
Midtrans ── POST /api/payments/midtrans (signed) ──────────────────────► └── payments.js
```

## Try it locally (mock engine, works on Windows)

```bash
npm install && npm --prefix server install
npm run server          # API on http://127.0.0.1:8787, engine: mock
npm run dev:backend     # dashboard on http://localhost:5173 (proxied to the API)
```

Create an account on the sign-in page. With the mock engine, new accounts get the sample devices/orders and the demo redeem codes (`DEMO-PLAN-2026`, `DEMO-RENEW-7D`) exist; the "screen" is a generated image that reacts to taps.

## Production (Linux host)

```bash
npm install && npm run build:backend
cd server && npm install --omit=dev
ENGINE=redroid HOST=127.0.0.1 PORT=8787 COOKIE_SECURE=1 TRUST_PROXY=1 \
ADMIN_TOKEN=<long random> APP_URL=https://your-domain \
MIDTRANS_SERVER_KEY=<server key> MIDTRANS_PRODUCTION=1 USD_TO_IDR=16000 \
npm start
```

Put nginx/Caddy with HTTPS in front and proxy `/` (including WebSocket upgrades) to `127.0.0.1:8787`.

### 1. Phones (Redroid)

1. Docker + `adb` (`apt install docker.io adb`) and the kernel modules Redroid needs (binder) — follow the Redroid docs for your distro; test once with `docker run --rm --privileged redroid/redroid:13.0.0-latest`.
2. Pull the Android versions you sell: `docker pull redroid/redroid:13.0.0-latest` (and 10, 12, 15). If a version has another tag: `REDROID_IMAGES='{"15":"redroid/redroid:15.0.0_64only-latest"}'`.

| Dashboard | Container |
|---|---|
| Plan CPU / RAM | `--cpus`, `--memory` |
| Android version (Buy, Replace) | image tag |
| Customize (phone model) / Root | boot props `ro.product.*` / `ro.secure=0` |
| Reset, Replace (not lossless), Customize "Clear All" | data volume `jp-<id>-data` deleted |
| GPS changer | `cmd location` test provider (Android 12+) |
| Install / Upload File | `adb install -r -g` / `adb push … /sdcard/Download/` |
| Player taps, swipes, keys, text, rotate | `adb shell input …` |

### 2. Live video (scrcpy)

Download `scrcpy-server-v3.1` from https://github.com/Genymobile/scrcpy/releases, save it as `server/data/scrcpy-server` (or point `SCRCPY_SERVER` at it) and set `SCRCPY_VERSION` to the same version. The player then shows 30–60 fps H.264 video in browsers with WebCodecs (Chrome, Edge, Safari 16.4+, Firefox 130+). Without the file, or in older browsers, it falls back to screenshots automatically. Quality buttons map to: Smooth 960p/2 Mbps/60 fps, HD 1280p/4 Mbps/30 fps, Ultra HD 1280p/8 Mbps/60 fps. One viewer per phone (a new viewer takes over).

Input while video is on goes over the same WebSocket to scrcpy's control socket: real finger down / move / up (so drags, long-presses and joystick holds work), keys, and text (set as the phone clipboard and pasted into the focused field, so emoji and non-Latin text work). That removes the `adb shell` process per tap (~100–300 ms) — what's left is network round trip + encode/decode. In screenshot fallback mode input still uses `adb input`.

### 3. Regions

All phones run on this machine unless a region is mapped to another Docker host:

```bash
REGION_HOSTS='{
  "sg": { "docker": "ssh://deploy@10.0.1.5", "adb": "10.0.1.5" },
  "jp": { "docker": "ssh://deploy@10.0.2.7", "adb": "10.0.2.7" }
}'
```

- `docker` is any `docker -H` address (ssh:// needs key-based SSH from this server). `adb` is where this server reaches that host's phones.
- Remote phones publish ADB on `bind` (default `0.0.0.0`): **firewall ports 5600+ so only this server can reach them** (private network/VPN, e.g. WireGuard).
- Replace to another region rebuilds the phone there (data can't move, so Lossless is only for the same region).
- **Latency badges are measured by each visitor's browser**: it times a few tiny requests to every region and shows the fastest (re-measured every 30 s). Run `PORT=8788 node ping.js` on each region host, put it behind HTTPS, and list it: `REGION_PING='{"sg":"https://sg.example.com/ping"}'`. Regions without a URL are timed against this server's `/api/ping`. Until a measurement arrives the badge shows the estimate from `src/data/mock.js` with a "~".

### 4. Payments

- **Midtrans** (`MIDTRANS_SERVER_KEY` set): a top-up creates a Snap payment page and the dashboard redirects to it. In the Midtrans dashboard set the *Payment Notification URL* to `https://your-domain/api/payments/midtrans`. The wallet is credited only for a valid signature, settled status and the exact IDR amount charged; replays are ignored. Wallet stays in USD, charged as `amount × USD_TO_IDR`.
- **Manual** (no key): top-ups wait for `POST /api/admin/topups/:id/confirm`.

### 5. Email (verification + password reset)

Set **one** of:

- `RESEND_API_KEY=re_…` — [Resend](https://resend.com) (verify your sending domain there first), or
- `SMTP_URL=smtps://user:pass@smtp.example.com:465` — any SMTP server (Gmail app password, Brevo, Mailgun, SES…),

plus `MAIL_FROM="JPPhone <no-reply@your-domain>"` and `APP_URL=https://your-domain` (used in the links).

- New accounts get a "Confirm your email" link (24 h). Until it's confirmed a banner shows on the dashboard with a resend button, and **top-ups, redeem codes, new phones and gem purchases are blocked**. This is on whenever real email is configured; force it with `REQUIRE_VERIFIED_EMAIL=1` or turn it off with `0`.
- "Forgot password?" on the sign-in page emails a one-time link (1 h). Setting the new password signs out every other session and also confirms the email. The answer is the same whether or not the email has an account.
- Without a provider, emails are printed to the server log — handy for local testing.

### 6. Admin API (`Authorization: Bearer $ADMIN_TOKEN`)

```bash
# Cloud store: upload an APK for a catalog key (keys: src/data/apps.js — roblox, chrome, telegram, …)
curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" --data-binary @Roblox.apk https://your-domain/api/admin/apks/roblox
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" https://your-domain/api/admin/apks/roblox

# Redeem codes to sell: 50 codes for 30 days of MVIP, or 7-day renewals of the buyer's current plan
curl -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"kind":"plan","planSlug":"mvip","days":30,"count":50}' https://your-domain/api/admin/codes
curl -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"kind":"renew","days":7,"count":10}' https://your-domain/api/admin/codes

# Manual top-up confirmation (id from the user's top-up list)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://your-domain/api/admin/topups/<id>/confirm
```

Apps without an APK on the server show "Coming soon to this server" on the Install page.

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `ENGINE` | `mock` | `redroid` for real phones |
| `PORT` / `HOST` | `8787` / `127.0.0.1` | where the API listens |
| `DATA_DIR` | `server/data` | `jpphone.db`, staged files, `apks/`, `scrcpy-server` |
| `APK_DIR` | `$DATA_DIR/apks` | Cloud store APKs (`<key>.apk`) |
| `ADMIN_TOKEN` | — | enables the admin API |
| `COOKIE_SECURE` | — | `1` when served over HTTPS |
| `TRUST_PROXY` | — | `1` behind a reverse proxy (real client IPs for login throttling) |
| `ALLOWED_ORIGINS` | — | extra origins allowed to call the API with cookies (dashboard on another domain) |
| `SIGNUP_GEMS` | `0` | gems given to new accounts |
| `RESEND_API_KEY` / `SMTP_URL` | — | email provider (log only when neither is set) |
| `MAIL_FROM` | `JPPhone <no-reply@example.com>` | sender address |
| `REQUIRE_VERIFIED_EMAIL` | `1` with a provider, else `0` | block money/new phones until the email is confirmed |
| `REGION_PING` | `{}` | region → latency probe URL (`server/ping.js` on that host) |
| `MIDTRANS_SERVER_KEY` / `MIDTRANS_PRODUCTION` | — / sandbox | payment provider |
| `USD_TO_IDR` | `16000` | wallet USD → charged IDR |
| `APP_URL` | — | public URL for email links and the Midtrans return page |
| `MAX_UPLOAD_MB` | `2048` | largest uploaded file / APK |
| `REDROID_IMAGE` / `REDROID_IMAGES` | `redroid/redroid:{android}.0.0-latest` | images per Android version |
| `REDROID_GPU_MODE` | `guest` | `host` if the server has a GPU Redroid can use |
| `REGION_HOSTS` | `{}` | region → Docker host (see Regions) |
| `SCRCPY_SERVER` / `SCRCPY_VERSION` | `$DATA_DIR/scrcpy-server` / `3.1` | live video |
| `BOOT_TIMEOUT_S` | `180` | phone marked Error if Android hasn't booted by then |
| `ADB_PORT_BASE` | `5600` | first ADB port for phones |

## Still to decide before launch

- **Storage caps**: plan ROM is enforced on uploads; Docker volumes themselves aren't size-limited (use an XFS project quota or a size-limited volume driver).
- **Scale**: user state is cached in memory and the API is one process. Fine for hundreds to low thousands of users; beyond that, split state into proper tables and run several API workers.

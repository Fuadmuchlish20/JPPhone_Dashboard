// JPPhone backend. Run: `npm start` in server/ (ENGINE=redroid on the Linux host that runs the phones).
//
// Public:   POST /api/auth/register | /api/auth/login | /api/auth/logout    GET /api/auth/me
//           POST /api/auth/forgot {email} · /api/auth/reset {token,password} · /api/auth/verify {token} · /api/auth/verify/resend
//           GET  /api/ping                                  latency probe
//           POST /api/payments/midtrans                     Midtrans HTTP notification (signature-checked)
// Signed in (session cookie):
//           GET  /api/state                                 the user's account + devices (the dashboard polls this)
//           POST /api/rpc/:name   { args: [] }              one action from logic.js RPC → { result, state }
//           POST /api/files?name=…  (raw body)              stage an APK / file for install or upload → { fileId }
//           GET  /api/devices/:id/screen.png                screenshot (live view fallback)
//           WS   /api/devices/:id/stream?q=Smooth           live H.264 video (Redroid + scrcpy)
// Admin (Authorization: Bearer $ADMIN_TOKEN):
//           POST /api/admin/topups/:id/confirm              mark a manual top-up paid
//           PUT  /api/admin/apks/:key  (raw .apk) · DELETE  manage the Cloud store catalog
//           POST /api/admin/codes  { kind, planSlug, days, count }  mint redeem codes
// It also serves the built dashboard (../dist, built with `npm run build:backend`).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import express from "express";
import { WebSocketServer } from "ws";
import { PLANS } from "../src/data/mock.js";
import { confirmEmail, forgotPassword, login, logout, me, pruneSessions, register, resendVerification, resetPassword, sessionUser } from "./auth.js";
import { ENGINE_NAME, engine } from "./engines/index.js";
import { APK_DIR, CATALOG_KEYS, FILES_DIR, RPC, applyPayment, clientState, confirmTopup, pruneStagedFiles, refreshStoreApps, settleAfterRestart, sweepDevices } from "./logic.js";
import { readNotification } from "./payments.js";
import { toControl } from "./scrcpy-control.js";
import { addCode, asUser, findTopupOwner, getCode, seedDemoCodes, state, userIds } from "./store.js";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 2048) * 1024 * 1024;
const DIST = process.env.DIST_DIR ?? path.join(import.meta.dirname, "..", "dist");
// Extra origins allowed to call the API with cookies (comma-separated), e.g. a separate dashboard domain.
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const DEV = ENGINE_NAME === "mock";

if (DEV) seedDemoCodes();
fs.mkdirSync(FILES_DIR, { recursive: true });
fs.mkdirSync(APK_DIR, { recursive: true });
const forEachUser = (fn) => userIds().forEach((id) => asUser(id, fn));
forEachUser(settleAfterRestart);
// Expiry warnings, power-off and deletion (see sweepDevices); one pass at a time.
let sweeping = false;
async function sweep() {
  if (sweeping) return;
  sweeping = true;
  try {
    for (const id of userIds()) await asUser(id, sweepDevices);
  } catch (e) {
    console.error("[sweep]", e);
  } finally {
    sweeping = false;
  }
}
setInterval(sweep, 60_000);
setTimeout(sweep, 5_000);
setInterval(() => {
  pruneSessions();
  pruneStagedFiles();
}, 3_600_000);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "1"); // behind nginx/Caddy: real client IP for login throttling

/** Cookie-authenticated requests must come from our own page (blocks cross-site form posts and WebSocket hijacking). */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin GETs and non-browser clients don't send one
  try {
    return new URL(origin).host === req.headers.host || EXTRA_ORIGINS.includes(origin);
  } catch {
    return false;
  }
}

const bearer = (req) => (req.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
const isAdmin = (req) => ADMIN_TOKEN && bearer(req).length === ADMIN_TOKEN.length && crypto.timingSafeEqual(Buffer.from(bearer(req)), Buffer.from(ADMIN_TOKEN));
const json = express.json({ limit: "1mb" });

/** Stream a request body to a file, enforcing the size cap. */
async function saveBody(req, dest) {
  if (Number(req.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) throw Object.assign(new Error("too large"), { status: 413 });
  let size = 0;
  req.on("data", (c) => {
    size += c.length;
    if (size > MAX_UPLOAD_BYTES) req.destroy(Object.assign(new Error("too large"), { status: 413 }));
  });
  try {
    await pipeline(req, fs.createWriteStream(dest));
  } catch (e) {
    fs.rmSync(dest, { force: true });
    throw e;
  }
  return size;
}

/* ---------------- public ---------------- */

app.post("/api/auth/register", json, (req, res) => (sameOrigin(req) ? register(req, res, { sampleData: DEV }) : res.status(403).end()));
app.post("/api/auth/login", json, (req, res) => (sameOrigin(req) ? login(req, res) : res.status(403).end()));
app.post("/api/auth/logout", (req, res) => (sameOrigin(req) ? logout(req, res) : res.status(403).end()));
app.get("/api/auth/me", me);
app.post("/api/auth/forgot", json, (req, res) => (sameOrigin(req) ? forgotPassword(req, res) : res.status(403).end()));
app.post("/api/auth/reset", json, (req, res) => (sameOrigin(req) ? resetPassword(req, res) : res.status(403).end()));
app.post("/api/auth/verify", json, (req, res) => (sameOrigin(req) ? confirmEmail(req, res) : res.status(403).end()));
app.post("/api/auth/verify/resend", (req, res) => (sameOrigin(req) ? resendVerification(req, res) : res.status(403).end()));

// Latency probe for the server badges: tiny, uncached, callable from any origin (region hosts run server/ping.js).
app.get("/api/ping", (req, res) => res.set({ "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" }).status(204).end());

app.post("/api/payments/midtrans", json, async (req, res) => {
  const n = readNotification(req.body);
  if (!n) return res.status(403).json({ error: "Bad signature." });
  const owner = findTopupOwner((t) => t.reference === n.reference);
  if (owner) await asUser(owner.userId, () => applyPayment(owner.topup.id, n.outcome, n.grossAmount));
  res.json({ ok: true }); // 200 so Midtrans stops retrying; unknown orders are ignored
});

/* ---------------- admin ---------------- */

app.use("/api/admin", (req, res, next) => (isAdmin(req) ? next() : res.status(401).json({ error: "Unauthorized." })));

app.post("/api/admin/topups/:id/confirm", async (req, res) => {
  const owner = findTopupOwner((t) => t.id === req.params.id);
  if (!owner) return res.status(404).json({ error: "No such top-up." });
  res.json(await asUser(owner.userId, () => confirmTopup(req.params.id)));
});

app.put("/api/admin/apks/:key", async (req, res) => {
  const { key } = req.params;
  if (!CATALOG_KEYS.has(key)) return res.status(404).json({ error: `Unknown catalog key. Use one of: ${[...CATALOG_KEYS].join(", ")}` });
  const tmp = path.join(APK_DIR, `.${key}.upload`);
  try {
    await saveBody(req, tmp);
    const fd = fs.openSync(tmp, "r");
    const magic = Buffer.alloc(2);
    fs.readSync(fd, magic, 0, 2, 0);
    fs.closeSync(fd);
    if (magic.toString() !== "PK") throw Object.assign(new Error("not an APK"), { status: 400 });
    fs.renameSync(tmp, path.join(APK_DIR, `${key}.apk`));
    refreshStoreApps();
    res.json({ ok: true, key });
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    res.status(e.status ?? 400).json({ error: e.status === 413 ? "File too large." : "Upload an .apk file as the request body." });
  }
});

app.delete("/api/admin/apks/:key", (req, res) => {
  if (!CATALOG_KEYS.has(req.params.key)) return res.status(404).json({ error: "Unknown catalog key." });
  fs.rmSync(path.join(APK_DIR, `${req.params.key}.apk`), { force: true });
  refreshStoreApps();
  res.json({ ok: true });
});

app.post("/api/admin/codes", json, (req, res) => {
  const { kind, planSlug = null, days, count = 1 } = req.body ?? {};
  if (!["plan", "renew"].includes(kind)) return res.status(400).json({ error: "kind must be plan or renew." });
  if (kind === "plan" && !PLANS.some((p) => p.slug === planSlug)) return res.status(400).json({ error: "planSlug must be a plan slug." });
  if (!Number.isInteger(days) || days < 1 || days > 365) return res.status(400).json({ error: "days must be 1–365." });
  if (!Number.isInteger(count) || count < 1 || count > 500) return res.status(400).json({ error: "count must be 1–500." });
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const codes = [];
  while (codes.length < count) {
    const raw = Array.from(crypto.randomBytes(16), (b) => alphabet[b % alphabet.length]).join("");
    const code = raw.match(/.{4}/g).join("-");
    if (getCode(code)) continue;
    addCode({ code, kind, planSlug: kind === "plan" ? planSlug : null, days });
    codes.push(code);
  }
  res.json({ codes });
});

/* ---------------- signed-in user ---------------- */

app.use("/api", (req, res, next) => {
  const userId = sessionUser(req);
  if (!userId) return res.status(401).json({ error: "Please sign in." });
  if (req.method !== "GET" && !sameOrigin(req)) return res.status(403).json({ error: "Cross-site request blocked." });
  asUser(userId, next);
});

app.get("/api/state", (req, res) => res.json(clientState()));

app.post("/api/rpc/:name", json, async (req, res) => {
  const fn = Object.hasOwn(RPC, req.params.name) ? RPC[req.params.name] : null;
  if (!fn) return res.status(404).json({ error: "Unknown action." });
  const args = Array.isArray(req.body?.args) ? req.body.args : [];
  try {
    const result = await fn(...args);
    res.json({ result, state: clientState() });
  } catch (e) {
    console.error(`[rpc] ${req.params.name}:`, e);
    res.status(500).json({ result: { error: "Something went wrong on the server." }, state: clientState() });
  }
});

app.post("/api/files", async (req, res) => {
  const name = path.basename(String(req.query.name ?? "file")).slice(0, 120) || "file";
  const fileId = `f-${crypto.randomBytes(8).toString("hex").slice(0, 9)}`;
  try {
    const size = await saveBody(req, path.join(FILES_DIR, fileId));
    res.json({ fileId, name, sizeMb: size / 1024 / 1024 });
  } catch (e) {
    if (!res.headersSent) res.status(e.status ?? 400).json({ error: e.status === 413 ? `Files can be up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` : "Upload failed." });
  }
});

app.get("/api/devices/:id/screen.png", async (req, res) => {
  const d = state.devices.find((x) => x.id === req.params.id);
  if (!d) return res.status(404).end();
  if (d.status !== "running") return res.status(409).json({ error: "Turn on the device first." });
  try {
    const png = await engine.screenshot(d);
    res.set({ "Content-Type": "image/png", "Cache-Control": "no-store" }).send(png);
  } catch (e) {
    console.error(`[screen] ${d.id}:`, e?.message ?? e);
    res.status(502).json({ error: "Couldn't capture the screen." });
  }
});

app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false }));
  app.get("*", (req, res) => res.sendFile(path.join(DIST, "index.html")));
}

const server = app.listen(PORT, HOST, () => console.log(`JPPhone server on http://${HOST}:${PORT} · engine: ${ENGINE_NAME}`));

/* ---------------- live video over WebSocket ---------------- */

const QUALITY = {
  Smooth: { maxSize: 960, bitRate: 2_000_000, maxFps: 60 },
  HD: { maxSize: 1280, bitRate: 4_000_000, maxFps: 30 },
  "Ultra HD": { maxSize: 1280, bitRate: 8_000_000, maxFps: 60 },
};
const streams = new Map(); // deviceId -> close() of the current viewer (one viewer per phone)
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://x");
  const m = url.pathname.match(/^\/api\/devices\/([\w-]+)\/stream$/);
  const userId = m && sameOrigin(req) ? sessionUser(req) : null;
  if (!userId) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    return socket.destroy();
  }
  asUser(userId, () => {
    const d = state.devices.find((x) => x.id === m[1]);
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (!d || d.status !== "running") return ws.close(4004, "Device not running");
      if (!engine.openStream) {
        ws.send(JSON.stringify({ type: "unsupported" }));
        return ws.close(1000);
      }
      streams.get(d.id)?.();
      startStream(ws, d, QUALITY[url.searchParams.get("q")] ?? QUALITY.Smooth);
    });
  });
});

async function startStream(ws, d, quality) {
  let waitingForKey = false;
  let stream = null;
  const stop = () => {
    stream?.close();
    if (streams.get(d.id) === stop) streams.delete(d.id);
    if (ws.readyState === ws.OPEN) ws.close(1000);
  };
  streams.set(d.id, stop);
  ws.on("close", stop);
  // Touch / keys / text from the player go straight to scrcpy's control socket (no adb round trip).
  let budget = 0;
  let windowStart = Date.now();
  ws.on("message", (raw, isBinary) => {
    if (isBinary || !stream) return;
    if (Date.now() - windowStart > 1000) (windowStart = Date.now()), (budget = 0);
    if (++budget > 300) return; // more than any finger can produce
    const msgs = toControl(raw.toString());
    if (msgs) for (const m of msgs) stream.control(m);
  });
  try {
    stream = await engine.openStream(d, quality, {
      onMeta: (meta) => ws.send(JSON.stringify({ type: "meta", ...meta })),
      onPacket: ({ config, key, pts, data }) => {
        if (ws.readyState !== ws.OPEN) return;
        // A slow connection drops frames up to the next key frame instead of building up delay.
        if (!config && ws.bufferedAmount > 2 << 20) waitingForKey = true;
        if (waitingForKey && !config && !key) return;
        if (key) waitingForKey = false;
        const head = Buffer.alloc(9);
        head[0] = (config ? 1 : 0) | (key ? 2 : 0);
        head.writeBigUInt64BE(pts, 1);
        ws.send(Buffer.concat([head, data]));
      },
      onEnd: stop,
    });
    if (ws.readyState !== ws.OPEN) stream.close();
    else ws.send(JSON.stringify({ type: "control" })); // tell the player it can send input here
  } catch (e) {
    console.error(`[stream] ${d.id}:`, e?.message ?? e);
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "unsupported", reason: String(e?.message ?? e) }));
    stop();
  }
}

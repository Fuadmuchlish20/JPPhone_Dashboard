// Business rules (plans, limits, wallet, gems, codes) — the server-side twin of src/api/index.js.
// Everything here treats its arguments as untrusted browser input. Long engine work (boot, install, push)
// runs in the background: the device goes to a transitional status and the dashboard picks up the result by polling.
import fs from "node:fs";
import path from "node:path";
import { packagePrice, PACKAGES } from "../src/api/pricing.js";
import { REGIONS, PLANS, nextDeviceName } from "../src/data/mock.js";
import { APP_DATA_OPTIONS, PHONE_MODELS, randomPhone } from "../src/data/phones.js";
import { bonusFor, PAYMENT_METHODS, TOPUP_MAX, TOPUP_MIN } from "../src/data/topup.js";
import { STORE_GAMES, STORE_SOFTWARE } from "../src/data/apps.js";
import { REQUIRE_VERIFIED_EMAIL, isEmailVerified } from "./auth.js";
import { engine } from "./engines/index.js";
import { sendNotice } from "./mailer.js";
import { PROVIDER, createCharge } from "./payments.js";
import { DATA_DIR, allDevices, getCode, publicState, set, state, useCode } from "./store.js";

export const FILES_DIR = path.join(DATA_DIR, "files");
export const APK_DIR = process.env.APK_DIR ?? path.join(DATA_DIR, "apks"); // store catalog: <key>.apk, e.g. roblox.apk
const ADB_PORT_BASE = Number(process.env.ADB_PORT_BASE ?? 5600);
const DAY = 86_400_000;
const HOUR = 3_600_000;
const BUSY = new Set(["creating", "starting", "stopping"]);

const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 11)}`;
const nowIso = () => new Date().toISOString();
const planBySlug = (slug) => PLANS.find((p) => p.slug === slug);
const regionName = (code) => REGIONS.find((r) => r.code === code)?.name ?? String(code).toUpperCase();
const dev = (id) => state.devices.find((d) => d.id === id);
const str = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const sameDay = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const errText = (e) => String(e?.stderr || e?.message || e).trim().split("\n").pop().slice(0, 200);

/** Error result when this account must confirm its email before spending or creating phones. */
const unverified = () =>
  REQUIRE_VERIFIED_EMAIL && !isEmailVerified(state.profile.id)
    ? { error: "Verify your email first — we sent you a link. You can resend it from the banner on your dashboard." }
    : null;

function updateDevice(id, patch) {
  set((s) => ({ devices: s.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
}

function notify(kind, title, body, link = null) {
  set((s) => ({ messages: [{ id: uid("m"), kind, title, body, link, readAt: null, createdAt: nowIso() }, ...s.messages] }));
}

function nextAdbPort() {
  const used = new Set(allDevices().map((d) => d.adbPort));
  let p = ADB_PORT_BASE;
  while (used.has(p)) p++;
  return p;
}

/** Re-apply per-device settings that don't survive a reboot. */
async function afterBoot(d) {
  if (d.gps) await engine.setGps(d, d.gps).catch(() => undefined);
}

/** Put the device in `status`, run the engine work in the background, then mark it running (or stopped / error). */
function background(id, status, work, finalStatus = "running") {
  updateDevice(id, { status, statusMessage: null });
  (async () => {
    await work();
    if (finalStatus === "running") await afterBoot(dev(id));
  })().then(
    () => updateDevice(id, { status: finalStatus }),
    (e) => {
      updateDevice(id, { status: "error", statusMessage: errText(e) });
      console.error(`[engine] ${id}:`, e);
    },
  );
}

function guard(d, { needsRunning = false, needsTime = true } = {}) {
  if (!d) return { error: "Device not found." };
  if (needsTime && new Date(d.expiresAt) < new Date()) return { error: "Your plan has expired. Renew this device first." };
  if (BUSY.has(d.status)) return { error: "Please wait until the device finishes its current operation." };
  if (needsRunning && d.status !== "running") return { error: `${d.name} isn't running. Turn it on first.` };
  return null;
}

function newDevice({ name, plan, region, android, expiresAt }) {
  return {
    id: uid("dev"), name, status: "creating", statusMessage: null, androidVersion: android,
    cpu: plan.cpu, ramMb: plan.ramMb, storageGb: plan.storageGb, planSlug: plan.slug, region,
    rooted: false, phoneModel: null, gps: null, adbPort: nextAdbPort(), expiresAt,
  };
}

function addDevice(d) {
  set((s) => ({ devices: [...s.devices, d] }));
  background(d.id, "creating", () => engine.provision(dev(d.id)));
}

/* ---------------- device actions ---------------- */

export async function deviceAction(id, action) {
  const d = dev(id);
  const bad = guard(d, { needsTime: action === "start" });
  if (bad) return bad;
  switch (action) {
    case "start":
      background(id, "starting", () => engine.start(dev(id)));
      break;
    case "stop":
      background(id, "stopping", () => engine.stop(dev(id)), "stopped");
      break;
    case "restart":
      background(id, "starting", () => engine.restart(dev(id)));
      break;
    case "reset":
      background(id, "starting", () => engine.rebuild(dev(id), { wipe: true }));
      set((s) => ({ uploads: s.uploads.filter((u) => u.deviceId !== id) }));
      break;
    default:
      return { error: "Unknown action." };
  }
  return { ok: true };
}

export async function renameDevice(id, name) {
  const n = str(name, 100).trim();
  if (!dev(id)) return { error: "Device not found." };
  if (!n || n.length > 40) return { error: "Name must be 1–40 characters." };
  updateDevice(id, { name: n });
  return { ok: true };
}

export async function createDevice({ name, region, android } = {}) {
  const gate = unverified();
  if (gate) return gate;
  const sub = state.subscription;
  const plan = sub && planBySlug(sub.planSlug);
  if (!sub || !plan || new Date(sub.end) < new Date()) return { error: "You need an active plan to create a device." };
  if (state.devices.filter((d) => d.planSlug === plan.slug).length >= plan.maxDevices) return { error: "You've reached the device limit for your plan." };
  if (!REGIONS.some((r) => r.code === region)) return { error: "Choose a server." };
  if (!plan.androidVersions.includes(android)) return { error: `Android ${android} isn't available on ${plan.name}.` };
  addDevice(newDevice({ name: str(name, 40).trim() || nextDeviceName(plan, state.devices), plan, region, android, expiresAt: sub.end }));
  return { ok: true };
}

export async function replaceDevice(id, { android, region, lossless } = {}) {
  const d = dev(id);
  const bad = guard(d);
  if (bad) return bad;
  const plan = planBySlug(d.planSlug);
  if (!plan.androidVersions.includes(android)) return { error: `Android ${android} isn't available on ${plan.name}.` };
  if (!REGIONS.some((r) => r.code === region)) return { error: "Choose a server." };
  if (lossless && !plan.losslessReplace) return { error: `Lossless replacement isn't included in ${plan.name}.` };
  const moving = region !== d.region;
  if (lossless && moving) return { error: "Lossless replacement keeps your apps on the same server. Choose your current server, or turn Lossless off." };
  if (state.replacements.filter((r) => r.deviceId === id && sameDay(r.createdAt)).length >= plan.replacesPerDay)
    return { error: `Daily limit reached (${plan.replacesPerDay}× per day on ${plan.name}). Please try again tomorrow.` };
  set((s) => ({
    replacements: [
      { id: uid("r"), deviceId: id, deviceName: d.name, planSlug: plan.slug, fromAndroid: d.androidVersion, toAndroid: android, fromRegion: d.region, toRegion: region, lossless: !!lossless, createdAt: nowIso() },
      ...s.replacements,
    ],
  }));
  const before = { ...d };
  updateDevice(id, { androidVersion: android, region });
  if (!lossless) set((s) => ({ uploads: s.uploads.filter((u) => u.deviceId !== id) }));
  // Another region means another engine host: remove the old phone there, build the new one in the new region.
  background(id, "creating", async () => {
    if (moving) {
      await engine.destroy(before);
      await engine.provision(dev(id));
    } else await engine.rebuild(dev(id), { wipe: !lossless });
  });
  notify("info", `${d.name} replaced`, `New cloud phone on Android ${android} · ${regionName(region)}${lossless ? ", apps kept" : ""}.`, `/device/${id}`);
  return { ok: true };
}

export async function customizeDevice(id, { brand = "", model = "", appData } = {}) {
  const d = dev(id);
  const bad = guard(d);
  if (bad) return bad;
  const plan = planBySlug(d.planSlug);
  brand = str(brand, 40);
  model = str(model, 60);
  if ((brand || model) && !plan.pickModel) return { error: `Choosing a phone model isn't included in ${plan.name}.` };
  if (brand && !PHONE_MODELS[brand]) return { error: "Unknown phone brand." };
  if (model && !PHONE_MODELS[brand]?.includes(model)) return { error: "Choose a model from the list." };
  if (!APP_DATA_OPTIONS.some((o) => o.value === appData)) return { error: "Choose what to do with app data." };
  if (state.customizations.filter((c) => c.deviceId === id && sameDay(c.createdAt)).length >= plan.customizesPerDay)
    return { error: `Daily limit reached (${plan.customizesPerDay}× per day on ${plan.name}). Please try again tomorrow.` };
  const phone = model ? { brand, model } : randomPhone(brand);
  set((s) => ({ customizations: [{ id: uid("c"), deviceId: id, phone, appData, createdAt: nowIso() }, ...s.customizations] }));
  updateDevice(id, { phoneModel: phone });
  background(id, "starting", async () => {
    await engine.rebuild(dev(id), { wipe: appData === "clear" });
    if (appData === "apps") await engine.clearAppData(dev(id));
  });
  notify("info", `${d.name} customized`, `Now a ${phone.brand} ${phone.model}. The cloud phone restarted.`, `/device/${id}`);
  return { ok: true, phone };
}

export async function setRoot(id, enabled) {
  const d = dev(id);
  const bad = guard(d);
  if (bad) return bad;
  const plan = planBySlug(d.planSlug);
  if (!plan.rootAccess) return { error: `Root isn't included in ${plan.name}.` };
  updateDevice(id, { rooted: !!enabled });
  background(id, "starting", () => engine.rebuild(dev(id), { wipe: false }));
  return { ok: true };
}

export async function setGps(id, { lat, lng, label } = {}) {
  const d = dev(id);
  const bad = guard(d, { needsTime: false });
  if (bad) return bad;
  lat = Number(lat);
  lng = Number(lng);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return { error: "Latitude must be −90…90 and longitude −180…180." };
  const gps = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, label: str(label, 120).trim() || null };
  if (d.status === "running") {
    try {
      await engine.setGps(d, gps);
    } catch (e) {
      return { error: `Couldn't set the location: ${errText(e)}` };
    }
  }
  updateDevice(id, { gps }); // applied on the next boot if the phone is off
  set((s) => ({ gpsHistory: [{ id: uid("g"), deviceId: id, deviceName: d.name, ...gps, createdAt: nowIso() }, ...s.gpsHistory] }));
  return { ok: true };
}

const KEYCODES = new Set([3, 4, 24, 25, 26, 82, 187]); // home, back, vol+, vol−, power, menu, recents

/** Touch / keys / text / rotation from the live player. */
export async function deviceInput(id, ev = {}) {
  const d = dev(id);
  const bad = guard(d, { needsRunning: true });
  if (bad) return bad;
  const inRange = (v, max) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= max;
  const ok =
    (ev.type === "tap" && inRange(ev.x, 1280) && inRange(ev.y, 1280)) ||
    (ev.type === "swipe" && [ev.x, ev.x2].every((v) => inRange(v, 1280)) && [ev.y, ev.y2].every((v) => inRange(v, 1280))) ||
    (ev.type === "key" && KEYCODES.has(Number(ev.code))) ||
    (ev.type === "text" && typeof ev.text === "string" && ev.text.length > 0 && ev.text.length <= 1000) ||
    ev.type === "rotate";
  if (!ok) return { error: "Unsupported input." };
  try {
    await engine.input(d, ev);
  } catch (e) {
    return { error: errText(e) };
  }
  return { ok: true };
}

/* ---------------- apps & files ---------------- */

const FILE_ID = /^f-[a-z0-9]{9}$/;
export const filePath = (fileId) => (FILE_ID.test(fileId) ? path.join(FILES_DIR, fileId) : null);

function targetsFor(deviceIds) {
  if (!Array.isArray(deviceIds) || !deviceIds.length) return { error: "Choose at least one cloud phone." };
  const targets = deviceIds.map(dev);
  if (targets.some((d) => !d)) return { error: "Device not found." };
  const off = targets.find((d) => d.status !== "running");
  if (off) return { error: `${off.name} isn't running. Turn it on first.` };
  return { targets };
}

/** apps: [{ source: "store", key, name } | { source: "upload", fileId, name }] */
export async function installApps(deviceIds, apps) {
  if (!Array.isArray(apps) || !apps.length) return { error: "Choose at least one app." };
  const { targets, error } = targetsFor(deviceIds);
  if (error) return { error };
  const resolved = [];
  for (const a of apps) {
    const p = a?.source === "store" ? (/^[\w-]+$/.test(a.key) ? path.join(APK_DIR, `${a.key}.apk`) : null) : a?.source === "upload" ? filePath(a.fileId) : null;
    if (!p || !fs.existsSync(p)) return { error: `${str(a?.name, 60) || "That app"} isn't available on this server yet.` };
    resolved.push({ name: str(a.name, 80) || path.basename(p), source: a.source, path: p });
  }
  const batch = targets.flatMap((d) => resolved.map((a) => ({ id: uid("i"), deviceId: d.id, deviceName: d.name, app: a.name, source: a.source, status: "installing", createdAt: nowIso(), _path: a.path })));
  set((s) => ({ installs: [...batch.map(({ _path, ...i }) => i), ...s.installs] }));
  (async () => {
    let failed = 0;
    for (const job of batch) {
      const status = await engine.install(dev(job.deviceId), job._path).then(
        () => "installed",
        (e) => (failed++, console.error(`[install] ${job.app} on ${job.deviceId}:`, e), "failed"),
      );
      set((s) => ({ installs: s.installs.map((i) => (i.id === job.id ? { ...i, status } : i)) }));
    }
    notify(failed ? "warning" : "success", failed ? "Some installs failed" : "Apps installed", `${batch.length - failed}/${batch.length} install(s) finished.`);
  })();
  return { ok: true, count: batch.length };
}

const SYSTEM_GB = 8;
const usedGb = (deviceId) => SYSTEM_GB + state.uploads.filter((u) => u.deviceId === deviceId).reduce((sum, u) => sum + u.sizeMb / 1024, 0);

/** files: [{ fileId, name }] — sizes come from the stored file, not the browser. */
export async function uploadFiles(deviceIds, files) {
  if (!Array.isArray(files) || !files.length) return { error: "Add at least one file." };
  const { targets, error } = targetsFor(deviceIds);
  if (error) return { error };
  const resolved = [];
  for (const f of files) {
    const p = filePath(f?.fileId);
    if (!p || !fs.existsSync(p)) return { error: "That file is no longer on the server. Add it again." };
    resolved.push({ name: path.basename(str(f.name, 120)) || "file", path: p, sizeMb: fs.statSync(p).size / 1024 / 1024 });
  }
  const totalGb = resolved.reduce((sum, f) => sum + f.sizeMb / 1024, 0);
  const full = targets.find((d) => usedGb(d.id) + totalGb > planBySlug(d.planSlug).storageGb);
  if (full) return { error: `Not enough storage on ${full.name} (${planBySlug(full.planSlug).name}: ${planBySlug(full.planSlug).storageGb} GB).` };
  const batch = targets.flatMap((d) => resolved.map((f) => ({ id: uid("u"), deviceId: d.id, deviceName: d.name, name: f.name, sizeMb: f.sizeMb, status: "uploading", createdAt: nowIso(), _path: f.path })));
  set((s) => ({ uploads: [...batch.map(({ _path, ...u }) => u), ...s.uploads] }));
  (async () => {
    for (const job of batch) {
      const status = await engine.push(dev(job.deviceId), job._path, job.name).then(
        () => "done",
        (e) => (console.error(`[push] ${job.name} to ${job.deviceId}:`, e), "failed"),
      );
      set((s) => ({ uploads: s.uploads.map((u) => (u.id === job.id ? { ...u, status } : u)) }));
    }
    notify("success", "Files uploaded", `${files.length} file(s) sent to Download on ${targets.length} cloud phone(s).`);
  })();
  return { ok: true };
}

/* ---------------- gems ---------------- */

export async function renewWithGems(hoursById) {
  if (!hoursById || typeof hoursById !== "object") return { error: "Add hours to at least one cloud phone." };
  const entries = Object.entries(hoursById).filter(([, h]) => h > 0);
  if (!entries.length) return { error: "Add hours to at least one cloud phone." };
  const items = entries.map(([id, hours]) => ({ device: dev(id), hours }));
  if (items.some((i) => !i.device || !Number.isInteger(i.hours) || i.hours > 24 * 365)) return { error: "Device not found." };
  const cost = items.reduce((sum, i) => sum + i.hours * planBySlug(i.device.planSlug).gemsPerHour, 0);
  if (cost > state.gems) return { error: `Not enough gems — you need ${cost}, you have ${state.gems}.` };
  const hoursFor = Object.fromEntries(entries);
  set((s) => ({
    gems: s.gems - cost,
    devices: s.devices.map((d) => (hoursFor[d.id] ? { ...d, expiresAt: new Date(Math.max(Date.now(), new Date(d.expiresAt).getTime()) + hoursFor[d.id] * HOUR).toISOString() } : d)),
  }));
  const hours = items.reduce((sum, i) => sum + i.hours, 0);
  notify("success", "Renewed with gems", `${hours}h added to ${items.length} cloud phone(s) for ${cost} gems.`);
  return { ok: true, message: `${hours}h added for ${cost} gems.` };
}

export async function buyWithGems({ planSlug, hours, region } = {}) {
  const gate = unverified();
  if (gate) return gate;
  const plan = planBySlug(planSlug);
  if (!plan) return { error: "Choose a plan." };
  if (!Number.isInteger(hours) || hours < 1 || hours > 24 * 365) return { error: "Choose at least 1 hour." };
  if (!REGIONS.some((r) => r.code === region)) return { error: "Choose a server." };
  const cost = hours * plan.gemsPerHour;
  if (cost > state.gems) return { error: `Not enough gems — you need ${cost}, you have ${state.gems}.` };
  const android = plan.androidVersions.includes("13") ? "13" : plan.androidVersions.at(-1);
  set((s) => ({ gems: s.gems - cost }));
  addDevice(newDevice({ name: nextDeviceName(plan, state.devices), plan, region, android, expiresAt: new Date(Date.now() + hours * HOUR).toISOString() }));
  notify("success", `${plan.name} created with gems`, `${hours}h cloud phone for ${cost} gems.`);
  return { ok: true, message: `${plan.name} for ${hours}h is being created (${cost} gems).` };
}

/* ---------------- plans, wallet, codes ---------------- */

function extendSubscription(planSlug, days) {
  const sub = state.subscription;
  const active = sub && sub.status === "active" && new Date(sub.end) > new Date();
  if (active && sub.planSlug !== planSlug) return { error: "You already have a different active plan. Renew it, or wait until it ends." };
  const start = active ? sub.start : nowIso();
  const end = new Date((active ? new Date(sub.end).getTime() : Date.now()) + days * DAY).toISOString();
  set((s) => ({
    subscription: { planSlug, start, end, status: "active" },
    devices: s.devices.map((d) => (d.planSlug === planSlug ? { ...d, expiresAt: end } : d)),
  }));
  return { ok: true, end, kind: active ? "renew" : "new" };
}

export async function purchasePlan(planSlug, days) {
  const plan = planBySlug(planSlug);
  if (!plan) return { error: "That plan is no longer available." };
  if (!PACKAGES.some((p) => p.days === days)) return { error: "Choose a package." };
  const { total } = packagePrice(plan, days);
  if (state.wallet < total) return { error: "Not enough wallet balance. Top up first." };
  const res = extendSubscription(planSlug, days);
  if (res.error) return res;
  const balance = Math.round((state.wallet - total) * 100) / 100;
  set((s) => ({
    wallet: balance,
    orders: [{ id: uid("o"), kind: res.kind, source: "wallet", status: "paid", planSlug, days, amount: total, reference: null, createdAt: nowIso() }, ...s.orders],
    transactions: [{ id: uid("t"), kind: "purchase", amount: -total, balanceAfter: balance, note: `${plan.name} · ${days} days`, createdAt: nowIso() }, ...s.transactions],
  }));
  notify("success", `${plan.name} purchased`, `${days} day(s) paid from your wallet.`, "/subscriptions");
  return { ok: true, message: `${plan.name} is active. Now create your device.` };
}

export async function redeemCode(kind, raw) {
  const gate = unverified();
  if (gate) return gate;
  const code = str(raw, 60).toUpperCase().replace(/\s+/g, "");
  const row = code && getCode(code);
  if (!row) return { error: "That code doesn't exist. Check it and try again." };
  if (row.used_by) return { error: "This code has already been used." };
  const c = { kind: row.kind, planSlug: row.plan_slug, days: row.days };
  if (c.kind !== kind) return { error: kind === "plan" ? "This is a renewal code — use Renew cloud phone instead." : "This code activates a plan — use Add new cloud phone instead." };
  const planSlug = c.kind === "plan" ? c.planSlug : state.subscription?.planSlug;
  if (!planSlug) return { error: "You don't have a plan to renew yet. Redeem a plan code first." };
  if (c.kind === "plan" && state.subscription && state.subscription.planSlug !== planSlug && new Date(state.subscription.end) > new Date())
    return { error: "You already have a different active plan. Renew it, or wait until it ends." };
  if (!useCode(code, state.profile.id)) return { error: "This code has already been used." };
  const res = extendSubscription(planSlug, c.days);
  if (res.error) return res;
  set((s) => ({
    orders: [{ id: uid("o"), kind: res.kind, source: "redeem", status: "paid", planSlug, days: c.days, amount: 0, reference: `${code.slice(0, 4)}••••`, createdAt: nowIso() }, ...s.orders],
  }));
  const plan = planBySlug(planSlug);
  notify("success", `${plan.name} ${c.kind === "plan" ? "activated" : "renewed"}`, `${c.days} day(s) added with a redeem code.`, "/subscriptions");
  return { ok: true, message: `${c.days} day(s) of ${plan.name} added.` };
}

export async function createTopup(amount, _bonusFromBrowser, method) {
  const gate = unverified();
  if (gate) return gate;
  amount = Math.round(Number(amount) * 100) / 100;
  if (!(amount >= TOPUP_MIN && amount <= TOPUP_MAX)) return { error: `Enter an amount between $${TOPUP_MIN} and $${TOPUP_MAX}.` };
  if (!PAYMENT_METHODS.some((m) => m.id === method)) return { error: "Choose a payment method." };
  const topup = { id: uid("tp"), reference: `TP-${Math.random().toString(36).slice(2, 12).toUpperCase()}`, amount, bonus: bonusFor(amount), method, status: "pending", provider: PROVIDER, createdAt: nowIso() };
  if (PROVIDER === "midtrans") {
    try {
      Object.assign(topup, await createCharge(topup, state.profile));
    } catch (e) {
      console.error("[payments]", e);
      return { error: "The payment service is unavailable right now. Please try again in a moment." };
    }
  }
  set((s) => ({ topups: [topup, ...s.topups] }));
  return { ok: true, message: topup.reference, payUrl: topup.payUrl ?? null };
}

export async function cancelTopup(id) {
  set((s) => ({ topups: s.topups.map((t) => (t.id === id && t.status === "pending" ? { ...t, status: "canceled" } : t)) }));
  return { ok: true };
}

/** Admin / payment-provider callback only — never exposed to the browser RPC. */
export async function confirmTopup(id) {
  const t = state.topups.find((x) => x.id === id && x.status === "pending");
  if (!t) return { error: "Already handled." };
  const credit = t.amount + t.bonus;
  const balance = Math.round((state.wallet + credit) * 100) / 100;
  set((s) => ({
    wallet: balance,
    topups: s.topups.map((x) => (x.id === id ? { ...x, status: "paid" } : x)),
    transactions: [{ id: uid("t"), kind: "topup", amount: credit, balanceAfter: balance, note: `Top-up ${t.reference}`, createdAt: nowIso() }, ...s.transactions],
  }));
  notify("success", "Wallet topped up", `$${credit.toFixed(2)} added to your wallet.`, "/wallet");
  return { ok: true };
}

export async function markMessagesRead() {
  if (!state.messages.some((m) => !m.readAt)) return { ok: true };
  set((s) => ({ messages: s.messages.map((m) => (m.readAt ? m : { ...m, readAt: nowIso() })) }));
  return { ok: true };
}

/* ---------------- expiry lifecycle ---------------- */

// After a phone's time runs out it is powered off, kept for GRACE_DAYS so the owner can renew, then deleted for good.
const GRACE_DAYS = Number(process.env.EXPIRE_GRACE_DAYS ?? 7);
const APP_URL = process.env.APP_URL ?? "";
const RENEW_PATH = "/redeem?type=renew";
const fmtDay = (ms) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const fmtTime = (ms) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });

/** One email + one dashboard message per stage. Stages are keyed by expiresAt, so a renewal starts them over. */
function noticeOnce(id, stage, { title, body, kind = "warning" }) {
  const d = dev(id); // fresh: an earlier stage in the same pass may have just been recorded
  if (d.notices?.[stage] === d.expiresAt) return;
  updateDevice(id, { notices: { ...d.notices, [stage]: d.expiresAt } });
  notify(kind, title, body, RENEW_PATH);
  sendNotice(state.profile.email, {
    subject: title,
    heading: title,
    text: body,
    button: "Renew now",
    url: `${APP_URL}${RENEW_PATH}`,
  }).catch((e) => console.error("[mail] notice:", e.message));
}

/**
 * Runs every minute for each user:
 *   24 h before expiry  → "expires tomorrow"
 *   at expiry           → power off + "expired, deleted on <date>"
 *   1 day before delete → last warning
 *   after GRACE_DAYS    → phone and its data removed from the engine and the account
 */
export async function sweepDevices() {
  const now = Date.now();
  for (const d of state.devices) {
    const end = new Date(d.expiresAt).getTime();
    const deleteAt = end + GRACE_DAYS * DAY;
    if (end > now) {
      if (end - now < DAY) noticeOnce(d.id, "soon", { title: `${d.name} expires in less than a day`, body: `Renew before ${fmtTime(end)} to keep it running.` });
      continue;
    }
    if (deleteAt <= now) {
      // Past the grace period (e.g. the server was down): just delete, no stale warnings.
      if (!BUSY.has(d.status) && !d.deleting) await deleteDevice(d);
      continue;
    }
    if (d.status === "running") background(d.id, "stopping", () => engine.stop(dev(d.id)), "stopped");
    noticeOnce(d.id, "expired", {
      title: `${d.name} expired`,
      body: `Its time ran out, so it was powered off. Renew by ${fmtDay(deleteAt)} or the phone and everything on it will be deleted.`,
    });
    if (deleteAt - now < DAY) noticeOnce(d.id, "final", { title: `${d.name} will be deleted tomorrow`, body: `Renew today to keep its apps and data. After ${fmtDay(deleteAt)} it can't be recovered.` });
  }
}

async function deleteDevice(d) {
  updateDevice(d.id, { deleting: true });
  try {
    await engine.destroy(d);
  } catch (e) {
    // Engine host unreachable: keep the record and try again on the next sweep.
    updateDevice(d.id, { deleting: false });
    return console.error(`[cleanup] ${d.id}:`, errText(e));
  }
  set((s) => ({ devices: s.devices.filter((x) => x.id !== d.id), uploads: s.uploads.filter((u) => u.deviceId !== d.id) }));
  notify("info", `${d.name} was deleted`, `It stayed expired for ${GRACE_DAYS} days, so the phone and its data were removed.`);
}

/** Files staged for install/upload are only needed for a few minutes; drop anything older than a day. */
export function pruneStagedFiles() {
  const cutoff = Date.now() - DAY;
  for (const name of fs.readdirSync(FILES_DIR)) {
    const p = path.join(FILES_DIR, name);
    if (fs.statSync(p).mtimeMs < cutoff) fs.rmSync(p, { force: true });
  }
}

/** On startup, nothing can still be mid-operation: settle devices left in a transitional state. */
export function settleAfterRestart() {
  for (const d of state.devices) if (BUSY.has(d.status)) updateDevice(d.id, { status: "error", statusMessage: "Server restarted during an operation. Power it on again." });
}

/** Payment provider result for one of this user's top-ups (amount must match what was charged). */
export async function applyPayment(topupId, outcome, grossAmount) {
  const t = state.topups.find((x) => x.id === topupId);
  if (!t || t.status !== "pending") return;
  if (outcome === "paid") {
    if (t.idrAmount && grossAmount !== t.idrAmount) return console.warn(`[payments] ${t.reference}: paid ${grossAmount}, expected ${t.idrAmount}`);
    return confirmTopup(t.id);
  }
  if (outcome === "failed") set((s) => ({ topups: s.topups.map((x) => (x.id === t.id ? { ...x, status: "failed" } : x)) }));
}

/* ---------------- cloud store catalog ---------------- */

export const CATALOG_KEYS = new Set([...STORE_GAMES, ...STORE_SOFTWARE].map((a) => a.key));

let apkCache = { at: 0, keys: [] };
/** Catalog keys that have an APK uploaded on this server. */
export function storeApps() {
  if (Date.now() - apkCache.at > 10_000) {
    let keys = [];
    try {
      keys = fs.readdirSync(APK_DIR).filter((n) => n.endsWith(".apk")).map((n) => n.slice(0, -4)).filter((k) => CATALOG_KEYS.has(k));
    } catch {
      // no catalog folder yet
    }
    apkCache = { at: Date.now(), keys };
  }
  return apkCache.keys;
}
export const refreshStoreApps = () => (apkCache.at = 0);

// Where browsers measure each region's latency: REGION_PING urls (server/ping.js on that host); null = this server.
const REGION_PING = JSON.parse(process.env.REGION_PING ?? "{}");
const regionPing = Object.fromEntries(REGIONS.map((r) => [r.code, REGION_PING[r.code] ?? null]));

/** What the dashboard receives: the user's state plus server capabilities. */
export const clientState = () => ({
  ...publicState(),
  storeApps: storeApps(),
  paymentProvider: PROVIDER,
  emailVerified: isEmailVerified(state.profile.id),
  requireVerifiedEmail: REQUIRE_VERIFIED_EMAIL,
  regionPing,
});

/** Functions the browser may call through /api/rpc/:name. */
export const RPC = {
  deviceAction, renameDevice, createDevice, replaceDevice, customizeDevice, setRoot, setGps, deviceInput,
  installApps, uploadFiles, renewWithGems, buyWithGems, purchasePlan, redeemCode, createTopup, cancelTopup, markMessagesRead,
};

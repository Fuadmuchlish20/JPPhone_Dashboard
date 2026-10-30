// Data layer. Two modes, same exports and return shapes ({ ok } or { error }):
//  - offline (default): in-memory sample data from src/data/mock.js, so the dashboard is clickable without a server;
//  - backend (VITE_BACKEND=1): every action is sent to the server in /server (POST /api/rpc/:name) and the
//    state is polled from GET /api/state. The server owns all rules; the local bodies below only run offline.
import { useSyncExternalStore } from "react";
import { PLANS, PLAN_THEMES, REGIONS, initialState, nextDeviceName } from "../data/mock";
import { APP_DATA_OPTIONS, PHONE_MODELS, randomPhone } from "../data/phones";
import { packagePrice } from "./pricing";
import { SHOT_H, SHOT_W, drawSampleScreenshot } from "./screenshot";

export { PLANS, PLAN_THEMES, REGIONS };

export const REMOTE = import.meta.env.VITE_BACKEND === "1";
const API = import.meta.env.VITE_API_URL ?? ""; // same origin by default (Vite proxies /api in dev)
const POLL_MS = 2500;

// Backend mode starts empty (and signed out until the session check answers) instead of showing sample data.
const EMPTY = { ...initialState(), devices: [], orders: [], messages: [], transactions: [], topups: [], installs: [], uploads: [], replacements: [], customizations: [], gpsHistory: [], subscription: null, subscriptionHistory: [], wallet: 0, gems: 0 };
/** session: "loading" | "anon" | "user" (always "user" offline). */
let state = REMOTE ? { ...EMPTY, session: "loading" } : { ...initialState(), session: "user" };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const set = (patch) => {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  emit();
};

/* ---------------- backend connection ---------------- */

const OFFLINE = "Can't reach the server. Check your connection and try again.";
const request = (path, { json, ...opts } = {}) =>
  fetch(`${API}${path}`, {
    credentials: "include",
    ...opts,
    ...(json !== undefined ? { method: "POST", body: JSON.stringify(json), headers: { "Content-Type": "application/json" } } : {}),
  });

const signedOut = () => set({ ...EMPTY, session: "anon" });

async function rpc(name, args) {
  try {
    const res = await request(`/api/rpc/${name}`, { json: { args } });
    if (res.status === 401) {
      signedOut();
      return { error: "Please sign in again." };
    }
    const body = await res.json();
    if (body.state) set(body.state);
    return body.result ?? { error: body.error ?? "Request failed." };
  } catch {
    return { error: OFFLINE };
  }
}

async function poll() {
  try {
    const res = await request("/api/state");
    if (res.status === 401) return signedOut();
    if (res.ok) set({ ...(await res.json()), session: "user" });
  } catch {
    // offline for a moment; the next poll retries
  }
}

if (REMOTE) {
  poll();
  setInterval(() => state.session === "user" && document.visibilityState === "visible" && poll(), POLL_MS);
}

async function authCall(path, json) {
  try {
    const res = await request(path, { json });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error ?? "Something went wrong. Please try again." };
    await poll();
    return { ok: true };
  } catch {
    return { error: OFFLINE };
  }
}

export const signIn = (email, password) => authCall("/api/auth/login", { email, password });
export const signUp = (name, email, password) => authCall("/api/auth/register", { name, email, password });
/** Email flows. Each returns { ok } or { error }. */
async function post(path, json) {
  try {
    const res = await request(path, { json });
    const body = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, ...body } : { error: body.error ?? "Something went wrong. Please try again." };
  } catch {
    return { error: OFFLINE };
  }
}
export const requestPasswordReset = (email) => post("/api/auth/forgot", { email });
export async function resetPassword(token, password) {
  const res = await post("/api/auth/reset", { token, password });
  if (res.ok) await poll(); // the reset also signs this browser in
  return res;
}
const verifying = new Map(); // a token works once; StrictMode runs effects twice in development
export function verifyEmail(token) {
  if (!verifying.has(token)) verifying.set(token, post("/api/auth/verify", { token }).then(async (r) => (r.ok && (await poll()), r)));
  return verifying.get(token);
}
export const resendVerification = () => post("/api/auth/verify/resend", {});

export async function signOut() {
  await request("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  signedOut();
}

/** Upload a picked File to the server first; the RPC then refers to it by fileId. */
async function stageFile(item) {
  if (!item.file) return item;
  const res = await request(`/api/files?name=${encodeURIComponent(item.file.name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: item.file,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Upload failed.");
  // eslint-disable-next-line no-unused-vars
  const { file, ...rest } = item;
  return { ...rest, fileId: body.fileId };
}

async function rpcWithFiles(name, deviceIds, items) {
  try {
    return await rpc(name, [deviceIds, await Promise.all(items.map(stageFile))]);
  } catch (e) {
    return { error: e.message };
  }
}

/** WebSocket URL of a phone's live H.264 video (backend mode). */
export function streamUrl(id, quality) {
  const base = new URL(API || window.location.origin, window.location.href);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = `${base.pathname.replace(/\/$/, "")}/api/devices/${encodeURIComponent(id)}/stream`;
  base.search = `?q=${encodeURIComponent(quality)}`;
  return base.toString();
}

/** Live screen image URL for the player (backend mode). */
export const screenUrl = (id, n = 0) => `${API}/api/devices/${encodeURIComponent(id)}/screen.png?n=${n}`;

/** Touch / key / text / rotate on a running phone (backend mode). */
export const sendInput = (id, ev) => rpc("deviceInput", [id, ev]);

async function remoteScreenshot(id) {
  try {
    const res = await fetch(screenUrl(id, Date.now()), { credentials: "include" });
    if (!res.ok) return { error: (await res.json().catch(() => ({}))).error ?? "Couldn't capture the screen." };
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    return { ok: true, url: URL.createObjectURL(blob), width: bmp.width, height: bmp.height, takenAt: new Date().toISOString() };
  } catch {
    return { error: "Can't reach the server. Check your connection and try again." };
  }
}
const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const DAY = 86_400_000;
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const nowIso = () => new Date().toISOString();

/** Current store snapshot, for code outside React (e.g. the latency probe). */
export const getState = () => state;

/** Absolute URL of an API path (honours VITE_API_URL). */
export const apiUrl = (path) => `${API}${path}`;

/** Subscribe a component to the store. */
export function useStore(selector = (s) => s) {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
  );
}

export const planBySlug = (slug) => PLANS.find((p) => p.slug === slug);
export const regionName = (code) => REGIONS.find((r) => r.code === code)?.name ?? code.toUpperCase();

function updateDevice(id, patch) {
  set((s) => ({ devices: s.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
}

function notify(kind, title, body, link = null) {
  set((s) => ({ messages: [{ id: uid("m"), kind, title, body, link, readAt: null, createdAt: nowIso() }, ...s.messages] }));
}

/* ---------------- device actions ---------------- */

export async function deviceAction(id, action) {
  if (REMOTE) return rpc("deviceAction", [...arguments]);
  const d = state.devices.find((x) => x.id === id);
  if (!d) return { error: "Device not found." };
  if (action === "start" && new Date(d.expiresAt) < new Date()) return { error: "Your plan has expired. Renew to start this device." };
  const transitional = { start: "starting", stop: "stopping", restart: "starting", reset: "starting" }[action];
  updateDevice(id, { status: transitional, statusMessage: null });
  await wait(1200);
  updateDevice(id, { status: action === "stop" ? "stopped" : "running" });
  return { ok: true };
}

export async function renameDevice(id, name) {
  if (REMOTE) return rpc("renameDevice", [...arguments]);
  const n = name.trim();
  if (!n || n.length > 40) return { error: "Name must be 1–40 characters." };
  await wait();
  updateDevice(id, { name: n });
  return { ok: true };
}

export async function createDevice({ name, region, android }) {
  if (REMOTE) return rpc("createDevice", [...arguments]);
  const sub = state.subscription;
  const plan = sub && planBySlug(sub.planSlug);
  if (!sub || !plan || new Date(sub.end) < new Date()) return { error: "You need an active plan to create a device." };
  if (state.devices.length >= plan.maxDevices) return { error: "You've reached the device limit for your plan." };
  await wait();
  const id = uid("dev");
  set((s) => ({
    devices: [
      ...s.devices,
      { id, name: name?.trim() || nextDeviceName(plan, state.devices), status: "creating", statusMessage: null, androidVersion: android, cpu: plan.cpu, ramMb: plan.ramMb, storageGb: plan.storageGb, planSlug: plan.slug, region, expiresAt: sub.end },
    ],
  }));
  setTimeout(() => updateDevice(id, { status: "running" }), 2500);
  return { ok: true };
}

/** Replacements already made today on this device (resets at local midnight). */
export function replacesToday(replacements, deviceId, now = new Date()) {
  const today = now.toDateString();
  return replacements.filter((r) => r.deviceId === deviceId && new Date(r.createdAt).toDateString() === today).length;
}

/** Swap the device for a fresh one with the chosen Android version and server. */
export async function replaceDevice(id, { android, region, lossless }) {
  if (REMOTE) return rpc("replaceDevice", [...arguments]);
  const d = state.devices.find((x) => x.id === id);
  if (!d) return { error: "Device not found." };
  const plan = planBySlug(d.planSlug);
  if (new Date(d.expiresAt) < new Date()) return { error: "Your plan has expired. Renew before replacing this device." };
  if (["creating", "starting", "stopping"].includes(d.status)) return { error: "Please wait until the device finishes its current operation." };
  if (!plan.androidVersions.includes(android)) return { error: `Android ${android} isn't available on ${plan.name}.` };
  if (!REGIONS.some((r) => r.code === region)) return { error: "Choose a server." };
  if (lossless && !plan.losslessReplace) return { error: `Lossless replacement isn't included in ${plan.name}.` };
  if (replacesToday(state.replacements, id) >= plan.replacesPerDay)
    return { error: `Daily limit reached (${plan.replacesPerDay}× per day on ${plan.name}). Please try again tomorrow.` };
  await wait();
  set((s) => ({
    replacements: [
      { id: uid("r"), deviceId: id, deviceName: d.name, planSlug: plan.slug, fromAndroid: d.androidVersion, toAndroid: android, fromRegion: d.region, toRegion: region, lossless: !!lossless, createdAt: nowIso() },
      ...s.replacements,
    ],
  }));
  updateDevice(id, { status: "creating", statusMessage: null, androidVersion: android, region });
  setTimeout(() => updateDevice(id, { status: "running" }), 2500);
  notify("info", `${d.name} replaced`, `New cloud phone on Android ${android} · ${regionName(region)}${lossless ? ", apps kept" : ""}.`, `/device/${id}`);
  return { ok: true };
}

/** Install store apps / uploaded APKs on several running devices at once. apps: [{ name, source: "store" | "upload" }] */
export async function installApps(deviceIds, apps) {
  if (REMOTE) return rpcWithFiles("installApps", deviceIds, apps);
  if (!apps.length) return { error: "Choose at least one app." };
  if (!deviceIds.length) return { error: "Choose at least one cloud phone." };
  const targets = deviceIds.map((id) => state.devices.find((d) => d.id === id));
  if (targets.some((d) => !d)) return { error: "Device not found." };
  const off = targets.find((d) => d.status !== "running");
  if (off) return { error: `${off.name} isn't running. Turn it on first.` };
  await wait();
  const batch = targets.flatMap((d) =>
    apps.map((a) => ({ id: uid("i"), deviceId: d.id, deviceName: d.name, app: a.name, source: a.source, status: "installing", createdAt: nowIso() })),
  );
  set((s) => ({ installs: [...batch, ...s.installs] }));
  setTimeout(() => {
    const ids = new Set(batch.map((b) => b.id));
    set((s) => ({ installs: s.installs.map((i) => (ids.has(i.id) ? { ...i, status: "installed" } : i)) }));
    notify("success", "Apps installed", `${apps.length} app(s) installed on ${targets.length} cloud phone(s).`);
  }, 3000);
  return { ok: true, count: batch.length };
}

// Android itself takes this much of every device's ROM.
const SYSTEM_GB = 8;

/** Storage used on a device: system + files uploaded to it. */
export function storageUsedGb(uploads, deviceId) {
  return SYSTEM_GB + uploads.filter((u) => u.deviceId === deviceId).reduce((sum, u) => sum + u.sizeMb / 1024, 0);
}

/** Copy files to /sdcard/Download on each running device, within its plan's ROM. files: [{ name, sizeMb }] */
export async function uploadFiles(deviceIds, files) {
  if (REMOTE) return rpcWithFiles("uploadFiles", deviceIds, files);
  if (!files.length) return { error: "Add at least one file." };
  if (!deviceIds.length) return { error: "Choose at least one cloud phone." };
  const targets = deviceIds.map((id) => state.devices.find((d) => d.id === id));
  if (targets.some((d) => !d)) return { error: "Device not found." };
  const off = targets.find((d) => d.status !== "running");
  if (off) return { error: `${off.name} isn't running. Turn it on first.` };
  const totalGb = files.reduce((sum, f) => sum + f.sizeMb / 1024, 0);
  const full = targets.find((d) => storageUsedGb(state.uploads, d.id) + totalGb > planBySlug(d.planSlug).storageGb);
  if (full) return { error: `Not enough storage on ${full.name} (${planBySlug(full.planSlug).name}: ${planBySlug(full.planSlug).storageGb} GB).` };
  await wait();
  const batch = targets.flatMap((d) => files.map((f) => ({ id: uid("u"), deviceId: d.id, deviceName: d.name, name: f.name, sizeMb: f.sizeMb, status: "uploading", createdAt: nowIso() })));
  set((s) => ({ uploads: [...batch, ...s.uploads] }));
  setTimeout(() => {
    const ids = new Set(batch.map((b) => b.id));
    set((s) => ({ uploads: s.uploads.map((u) => (ids.has(u.id) ? { ...u, status: "done" } : u)) }));
    notify("success", "Files uploaded", `${files.length} file(s) saved to Download on ${targets.length} cloud phone(s).`);
  }, 2500);
  return { ok: true };
}

/** Change the phone model the device presents; brand/model "" = random. Restarts the device. */
export async function customizeDevice(id, { brand, model, appData }) {
  if (REMOTE) return rpc("customizeDevice", [...arguments]);
  const d = state.devices.find((x) => x.id === id);
  if (!d) return { error: "Device not found." };
  const plan = planBySlug(d.planSlug);
  if (new Date(d.expiresAt) < new Date()) return { error: "Your plan has expired. Renew before customizing this device." };
  if (["creating", "starting", "stopping"].includes(d.status)) return { error: "Please wait until the device finishes its current operation." };
  if ((brand || model) && !plan.pickModel) return { error: `Choosing a phone model isn't included in ${plan.name}.` };
  if (brand && !PHONE_MODELS[brand]) return { error: "Unknown phone brand." };
  if (model && !PHONE_MODELS[brand]?.includes(model)) return { error: "Choose a model from the list." };
  if (!APP_DATA_OPTIONS.some((o) => o.value === appData)) return { error: "Choose what to do with app data." };
  const today = new Date().toDateString();
  const used = state.customizations.filter((c) => c.deviceId === id && new Date(c.createdAt).toDateString() === today).length;
  if (used >= plan.customizesPerDay) return { error: `Daily limit reached (${plan.customizesPerDay}× per day on ${plan.name}). Please try again tomorrow.` };
  await wait();
  const phone = model ? { brand, model } : randomPhone(brand);
  set((s) => ({ customizations: [{ id: uid("c"), deviceId: id, phone, appData, createdAt: nowIso() }, ...s.customizations] }));
  updateDevice(id, { status: "starting", statusMessage: null, phoneModel: phone });
  setTimeout(() => updateDevice(id, { status: "running" }), 2000);
  notify("info", `${d.name} customized`, `Now a ${phone.brand} ${phone.model}. The cloud phone restarted.`, `/device/${id}`);
  return { ok: true, phone };
}

/** Turn root on/off; the device reboots to apply it. */
export async function setRoot(id, enabled) {
  if (REMOTE) return rpc("setRoot", [...arguments]);
  const d = state.devices.find((x) => x.id === id);
  if (!d) return { error: "Device not found." };
  const plan = planBySlug(d.planSlug);
  if (!plan.rootAccess) return { error: `Root isn't included in ${plan.name}.` };
  if (["creating", "starting", "stopping"].includes(d.status)) return { error: "Please wait until the device finishes its current operation." };
  updateDevice(id, { status: "starting", statusMessage: null, rooted: !!enabled });
  await wait(1200);
  updateDevice(id, { status: "running" });
  return { ok: true };
}

/** Capture the device screen. Returns { url, width, height, takenAt }; revoke `url` when done. */
export async function takeScreenshot(id) {
  if (REMOTE) return remoteScreenshot(id);
  const d = state.devices.find((x) => x.id === id);
  if (!d) return { error: "Device not found." };
  if (d.status !== "running") return { error: "Turn on the device first." };
  await wait(500);
  const takenAt = new Date();
  const blob = await drawSampleScreenshot(d, takenAt);
  if (!blob) return { error: "Couldn't capture the screen. Try again." };
  return { ok: true, url: URL.createObjectURL(blob), width: SHOT_W, height: SHOT_H, takenAt: takenAt.toISOString() };
}

/** Set the location the device reports to apps. */
export async function setGps(id, { lat, lng, label }) {
  if (REMOTE) return rpc("setGps", [...arguments]);
  const d = state.devices.find((x) => x.id === id);
  if (!d) return { error: "Device not found." };
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return { error: "Latitude must be −90…90 and longitude −180…180." };
  if (["creating", "starting", "stopping"].includes(d.status)) return { error: "Please wait until the device finishes its current operation." };
  await wait();
  const gps = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, label: label?.trim() || null };
  updateDevice(id, { gps });
  set((s) => ({ gpsHistory: [{ id: uid("g"), deviceId: id, deviceName: d.name, ...gps, createdAt: nowIso() }, ...s.gpsHistory] }));
  return { ok: true };
}

/* ---------------- gems ---------------- */

const HOUR = 3_600_000;

/** Add hours to several devices, paid with gems. hoursById: { [deviceId]: hours } */
export async function renewWithGems(hoursById) {
  if (REMOTE) return rpc("renewWithGems", [...arguments]);
  const entries = Object.entries(hoursById).filter(([, h]) => h > 0);
  if (!entries.length) return { error: "Add hours to at least one cloud phone." };
  const items = entries.map(([id, hours]) => ({ device: state.devices.find((d) => d.id === id), hours }));
  if (items.some((i) => !i.device || !Number.isInteger(i.hours))) return { error: "Device not found." };
  const cost = items.reduce((sum, i) => sum + i.hours * planBySlug(i.device.planSlug).gemsPerHour, 0);
  if (cost > state.gems) return { error: `Not enough gems — you need ${cost}, you have ${state.gems}.` };
  await wait();
  const hoursFor = Object.fromEntries(entries);
  set((s) => ({
    gems: s.gems - cost,
    devices: s.devices.map((d) =>
      hoursFor[d.id] ? { ...d, expiresAt: new Date(Math.max(Date.now(), new Date(d.expiresAt).getTime()) + hoursFor[d.id] * HOUR).toISOString() } : d,
    ),
  }));
  const hours = items.reduce((sum, i) => sum + i.hours, 0);
  notify("success", "Renewed with gems", `${hours}h added to ${items.length} cloud phone(s) for ${cost} gems.`);
  return { ok: true, message: `${hours}h added for ${cost} gems.` };
}

/** Buy a new cloud phone for a number of hours, paid with gems. */
export async function buyWithGems({ planSlug, hours, region }) {
  if (REMOTE) return rpc("buyWithGems", [...arguments]);
  const plan = planBySlug(planSlug);
  if (!plan) return { error: "Choose a plan." };
  if (!Number.isInteger(hours) || hours < 1) return { error: "Choose at least 1 hour." };
  if (!REGIONS.some((r) => r.code === region)) return { error: "Choose a server." };
  const cost = hours * plan.gemsPerHour;
  if (cost > state.gems) return { error: `Not enough gems — you need ${cost}, you have ${state.gems}.` };
  await wait();
  const id = uid("dev");
  const android = plan.androidVersions.includes("13") ? "13" : plan.androidVersions[plan.androidVersions.length - 1];
  set((s) => ({
    gems: s.gems - cost,
    devices: [
      ...s.devices,
      { id, name: nextDeviceName(plan, state.devices), status: "creating", statusMessage: null, androidVersion: android, cpu: plan.cpu, ramMb: plan.ramMb, storageGb: plan.storageGb, planSlug: plan.slug, region, phoneModel: null, expiresAt: new Date(Date.now() + hours * HOUR).toISOString() },
    ],
  }));
  setTimeout(() => updateDevice(id, { status: "running" }), 2500);
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
    devices: s.devices.map((d) => ({ ...d, expiresAt: end })),
  }));
  return { ok: true, end, kind: active ? "renew" : "new" };
}

export async function purchasePlan(planSlug, days) {
  if (REMOTE) return rpc("purchasePlan", [...arguments]);
  const plan = planBySlug(planSlug);
  if (!plan) return { error: "That plan is no longer available." };
  const { total } = packagePrice(plan, days);
  if (state.wallet < total) return { error: "Not enough wallet balance. Top up first." };
  await wait();
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
  if (REMOTE) return rpc("redeemCode", [...arguments]);
  const code = raw.toUpperCase().replace(/\s+/g, "");
  await wait();
  const c = state.redeemCodes[code];
  if (!c) return { error: "That code doesn't exist. Check it and try again." };
  if (c.used) return { error: "This code has already been used." };
  if (c.kind !== kind) return { error: kind === "plan" ? "This is a renewal code — use Renew cloud phone instead." : "This code activates a plan — use Add new cloud phone instead." };
  const planSlug = c.kind === "plan" ? c.planSlug : state.subscription?.planSlug;
  if (!planSlug) return { error: "You don't have a plan to renew yet. Redeem a plan code first." };
  const res = extendSubscription(planSlug, c.days);
  if (res.error) return res;
  set((s) => ({
    redeemCodes: { ...s.redeemCodes, [code]: { ...c, used: true } },
    orders: [{ id: uid("o"), kind: res.kind, source: "redeem", status: "paid", planSlug, days: c.days, amount: 0, reference: `${code.slice(0, 4)}••••`, createdAt: nowIso() }, ...s.orders],
  }));
  const plan = planBySlug(planSlug);
  notify("success", `${plan.name} ${c.kind === "plan" ? "activated" : "renewed"}`, `${c.days} day(s) added with a redeem code.`, "/subscriptions");
  return { ok: true, message: `${c.days} day(s) of ${plan.name} added.` };
}

export async function createTopup(amount, bonus, method) {
  if (REMOTE) return rpc("createTopup", [...arguments]);
  if (!(amount >= 1 && amount <= 1000)) return { error: "Enter an amount between $1 and $1000." };
  await wait();
  const reference = `TP-${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
  set((s) => ({ topups: [{ id: uid("tp"), reference, amount, bonus, method, status: "pending", createdAt: nowIso() }, ...s.topups] }));
  return { ok: true, message: reference };
}

export async function cancelTopup(id) {
  if (REMOTE) return rpc("cancelTopup", [...arguments]);
  set((s) => ({ topups: s.topups.map((t) => (t.id === id ? { ...t, status: "canceled" } : t)) }));
  return { ok: true };
}

/** Demo helper: confirm a pending top-up as if the admin/payment provider marked it paid. */
export async function confirmTopup(id) {
  if (REMOTE) return { error: "Top-ups are confirmed by the payment provider or an admin." };
  const t = state.topups.find((x) => x.id === id && x.status === "pending");
  if (!t) return { error: "Already handled." };
  await wait();
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

export function markMessagesRead() {
  if (REMOTE) return void rpc("markMessagesRead", []);
  if (!state.messages.some((m) => !m.readAt)) return;
  set((s) => ({ messages: s.messages.map((m) => (m.readAt ? m : { ...m, readAt: nowIso() })) }));
}

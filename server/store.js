// Persistence: SQLite (node:sqlite) for users, sessions, redeem codes and one state document per user.
// The state document has the same shape the dashboard uses (src/data/mock.js).
//
// Code in logic.js reads `state` and calls `set()` without passing a user around: each request (and every
// background job it starts) runs inside `asUser(userId, …)`, and AsyncLocalStorage routes both to that user.
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { initialState } from "../src/data/mock.js";

export const DATA_DIR = process.env.DATA_DIR ?? path.join(import.meta.dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "jpphone.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS states (user_id TEXT PRIMARY KEY, json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS redeem_codes (
    code TEXT PRIMARY KEY, kind TEXT NOT NULL, plan_slug TEXT, days INTEGER NOT NULL,
    created_at TEXT NOT NULL, used_by TEXT, used_at TEXT
  );
  CREATE TABLE IF NOT EXISTS email_tokens (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER
  );
`);
// Added after the first release; existing databases get the column on start.
if (!db.prepare("PRAGMA table_info(users)").all().some((c) => c.name === "email_verified_at")) {
  db.exec("ALTER TABLE users ADD COLUMN email_verified_at TEXT");
}

/* ---------------- per-user state ---------------- */

const cache = new Map(); // userId -> state (all users are kept in memory; fine for thousands of accounts)
for (const row of db.prepare("SELECT user_id, json FROM states").all()) cache.set(row.user_id, JSON.parse(row.json));

const als = new AsyncLocalStorage();

/** Run `fn` (and everything it awaits or schedules) as this user. */
export const asUser = (userId, fn) => als.run(userId, fn);

function currentId() {
  const id = als.getStore();
  if (!id || !cache.has(id)) throw new Error("No user context.");
  return id;
}

/** The signed-in user's state (read-only view; change it with set()). */
export const state = new Proxy(
  {},
  {
    get: (_, key) => cache.get(currentId())[key],
    has: (_, key) => key in cache.get(currentId()),
  },
);

const dirty = new Set();
let flushTimer = null;
const upsert = db.prepare("INSERT INTO states (user_id, json) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET json = excluded.json");

function flush() {
  flushTimer = null;
  for (const id of dirty) upsert.run(id, JSON.stringify(cache.get(id)));
  dirty.clear();
}

export function set(patch) {
  const id = currentId();
  const prev = cache.get(id);
  cache.set(id, { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) });
  dirty.add(id);
  flushTimer ??= setTimeout(flush, 150);
}

export const publicState = () => cache.get(currentId());

/** New account: empty, or the sample devices/orders when developing with the mock engine. */
export function createUserState(user, { sample }) {
  const seed = initialState();
  const profile = { id: user.id, email: user.email, displayName: user.displayName };
  const base = sample
    ? { ...seed, profile }
    : {
        ...seed,
        profile,
        wallet: 0,
        gems: Number(process.env.SIGNUP_GEMS ?? 0),
        subscription: null,
        subscriptionHistory: [],
        devices: [],
        orders: [],
        transactions: [],
        installs: [],
        uploads: [],
        replacements: [],
        customizations: [],
        gpsHistory: [],
        messages: [{ id: "m-welcome", kind: "info", title: "Welcome!", body: "Top up your wallet, pick a plan, then create your first cloud phone.", link: "/new", readAt: null, createdAt: new Date().toISOString() }],
      };
  delete base.redeemCodes; // codes live in their own table
  cache.set(user.id, base);
  upsert.run(user.id, JSON.stringify(base));
}

export const userIds = () => [...cache.keys()];

/** Every device on the platform (for ADB port allocation). */
export const allDevices = () => [...cache.values()].flatMap((s) => s.devices);

/** Which user owns a top-up, by reference (payment webhooks) or id (admin). */
export function findTopupOwner(match) {
  for (const [userId, s] of cache) {
    const t = s.topups.find(match);
    if (t) return { userId, topup: t };
  }
  return null;
}

process.on("exit", flush);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0));

/* ---------------- redeem codes ---------------- */

export const getCode = (code) => db.prepare("SELECT * FROM redeem_codes WHERE code = ?").get(code);

/** Marks a code used; false if someone else used it first. */
export const useCode = (code, userId) =>
  db.prepare("UPDATE redeem_codes SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL").run(userId, new Date().toISOString(), code).changes === 1;

export function addCode({ code, kind, planSlug, days }) {
  db.prepare("INSERT INTO redeem_codes (code, kind, plan_slug, days, created_at) VALUES (?, ?, ?, ?, ?)").run(code, kind, planSlug ?? null, days, new Date().toISOString());
}

/** Demo codes from the sample data, for local development. */
export function seedDemoCodes() {
  for (const [code, c] of Object.entries(initialState().redeemCodes)) {
    if (!getCode(code)) addCode({ code, kind: c.kind, planSlug: c.planSlug, days: c.days });
  }
}

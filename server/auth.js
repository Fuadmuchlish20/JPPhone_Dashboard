// Accounts and sessions: email + password (scrypt), opaque session token in an httpOnly cookie.
// Only a SHA-256 of the token is stored, so a leaked database can't be replayed as sessions.
import crypto from "node:crypto";
import { promisify } from "node:util";
import { MAIL_PROVIDER, sendResetEmail, sendVerifyEmail } from "./mailer.js";
import { createUserState, db } from "./store.js";

const APP_URL = process.env.APP_URL ?? ""; // public URL used in email links (falls back to the request's host)
// Money and new phones need a confirmed email once real email is configured (override with REQUIRE_VERIFIED_EMAIL=0/1).
export const REQUIRE_VERIFIED_EMAIL = (process.env.REQUIRE_VERIFIED_EMAIL ?? (MAIL_PROVIDER === "console" ? "0" : "1")) === "1";
const VERIFY_TTL_MS = 24 * 3_600_000;
const RESET_TTL_MS = 3_600_000;
const EMAIL_COOLDOWN_MS = 60_000;

const scrypt = promisify(crypto.scrypt);
const COOKIE = "jp_session";
const SESSION_DAYS = 30;
const SECURE = process.env.COOKIE_SECURE === "1"; // set when served over HTTPS
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

async function checkPassword(password, stored) {
  const [, salt, hex] = stored.split("$");
  const key = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(key, Buffer.from(hex, "hex"));
}

/* ---------------- brute-force brake: 10 failed logins per email+IP per 15 min ---------------- */

const failures = new Map();
const WINDOW_MS = 15 * 60_000;

function tooManyFailures(key) {
  const f = failures.get(key);
  if (!f || Date.now() - f.since > WINDOW_MS) return false;
  return f.count >= 10;
}

function recordFailure(key) {
  const f = failures.get(key);
  if (!f || Date.now() - f.since > WINDOW_MS) failures.set(key, { count: 1, since: Date.now() });
  else f.count++;
}

/* ---------------- sessions ---------------- */

function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(sha256(token), userId, expires);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: SECURE, expires: new Date(expires), path: "/" });
}

function readCookie(req) {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** userId for the request's session cookie, or null. Works for plain HTTP and WebSocket upgrades. */
export function sessionUser(req) {
  const token = readCookie(req);
  if (!token) return null;
  const row = db.prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?").get(sha256(token));
  if (!row || row.expires_at < Date.now()) return null;
  return row.user_id;
}

const publicUser = (u) => ({ id: u.id, email: u.email, displayName: u.display_name, emailVerified: Boolean(u.email_verified_at) });

export const isEmailVerified = (userId) => Boolean(db.prepare("SELECT email_verified_at FROM users WHERE id = ?").get(userId)?.email_verified_at);

/* ---------------- one-time email tokens (verify / reset) ---------------- */

function issueToken(userId, kind, ttlMs) {
  db.prepare("DELETE FROM email_tokens WHERE user_id = ? AND kind = ?").run(userId, kind); // only the newest link works
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO email_tokens (token_hash, user_id, kind, expires_at) VALUES (?, ?, ?, ?)").run(sha256(token), userId, kind, Date.now() + ttlMs);
  return token;
}

/** userId for a valid unused token (and marks it used), else null. */
function takeToken(token, kind) {
  if (typeof token !== "string" || token.length > 100) return null;
  const row = db.prepare("SELECT user_id, expires_at, used_at FROM email_tokens WHERE token_hash = ? AND kind = ?").get(sha256(token), kind);
  if (!row || row.used_at || row.expires_at < Date.now()) return null;
  db.prepare("UPDATE email_tokens SET used_at = ? WHERE token_hash = ?").run(Date.now(), sha256(token));
  return row.user_id;
}

const linkFor = (req, path, token) => `${APP_URL || `${req.protocol}://${req.get("host")}`}${path}?token=${token}`;

const lastEmail = new Map(); // key -> time of the last email, to stop link spamming
function coolingDown(key) {
  const at = lastEmail.get(key);
  if (at && Date.now() - at < EMAIL_COOLDOWN_MS) return true;
  lastEmail.set(key, Date.now());
  return false;
}

async function sendVerification(req, user) {
  const url = linkFor(req, "/verify-email", issueToken(user.id, "verify", VERIFY_TTL_MS));
  await sendVerifyEmail(user.email, url).catch((e) => console.error("[mail] verify:", e.message));
}

/* ---------------- route handlers ---------------- */

export async function register(req, res, { sampleData }) {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const name = String(req.body?.name ?? "").trim().slice(0, 40) || email.split("@")[0];
  if (!EMAIL.test(email) || email.length > 120) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8 || password.length > 200) return res.status(400).json({ error: "Use a password of at least 8 characters." });
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) return res.status(409).json({ error: "An account with this email already exists. Sign in instead." });
  const user = { id: crypto.randomUUID(), email, displayName: name };
  db.prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)").run(user.id, email, await hashPassword(password), name, new Date().toISOString());
  createUserState(user, { sample: sampleData });
  startSession(res, user.id);
  coolingDown(`verify|${user.id}`);
  await sendVerification(req, user);
  res.json({ user: { ...user, emailVerified: false } });
}

/** Signed in: send the verification link again. */
export async function resendVerification(req, res) {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(sessionUser(req));
  if (!row) return res.status(401).json({ error: "Please sign in." });
  if (row.email_verified_at) return res.json({ ok: true, alreadyVerified: true });
  if (coolingDown(`verify|${row.id}`)) return res.status(429).json({ error: "We just sent a link. Check your inbox (and spam), or try again in a minute." });
  await sendVerification(req, { id: row.id, email: row.email });
  res.json({ ok: true });
}

/** The link from the verification email. */
export function confirmEmail(req, res) {
  const userId = takeToken(req.body?.token, "verify");
  if (!userId) return res.status(400).json({ error: "This link is invalid or has expired. Send a new one from your dashboard." });
  db.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?").run(new Date().toISOString(), userId);
  res.json({ ok: true });
}

/** Always answers the same, so nobody can probe which emails have accounts. */
export async function forgotPassword(req, res) {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const row = EMAIL.test(email) ? db.prepare("SELECT * FROM users WHERE email = ?").get(email) : null;
  if (row && !coolingDown(`reset|${row.id}`)) {
    const url = linkFor(req, "/reset-password", issueToken(row.id, "reset", RESET_TTL_MS));
    await sendResetEmail(row.email, url).catch((e) => console.error("[mail] reset:", e.message));
  }
  res.json({ ok: true });
}

/** The link from the reset email: set a new password, sign out everywhere else, sign in here. */
export async function resetPassword(req, res) {
  const password = String(req.body?.password ?? "");
  if (password.length < 8 || password.length > 200) return res.status(400).json({ error: "Use a password of at least 8 characters." });
  const userId = takeToken(req.body?.token, "reset");
  if (!userId) return res.status(400).json({ error: "This link is invalid or has expired. Ask for a new one." });
  // Getting the email proves the address, so a reset also verifies it.
  db.prepare("UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?").run(await hashPassword(password), new Date().toISOString(), userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  startSession(res, userId);
  res.json({ ok: true });
}

export async function login(req, res) {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const key = `${email}|${req.ip}`;
  if (tooManyFailures(key)) return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!row || !(await checkPassword(password, row.password_hash))) {
    recordFailure(key);
    return res.status(401).json({ error: "Wrong email or password." });
  }
  failures.delete(key);
  startSession(res, row.id);
  res.json({ user: publicUser(row) });
}

export function logout(req, res) {
  const token = readCookie(req);
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
}

export function me(req, res) {
  const userId = sessionUser(req);
  const row = userId && db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!row) return res.status(401).json({ error: "Not signed in." });
  res.json({ user: publicUser(row) });
}

/** Drop expired sessions and email links (runs hourly). */
export function pruneSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  db.prepare("DELETE FROM email_tokens WHERE expires_at < ?").run(Date.now());
}

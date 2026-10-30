// Top-up payments. With MIDTRANS_SERVER_KEY set, each top-up opens a Midtrans Snap payment page
// (QRIS, GoPay, ShopeePay, cards, bank transfer…) and Midtrans' HTTP notification credits the wallet.
// Without it, top-ups stay "pending" until an admin confirms them (POST /api/admin/topups/:id/confirm).
// Docs: https://docs.midtrans.com/reference/snap-api  ·  notification signature: sha512(order_id + status_code + gross_amount + server_key)
import crypto from "node:crypto";

const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY ?? "";
const PRODUCTION = process.env.MIDTRANS_PRODUCTION === "1";
const SNAP_URL = PRODUCTION ? "https://app.midtrans.com/snap/v1/transactions" : "https://app.sandbox.midtrans.com/snap/v1/transactions";
// Wallet is in USD; Midtrans charges IDR.
const USD_TO_IDR = Number(process.env.USD_TO_IDR ?? 16000);
const APP_URL = process.env.APP_URL ?? ""; // e.g. https://jpphone.example.com — where Snap sends the buyer back

export const PROVIDER = SERVER_KEY ? "midtrans" : "manual";

// Dashboard method id -> Snap enabled_payments. Methods not listed let the buyer pick on the Snap page.
const SNAP_METHODS = {
  qris: ["other_qris"],
  gopay: ["gopay"],
  shopeepay: ["shopeepay"],
  dana: ["dana"],
  visa: ["credit_card"],
  mastercard: ["credit_card"],
};

export const toIdr = (usd) => Math.round(usd * USD_TO_IDR);

/** Create a Snap transaction for a top-up → { payUrl, idrAmount }. Throws with Midtrans' message on failure. */
export async function createCharge(topup, user) {
  const idrAmount = toIdr(topup.amount);
  const body = {
    transaction_details: { order_id: topup.reference, gross_amount: idrAmount },
    item_details: [{ id: "wallet-topup", price: idrAmount, quantity: 1, name: `Wallet top-up $${topup.amount.toFixed(2)}` }],
    customer_details: { email: user.email, first_name: user.displayName },
    ...(SNAP_METHODS[topup.method] ? { enabled_payments: SNAP_METHODS[topup.method] } : {}),
    ...(APP_URL ? { callbacks: { finish: `${APP_URL}/wallet/topup` } } : {}),
    expiry: { unit: "hours", duration: 24 },
  };
  const res = await fetch(SNAP_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${SERVER_KEY}:`).toString("base64")}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.redirect_url) throw new Error(json.error_messages?.join(" ") || `Midtrans error ${res.status}`);
  return { payUrl: json.redirect_url, idrAmount };
}

/**
 * Check a Midtrans HTTP notification. Returns null if the signature is wrong, else
 * { reference, grossAmount, outcome: "paid" | "failed" | "pending" }.
 */
export function readNotification(n) {
  if (!SERVER_KEY || !n?.order_id || !n.signature_key) return null;
  const expected = crypto.createHash("sha512").update(`${n.order_id}${n.status_code}${n.gross_amount}${SERVER_KEY}`).digest("hex");
  const given = String(n.signature_key);
  if (given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;
  const s = n.transaction_status;
  const paid = s === "settlement" || (s === "capture" && n.fraud_status !== "challenge" && n.fraud_status !== "deny");
  const failed = ["deny", "cancel", "expire", "failure"].includes(s);
  return { reference: n.order_id, grossAmount: Math.round(Number(n.gross_amount)), outcome: paid ? "paid" : failed ? "failed" : "pending" };
}

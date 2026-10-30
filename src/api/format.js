import { CURRENCY } from "../config";

export function formatPrice(amount, currency = CURRENCY) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));
}

export function formatRam(mb) {
  return mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB` : `${mb} MB`;
}

export function formatSize(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(mb * 1024))} KB`;
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(iso) {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** "19d left" / "5h left" / "Expired", plus fractional days for thresholds. */
export function timeLeft(expiresAt, now = Date.now()) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return { label: "Expired", days: 0 };
  const days = ms / 86_400_000;
  if (days >= 1) return { label: `${Math.floor(days)}d left`, days };
  return { label: `${Math.max(1, Math.floor(ms / 3_600_000))}h left`, days };
}

/** "23D 4H 32M" */
export function preciseLeft(expiresAt, now = Date.now()) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "Expired";
  const m = Math.floor(ms / 60_000);
  return `${Math.floor(m / 1440)}D ${Math.floor((m % 1440) / 60)}H ${m % 60}M`;
}

// Sample data so the dashboard works without a backend. Replace via src/api/index.js.
const DAY = 86_400_000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

// replacesPerDay / losslessReplace: what the Replace page allows on each plan.
// rootAccess: whether the Root switch is available.
// gemsPerHour: price when renewing or buying with gems (Gem page).
// customizesPerDay / pickModel: Customize page limits; without pickModel the system chooses the phone model.
export const PLANS = [
  { slug: "uvip", name: "UVIP", description: "Popular games support, smooth experience", cpu: 3, ramMb: 3072, storageGb: 30, maxDevices: 1, price: 4.99, periodDays: 30, androidVersions: ["10", "12", "13", "15"], replacesPerDay: 1, losslessReplace: false, customizesPerDay: 1, pickModel: false, gemsPerHour: 50, rootAccess: false },
  { slug: "gvip", name: "GVIP", description: "Bigger RAM, 24/7 AFK", cpu: 3, ramMb: 4096, storageGb: 64, maxDevices: 2, price: 7.99, periodDays: 30, androidVersions: ["10", "12", "13", "15"], replacesPerDay: 2, losslessReplace: false, customizesPerDay: 2, pickModel: false, gemsPerHour: 80, rootAccess: false },
  { slug: "kvip", name: "KVIP", description: "Cost effective, smooth AFK", cpu: 6, ramMb: 5427, storageGb: 64, maxDevices: 3, price: 12.99, periodDays: 30, androidVersions: ["10", "12", "13", "15"], replacesPerDay: 3, losslessReplace: true, customizesPerDay: 3, pickModel: true, gemsPerHour: 150, rootAccess: true },
  { slug: "mvip", name: "MVIP", description: "Higher performance, stable AFK", cpu: 8, ramMb: 8192, storageGb: 128, maxDevices: 8, price: 24.99, periodDays: 30, androidVersions: ["10", "12", "13", "15"], replacesPerDay: 5, losslessReplace: true, customizesPerDay: 5, pickModel: true, gemsPerHour: 250, rootAccess: true },
  { slug: "svip", name: "SVIP", description: "Premium RAM, stable AFK", cpu: 8, ramMb: 16384, storageGb: 200, maxDevices: 8, price: 39.99, periodDays: 30, androidVersions: ["10", "12", "13", "15"], replacesPerDay: 5, losslessReplace: true, customizesPerDay: 10, pickModel: true, gemsPerHour: 400, rootAccess: true },
];

/** Default device name like Redfinger: plan name + the lowest free number ("KVIP-1", "KVIP-2", …). */
export function nextDeviceName(plan, devices) {
  const taken = new Set(devices.map((d) => d.name));
  let n = 1;
  while (taken.has(`${plan.name}-${n}`)) n++;
  return `${plan.name}-${n}`;
}

// Card tints per plan (.dm-<theme> in styles.css).
export const PLAN_THEMES = { uvip: "slate", gvip: "bronze", kvip: "violet", mvip: "teal", svip: "rose" };

export const REGIONS = [
  { code: "id", name: "Indonesia", latencyMs: 35, lat: -6.2088, lng: 106.8456 },
  { code: "sg", name: "Singapore", latencyMs: 40, lat: 1.2903, lng: 103.8519 },
  { code: "hk", name: "Hong Kong", latencyMs: 61, lat: 22.3193, lng: 114.1694 },
  { code: "jp", name: "Japan", latencyMs: 74, lat: 35.6762, lng: 139.6503 },
  { code: "us", name: "USA", latencyMs: 182, lat: 37.7749, lng: -122.4194 },
];

export function initialState() {
  return {
    profile: { id: "19708237-0000-4000-8000-000000000000", email: "xio.jue@example.com", displayName: "Xio Jue" },
    wallet: 12.5,
    gems: 480,
    subscription: { planSlug: "mvip", start: iso(-10 * DAY), end: iso(20 * DAY), status: "active" },
    subscriptionHistory: [
      { id: "s2", planSlug: "kvip", start: iso(-40 * DAY), end: iso(-10 * DAY), status: "canceled" },
      { id: "s1", planSlug: "uvip", start: iso(-80 * DAY), end: iso(-50 * DAY), status: "expired" },
    ],
    devices: [
      device(1, "MVIP-1", "running", 20 * DAY),
      device(2, "MVIP-2", "running", 20 * DAY),
      device(3, "MVIP-3", "starting", 20 * DAY),
      device(4, "MVIP-4", "stopped", 2 * DAY),
      device(5, "MVIP-5", "running", 5 * 3_600_000),
      device(6, "MVIP-6", "error", 12 * DAY, "Boot timed out after 180s"),
    ],
    orders: [
      order("o4", "renew", "redeem", "mvip", 7, 0, 2, "K7QM••••"),
      order("o3", "new", "admin", "mvip", 30, 0, 10),
      order("o2", "new", "redeem", "kvip", 30, 0, 40, "TX4P••••"),
      order("o1", "new", "payment", "uvip", 30, 4.99, 80),
    ],
    messages: [
      message("m4", "warning", "MVIP-4 expires soon", "Your plan ends in 2 days. Renew to keep your devices running.", 0.05, false, "/redeem?type=renew"),
      message("m3", "success", "MVIP renewed", "7 day(s) added with a redeem code.", 2, false, "/subscriptions"),
      message("m2", "success", "MVIP activated", "Your MVIP plan is active.", 10, true, "/subscriptions"),
      message("m1", "info", "Welcome!", "Create your first cloud phone from the dashboard.", 40, true),
    ],
    transactions: [
      tx("t3", "purchase", -24.99, 12.5, "MVIP · 30 days", 10),
      tx("t2", "topup", 30, 37.49, "Bank transfer", 11),
      tx("t1", "topup", 7.49, 7.49, "Promo credit", 40),
    ],
    topups: [],
    customizations: [],
    gpsHistory: [
      { id: "g1", deviceId: "dev-1", deviceName: "MVIP-1", lat: -6.175392, lng: 106.827153, label: "Monas, Jakarta", createdAt: iso(-1 * DAY) },
    ],
    uploads: [
      { id: "u1", deviceId: "dev-1", deviceName: "MVIP-1", name: "macro-config.json", sizeMb: 0.2, status: "done", createdAt: iso(-2 * DAY) },
    ],
    installs: [
      { id: "i2", deviceId: "dev-1", deviceName: "MVIP-1", app: "Lineage II", source: "store", status: "installed", createdAt: iso(-1 * DAY) },
      { id: "i1", deviceId: "dev-2", deviceName: "MVIP-2", app: "Lineage II", source: "store", status: "installed", createdAt: iso(-1 * DAY) },
    ],
    replacements: [
      { id: "r1", deviceId: "dev-4", deviceName: "MVIP-4", planSlug: "mvip", fromAndroid: "12", toAndroid: "13", fromRegion: "sg", toRegion: "id", lossless: true, createdAt: iso(-3 * DAY) },
    ],
    // Demo redeem codes you can try on the Redeem page.
    redeemCodes: {
      "DEMO-PLAN-2026": { kind: "plan", planSlug: "mvip", days: 30, used: false },
      "DEMO-RENEW-7D": { kind: "renew", planSlug: null, days: 7, used: false },
    },
  };

  function device(i, name, status, expiresIn, statusMessage = null) {
    return {
      id: `dev-${i}`,
      name,
      status,
      statusMessage,
      androidVersion: "13",
      cpu: 8,
      ramMb: 8192,
      storageGb: 128,
      planSlug: "mvip",
      region: "id",
      rooted: i === 1,
      gps: i === 1 ? { lat: -6.175392, lng: 106.827153, label: "Monas, Jakarta" } : null, // null = server location
      phoneModel: i === 1 ? { brand: "Samsung", model: "Galaxy S23" } : null, // null = generated by the system
      expiresAt: iso(expiresIn),
    };
  }
  function order(id, kind, source, planSlug, days, amount, ago, reference = null) {
    return { id, kind, source, status: "paid", planSlug, days, amount, reference, createdAt: iso(-ago * DAY) };
  }
  function message(id, kind, title, body, ago, read, link = null) {
    return { id, kind, title, body, link, readAt: read ? iso(-ago * DAY) : null, createdAt: iso(-ago * DAY) };
  }
  function tx(id, kind, amount, balanceAfter, note, ago) {
    return { id, kind, amount, balanceAfter, note, createdAt: iso(-ago * DAY) };
  }
}

// Rental lengths and the active promotion. Keep in sync with the backend's pricing.
export const PACKAGES = [
  { days: 3, factor: 1.4 },
  { days: 7, factor: 1.25 },
  { days: 30, factor: 1 },
  { days: 90, factor: 0.9 },
];

export const PACKAGE_BADGES = { 30: "Recommend", 90: "Best Value" };

/** Percent off the regular price that checkout actually charges (0 = no promo). */
export const DISCOUNT_PERCENT = 20;

const round = (n) => Math.round(n * 100) / 100;

export function packagePrice(plan, days) {
  const pkg = PACKAGES.find((p) => p.days === days) ?? { days, factor: 1 };
  const daily = plan.price / plan.periodDays;
  const regular = round(daily * days * pkg.factor);
  const total = round((regular * (100 - DISCOUNT_PERCENT)) / 100);
  return { total, regular, perDay: total / days, discountPct: DISCOUNT_PERCENT, savePct: Math.round((1 - pkg.factor) * 100) };
}

// Top-up options shown on the Top-up page. Bonuses apply only to the exact preset amount.
export const TOPUP_MIN = 1;
export const TOPUP_MAX = 1000;

export const TOPUP_PRESETS = [
  { amount: 3.09, bonus: 0 },
  { amount: 6.99, bonus: 0.69 },
  { amount: 9.99, bonus: 0 },
  { amount: 12.99, bonus: 0 },
  { amount: 21.99, bonus: 2.09 },
  { amount: 31.99, bonus: 0 },
];

/** `color` tints the method chip; names are shown as text. */
export const PAYMENT_METHODS = [
  { id: "dana", name: "DANA", color: "#118EEA" },
  { id: "qris", name: "QRIS", color: "#E21F26" },
  { id: "ovo", name: "OVO", color: "#4C3494" },
  { id: "gopay", name: "GoPay", color: "#00AED6" },
  { id: "shopeepay", name: "ShopeePay", color: "#EE4D2D" },
  { id: "visa", name: "VISA", color: "#1A1F71" },
  { id: "mastercard", name: "Mastercard", color: "#EB001B" },
  { id: "paypal", name: "PayPal", color: "#003087" },
  { id: "applepay", name: "Apple Pay", color: "#000000" },
  { id: "alipay", name: "Alipay HK", color: "#1677FF" },
];

export const bonusFor = (amount) => TOPUP_PRESETS.find((p) => p.amount === amount)?.bonus ?? 0;
export const roundMoney = (n) => Math.round(n * 100) / 100;

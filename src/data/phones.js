// Phone models a cloud phone can present itself as (Customize page). Keep in sync with the backend's device profiles.
export const PHONE_MODELS = {
  Samsung: ["Galaxy S24 Ultra", "Galaxy S23", "Galaxy A54 5G", "Galaxy Z Fold5"],
  Xiaomi: ["Xiaomi 14", "Xiaomi 13T Pro", "Redmi Note 13 Pro", "POCO F5"],
  Google: ["Pixel 8 Pro", "Pixel 7a"],
  OnePlus: ["OnePlus 12", "OnePlus 11"],
  OPPO: ["Find X7", "Reno11 5G"],
  vivo: ["X100 Pro", "V30"],
  ASUS: ["ROG Phone 8", "Zenfone 10"],
};

export const PHONE_BRANDS = Object.keys(PHONE_MODELS);

export const APP_DATA_OPTIONS = [
  { value: "keep", label: "Keep All", hint: "Apps and their data stay on the cloud phone." },
  { value: "apps", label: "Keep apps, clear app data", hint: "Apps stay installed but you'll need to log in again." },
  { value: "clear", label: "Clear All", hint: "All apps and data are erased." },
];

/** Picks a concrete model; brand "" = any brand. */
export function randomPhone(brand = "") {
  const b = brand || PHONE_BRANDS[Math.floor(Math.random() * PHONE_BRANDS.length)];
  const models = PHONE_MODELS[b];
  return { brand: b, model: models[Math.floor(Math.random() * models.length)] };
}

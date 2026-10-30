import { BRAND } from "../config";

/** Brand mark: a red phone with signal waves on a dark tile. Keep in sync with public/icon.svg. */
export function LogoMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo-mark">
      <rect width="32" height="32" rx="9" fill="#161616" />
      <rect x="8" y="6.5" width="11.5" height="19" rx="3" fill="none" stroke="#fa003f" strokeWidth="2.2" />
      <rect x="12" y="21.4" width="3.5" height="1.6" rx=".8" fill="#fa003f" />
      <path d="M22.5 11.2a5 5 0 0 1 0 7.6" fill="none" stroke="#fa003f" strokeWidth="2" strokeLinecap="round" />
      <path d="M25.2 8.6a8.6 8.6 0 0 1 0 12.8" fill="none" stroke="#fa003f" strokeWidth="2" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

export function Logo() {
  return (
    <>
      <LogoMark />
      <span className="logo-word">
        {BRAND.first}
        <span>{BRAND.second}</span>
      </span>
    </>
  );
}

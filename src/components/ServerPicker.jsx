import { REGIONS } from "../api";
import { speed, useLatency } from "../api/latency";

/** Server buttons with a latency badge (green < 60 ms, amber < 120 ms, red above) — measured live with the backend. */
export function ServerPicker({ value, onChange }) {
  const latency = useLatency();
  return (
    <div className="nd-grid3 rp-grid">
      {REGIONS.map((r) => {
        const { ms, live } = latency[r.code];
        return (
          <button
            key={r.code}
            className={`nd-opt rp-server${r.code === value ? " is-active" : ""}`}
            onClick={() => onChange(r.code)}
            aria-pressed={r.code === value}
            aria-label={`${r.name}, ${live ? "" : "about "}${ms} ms`}
            title={live ? "Measured from your browser" : "Estimated"}
          >
            <span className={`rp-ms rp-ms-${speed(ms)}`} aria-hidden>
              {live ? "" : "~"}
              {ms} ms
            </span>
            {r.name}
          </button>
        );
      })}
    </div>
  );
}

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PLANS, PLAN_THEMES, planBySlug, regionName, replaceDevice, replacesToday, useStore } from "../api";
import { formatDate } from "../api/format";
import { TRANSITIONAL } from "../components/DeviceCard";
import { DevicePicker } from "../components/DevicePicker";
import { ArrowLeftIcon, CheckIcon, SwapIcon } from "../components/Icons";
import { ServerPicker } from "../components/ServerPicker";
import NotFound from "./NotFound";

/** Replace a cloud phone with a fresh one: pick Android version + server; limits come from the device's plan. */
export default function Replace() {
  const { id } = useParams();
  const { devices, replacements } = useStore();
  const [showHistory, setShowHistory] = useState(false);
  const device = devices.find((d) => d.id === id);

  if (!device) return <NotFound />;
  const theme = PLAN_THEMES[device.planSlug] ?? "slate";

  return (
    <div className={`nd nd-v2 rp dm-${theme}`}>
      <header className="nd-top">
        <Link to="/" className="nd-top-btn" aria-label="Back to devices">
          <ArrowLeftIcon />
        </Link>
        <h1>{showHistory ? "Replace history" : "Replace"}</h1>
        <button className="rp-history-btn" onClick={() => setShowHistory((v) => !v)} aria-pressed={showHistory}>
          {showHistory ? "Back" : "History"}
        </button>
      </header>

      {showHistory ? (
        <History replacements={replacements} />
      ) : (
        <ReplaceForm key={device.id} device={device} devices={devices} replacements={replacements} />
      )}
    </div>
  );
}

function ReplaceForm({ device, devices, replacements }) {
  const plan = planBySlug(device.planSlug);
  const versions = [...plan.androidVersions].sort((a, b) => Number(a) - Number(b));
  const [android, setAndroid] = useState(versions.includes(device.androidVersion) ? device.androidVersion : versions[versions.length - 1]);
  const [region, setRegion] = useState(device.region);
  const [lossless, setLossless] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  const used = replacesToday(replacements, device.id);
  const left = Math.max(0, plan.replacesPerDay - used);
  const expired = new Date(device.expiresAt) < new Date();
  const busy = TRANSITIONAL.has(device.status);
  const blocked = expired ? "Your plan has expired. Renew to replace this device." : busy ? "Please wait until the device finishes its current operation." : left === 0 ? "Daily replacement limit reached. Please try again tomorrow." : null;
  const losslessPlans = PLANS.filter((p) => p.losslessReplace).map((p) => p.name);
  // Apps can only be kept on the same server; moving regions always starts fresh.
  const moving = region !== device.region;
  const keepApps = lossless && plan.losslessReplace && !moving;

  async function submit() {
    if (!keepApps && !window.confirm(`All apps and data on "${device.name}" will be erased. Continue?`)) return;
    setPending(true);
    setResult(null);
    const res = await replaceDevice(device.id, { android, region, lossless: keepApps });
    setPending(false);
    setResult(res.ok ? { ok: true, message: `${device.name} is being replaced — Android ${android}, ${regionName(region)}.` } : res);
  }

  return (
    <>
      <div className="nd-body">
        <Field title="Please choose cloud phone">
          <DevicePicker device={device} devices={devices} pathFor={(id) => `/device/${id}/replace`} />
        </Field>

        <Field title="Please select system version">
          <div className="nd-grid3 rp-grid">
            {versions.map((v) => (
              <button key={v} className={`nd-opt${v === android ? " is-active" : ""}`} onClick={() => setAndroid(v)} aria-pressed={v === android}>
                Android {v}
                {v === device.androidVersion && <small className="rp-current">Current</small>}
              </button>
            ))}
          </div>
          {Number(android) < 11 && <p className="nd-hint">Android {android} has no in-browser audio (requires Android 11+).</p>}
        </Field>

        <Field title="Please choose server">
          <ServerPicker value={region} onChange={setRegion} />
        </Field>

        <section className="nd-field">
          <label className={`rp-lossless${plan.losslessReplace && !moving ? "" : " is-locked"}`}>
            <input type="checkbox" checked={keepApps} disabled={!plan.losslessReplace || moving} onChange={(e) => setLossless(e.target.checked)} />
            <span>
              <strong>Lossless Replacement</strong>
              <small>{moving ? "Not available when moving to another server — the new cloud phone starts fresh." : plan.losslessReplace ? "Keep the current cloud phone apps in the new cloud phone." : `Not included in ${plan.name} — available on ${losslessPlans.join(", ")}.`}</small>
            </span>
          </label>
        </section>

        <section className="nd-field rp-rules">
          <h2>Rules</h2>
          <ol>
            <li>You get a brand-new cloud phone with the version and server above. Its remaining time stays the same.</li>
            <li>Without Lossless Replacement, all apps and data on the current device are erased. Please operate with caution.</li>
            <li>
              Each device can be replaced <b>{plan.replacesPerDay}× per day</b> on {plan.name} (
              {PLANS.map((p) => `${p.name} ${p.replacesPerDay}×`).join(" · ")}). The limit resets at midnight.
            </li>
            <li>Lossless Replacement is available on {losslessPlans.join(", ")}.</li>
          </ol>
          <p className="rp-quota">
            Replacements left today: <b>{left}</b>/{plan.replacesPerDay}
          </p>
        </section>
      </div>

      <footer className="nd-bar">
        {result?.error && <p className="nd-error">{result.error}</p>}
        {result?.ok && <p className="nd-success">{result.message}</p>}
        {!result && blocked && <p className="nd-error">{blocked}</p>}
        <button className="nd-buy" disabled={pending || !!blocked} onClick={submit}>
          {pending ? "Replacing…" : "Replace"}
        </button>
      </footer>
    </>
  );
}

function History({ replacements }) {
  if (!replacements.length) return <p className="muted rp-empty">No replacements yet.</p>;
  return (
    <ul className="rp-history">
      {replacements.map((r) => (
        <li key={r.id}>
          <span className="rp-history-icon" aria-hidden>
            <SwapIcon />
          </span>
          <div>
            <strong>
              {r.deviceName} <em>{planBySlug(r.planSlug)?.name}</em>
              {r.lossless && (
                <em className="rp-tag-lossless">
                  <CheckIcon /> Lossless
                </em>
              )}
            </strong>
            <span>
              Android {r.fromAndroid} → {r.toAndroid} · {regionName(r.fromRegion)} → {regionName(r.toRegion)}
            </span>
          </div>
          <time dateTime={r.createdAt}>
            {formatDate(r.createdAt)}{" "}
            {new Date(r.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </time>
        </li>
      ))}
    </ul>
  );
}

function Field({ title, children }) {
  return (
    <section className="nd-field">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

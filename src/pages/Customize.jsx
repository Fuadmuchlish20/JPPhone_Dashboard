import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PLANS, PLAN_THEMES, customizeDevice, planBySlug, useStore } from "../api";
import { TRANSITIONAL } from "../components/DeviceCard";
import { DevicePicker } from "../components/DevicePicker";
import { ArrowLeftIcon } from "../components/Icons";
import { APP_DATA_OPTIONS, PHONE_BRANDS, PHONE_MODELS, randomPhone } from "../data/phones";
import NotFound from "./NotFound";

const modelLabel = (d) => (d.phoneModel ? `${d.phoneModel.brand} ${d.phoneModel.model}` : "System generated");

/** One-click reset of the phone identity: model the device presents + what happens to app data. */
export default function Customize() {
  const { id } = useParams();
  const { devices, customizations } = useStore();
  const device = devices.find((d) => d.id === id);

  if (!device) return <NotFound />;
  const theme = PLAN_THEMES[device.planSlug] ?? "slate";

  return (
    <div className={`nd nd-v2 rp cz dm-${theme}`}>
      <header className="nd-top">
        <Link to="/" className="nd-top-btn" aria-label="Back to devices">
          <ArrowLeftIcon />
        </Link>
        <h1>Customize</h1>
        <span />
      </header>
      <CustomizeForm key={device.id} device={device} devices={devices} customizations={customizations} />
    </div>
  );
}

function CustomizeForm({ device, devices, customizations }) {
  const plan = planBySlug(device.planSlug);
  const [brand, setBrand] = useState(""); // "" = Random
  const [model, setModel] = useState("");
  const [appData, setAppData] = useState("keep");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  const today = new Date().toDateString();
  const used = customizations.filter((c) => c.deviceId === device.id && new Date(c.createdAt).toDateString() === today).length;
  const left = Math.max(0, plan.customizesPerDay - used);
  const expired = new Date(device.expiresAt) < new Date();
  const busy = TRANSITIONAL.has(device.status);
  const blocked = expired ? "Your plan has expired. Renew to customize this device." : busy ? "Please wait until the device finishes its current operation." : left === 0 ? "Daily customize limit reached. Please try again tomorrow." : null;
  const pickPlans = PLANS.filter((p) => p.pickModel).map((p) => p.name);
  const option = APP_DATA_OPTIONS.find((o) => o.value === appData);

  function pickBrand(b) {
    setBrand(b);
    setModel("");
    setResult(null);
  }

  function shuffle() {
    const p = randomPhone();
    setBrand(p.brand);
    setModel(p.model);
    setResult(null);
  }

  async function submit() {
    if (appData !== "keep" && !window.confirm(`${option.hint} Continue?`)) return;
    setPending(true);
    setResult(null);
    const res = await customizeDevice(device.id, { brand, model, appData });
    setPending(false);
    setResult(res.ok ? { ok: true, message: `Saved — ${device.name} is now a ${res.phone.brand} ${res.phone.model} and is restarting.` } : res);
  }

  return (
    <>
      <div className="nd-body">
        <section className="nd-field">
          <h2>Please choose cloud phone</h2>
          <DevicePicker device={device} devices={devices} pathFor={(id) => `/device/${id}/customize`} detail={modelLabel} />
        </section>

        <section className="nd-field">
          <h2>Phone Model</h2>
          <div className="cz-model">
            <select value={brand} onChange={(e) => pickBrand(e.target.value)} disabled={!plan.pickModel} aria-label="Brand">
              <option value="">Random</option>
              {PHONE_BRANDS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!plan.pickModel || !brand} aria-label="Model">
              <option value="">Random</option>
              {(PHONE_MODELS[brand] ?? []).map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <button className="cz-random" onClick={shuffle} disabled={!plan.pickModel}>
              Random
            </button>
          </div>
          {!plan.pickModel && (
            <p className="nd-hint">
              On {plan.name} the system picks the phone model. Choosing a brand and model is available on {pickPlans.join(", ")}.
            </p>
          )}
        </section>

        <section className="nd-field">
          <h2>APP Data Options</h2>
          <select className="cz-select" value={appData} onChange={(e) => setAppData(e.target.value)} aria-label="App data">
            {APP_DATA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className={appData === "keep" ? "nd-hint" : "nd-note cz-warn"}>{option.hint}</p>
          <p className="nd-hint">The cloud phone will automatically restart after completing the one-click reset.</p>
        </section>

        <div className="cz-actions">
          <button className="cz-system" onClick={() => pickBrand("")} disabled={!brand}>
            All generate by system
          </button>
          {result?.error && <p className="nd-error">{result.error}</p>}
          {result?.ok && <p className="nd-success">{result.message}</p>}
          {!result && blocked && <p className="nd-error">{blocked}</p>}
          <button className="cz-save" disabled={pending || !!blocked} onClick={submit}>
            {pending ? "Saving…" : "SAVE"}
          </button>
        </div>

        <p className="cz-quota">
          Current model: <b>{modelLabel(device)}</b> · Customizations left today: <b>{left}</b>/{plan.customizesPerDay}
        </p>
      </div>
    </>
  );
}

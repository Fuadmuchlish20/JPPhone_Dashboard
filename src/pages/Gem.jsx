import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PLANS, PLAN_THEMES, REGIONS, buyWithGems, planBySlug, renewWithGems, useStore } from "../api";
import { preciseLeft } from "../api/format";
import { ArrowLeftIcon, GemIcon, RestartIcon } from "../components/Icons";
import { ServerPicker } from "../components/ServerPicker";

const QUICK_HOURS = [1, 6, 12, 24];

/** Spend gems on cloud phone time: renew existing devices hour by hour, or buy a new one. Rates come from each plan. */
export default function Gem() {
  const [params] = useSearchParams();
  const { devices, gems } = useStore();
  const focusId = params.get("device");
  const [tab, setTab] = useState(params.get("tab") === "new" ? "new" : "renew");

  // "≈ hours" is quoted at the rate of the device we came from (or the first one / the cheapest plan).
  const refPlan = planBySlug((devices.find((d) => d.id === focusId) ?? devices[0])?.planSlug) ?? PLANS[0];
  const approxHours = Math.floor((gems / refPlan.gemsPerHour) * 10) / 10;

  return (
    <div className="nd nd-v2 rp gm dm-lime">
      <header className="nd-top">
        <Link to="/" className="nd-top-btn" aria-label="Back to devices">
          <ArrowLeftIcon />
        </Link>
        <h1>Redeem</h1>
        <span />
      </header>

      <div className="gm-balance">
        <GemIcon />
        <strong>{gems}</strong>
        <span title={`At the ${refPlan.name} rate of ${refPlan.gemsPerHour} gems per hour`}>
          Total ≈{approxHours}h <small>on {refPlan.name}</small>
        </span>
      </div>

      <div className="ia-tabs" role="tablist" aria-label="Redeem for">
        {[
          ["renew", "Renew Cloud Phone"],
          ["new", "New Cloud Phone"],
        ].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`ia-tab${tab === k ? " is-active" : ""}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "renew" ? <RenewTab devices={devices} gems={gems} focusId={focusId} /> : <NewTab gems={gems} />}
    </div>
  );
}

function RenewTab({ devices, gems, focusId }) {
  const [hours, setHours] = useState({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  const rate = (d) => planBySlug(d.planSlug).gemsPerHour;
  const cost = devices.reduce((sum, d) => sum + (hours[d.id] ?? 0) * rate(d), 0);
  const list = [...devices].sort((a, b) => (b.id === focusId) - (a.id === focusId));

  function change(d, delta) {
    setResult(null);
    setHours((h) => ({ ...h, [d.id]: Math.max(0, (h[d.id] ?? 0) + delta) }));
  }

  async function submit() {
    setPending(true);
    setResult(null);
    const res = await renewWithGems(hours);
    setPending(false);
    setResult(res);
    if (res.ok) setHours({});
  }

  return (
    <>
      <div className="nd-body">
        <div className="gm-usage">
          <span>
            Est. usage: <b>{cost}</b> gems
          </span>
          <button className="gm-reset" onClick={() => setHours({})} disabled={!cost}>
            <RestartIcon /> Reset
          </button>
        </div>
        <ul className="gm-list">
          {list.map((d) => {
            const plan = planBySlug(d.planSlug);
            const h = hours[d.id] ?? 0;
            const canAdd = cost + plan.gemsPerHour <= gems;
            return (
              <li key={d.id} className={`gm-row dm-${planTheme(d)}${d.id === focusId ? " is-focus" : ""}`}>
                <button className={`gm-radio${h ? " is-on" : ""}`} onClick={() => change(d, h ? -h : 1)} disabled={!h && !canAdd} aria-pressed={!!h} aria-label={`Select ${d.name}`} />
                <span className="gm-name">
                  <strong>
                    <span className="gm-badge" aria-hidden>
                      {plan.name.charAt(0)}
                    </span>
                    {d.name} <em>{plan.name}</em>
                  </strong>
                  <small>
                    Time left: {preciseLeft(d.expiresAt)} · {plan.gemsPerHour} gems/h
                  </small>
                </span>
                <span className="gm-step">
                  <button onClick={() => change(d, -1)} disabled={!h} aria-label={`One hour less for ${d.name}`}>
                    −
                  </button>
                  <output aria-live="polite">{h}h</output>
                  <button onClick={() => change(d, 1)} disabled={!canAdd} aria-label={`One hour more for ${d.name}`}>
                    +
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <footer className="nd-bar">
        {result?.error && <p className="nd-error">{result.error}</p>}
        {result?.ok && <p className="nd-success">{result.message}</p>}
        <button className="nd-buy" disabled={pending || !cost} onClick={submit}>
          {pending ? "Redeeming…" : cost ? `Confirm · ${cost} gems` : "Confirm"}
        </button>
      </footer>
    </>
  );
}

function NewTab({ gems }) {
  const [slug, setSlug] = useState(PLANS[0].slug);
  const [region, setRegion] = useState(REGIONS[0].code);
  const [hours, setHours] = useState(1);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  const plan = planBySlug(slug);
  const cost = hours * plan.gemsPerHour;
  const maxHours = Math.floor(gems / plan.gemsPerHour);

  async function submit() {
    setPending(true);
    setResult(null);
    const res = await buyWithGems({ planSlug: slug, hours, region });
    setPending(false);
    setResult(res);
  }

  return (
    <>
      <div className="nd-body">
        <section className="nd-field">
          <h2>Plan</h2>
          <div className="nd-grid3 gm-plans">
            {PLANS.map((p) => (
              <button
                key={p.slug}
                className={`nd-opt${p.slug === slug ? " is-active" : ""}`}
                onClick={() => {
                  setSlug(p.slug);
                  setResult(null);
                }}
                aria-pressed={p.slug === slug}
              >
                <b>{p.name}</b>
                <small>{p.gemsPerHour} gems/h</small>
              </button>
            ))}
          </div>
        </section>

        <section className="nd-field">
          <h2>Server</h2>
          <ServerPicker value={region} onChange={setRegion} />
        </section>

        <section className="nd-field">
          <h2>Duration</h2>
          <div className="gm-duration">
            <span className="gm-step gm-step-lg">
              <button onClick={() => setHours((h) => Math.max(1, h - 1))} disabled={hours <= 1} aria-label="One hour less">
                −
              </button>
              <output aria-live="polite">{hours}h</output>
              <button onClick={() => setHours((h) => h + 1)} disabled={hours + 1 > maxHours} aria-label="One hour more">
                +
              </button>
            </span>
            <div className="gm-quick">
              {QUICK_HOURS.map((q) => (
                <button key={q} className={hours === q ? "is-active" : undefined} onClick={() => setHours(q)} disabled={q > maxHours}>
                  {q}h
                </button>
              ))}
            </div>
          </div>
          <p className="nd-hint">
            {plan.name}: {plan.cpu} cores · {Math.round(plan.ramMb / 1024)} GB RAM · {plan.storageGb} GB. Your gems cover up to {maxHours}h on this plan.
          </p>
        </section>
      </div>

      <footer className="nd-bar">
        {result?.error && <p className="nd-error">{result.error}</p>}
        {result?.ok && <p className="nd-success">{result.message}</p>}
        <button className="nd-buy" disabled={pending || cost > gems} onClick={submit}>
          {pending ? "Redeeming…" : cost > gems ? `Not enough gems (${cost} needed)` : `Confirm · ${cost} gems`}
        </button>
      </footer>
    </>
  );
}

const planTheme = (d) => PLAN_THEMES[d.planSlug] ?? "slate";

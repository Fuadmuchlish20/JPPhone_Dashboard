import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PLANS, PLAN_THEMES, REGIONS, createDevice, planBySlug, purchasePlan, useStore } from "../api";
import { nextDeviceName } from "../data/mock";
import { formatDate, formatPrice, formatRam } from "../api/format";
import { PACKAGES, PACKAGE_BADGES, packagePrice } from "../api/pricing";
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, GamepadIcon, HeadsetIcon } from "../components/Icons";
import { ServerPicker } from "../components/ServerPicker";
import { GAMES, gamesForPlan } from "../data/games";

export default function NewDevice() {
  const navigate = useNavigate();
  const { subscription, devices, wallet } = useStore();
  const subActive = !!subscription && new Date(subscription.end) > new Date();
  const subPlan = subActive ? planBySlug(subscription.planSlug) : null;

  const [slug, setSlug] = useState(() => subPlan?.slug ?? PLANS[1].slug);
  const [region, setRegion] = useState(REGIONS[0].code);
  const [days, setDays] = useState(30);
  const [useSlot, setUseSlot] = useState(true); // on the current plan with room: create for free instead of buying
  const [androidPick, setAndroidPick] = useState("13");
  const [name, setName] = useState("");
  const [gamesOpen, setGamesOpen] = useState(false);
  const [game, setGame] = useState(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  const plan = planBySlug(slug) ?? PLANS[0];
  const onCurrentPlan = !!subPlan && subPlan.slug === plan.slug;
  const slotsLeft = subPlan ? subPlan.maxDevices - devices.length : 0;
  const included = onCurrentPlan && slotsLeft > 0;
  const free = included && useSlot;
  const versions = useMemo(() => [...plan.androidVersions].sort((a, b) => Number(a) - Number(b)), [plan]);
  // Keep the user's pick when the new plan offers it; otherwise prefer 13, then the newest.
  const android = versions.includes(androidPick) ? androidPick : versions.includes("13") ? "13" : versions[versions.length - 1];

  const allGames = useMemo(() => {
    const keys = new Set();
    PLANS.forEach((p) => gamesForPlan(p.slug).forEach((k) => keys.add(k)));
    return [...keys];
  }, []);

  function pickPlan(s) {
    setSlug(s);
    setUseSlot(true);
    setResult(null);
  }

  function pickGame(k) {
    setGame(k);
    // Cheapest plan (plans are sorted) whose list includes the game.
    const best = PLANS.find((p) => gamesForPlan(p.slug).includes(k));
    if (best) pickPlan(best.slug);
    setGamesOpen(false);
  }

  async function submit() {
    setPending(true);
    setResult(null);
    const res = free ? await createDevice({ name, region, android }) : await purchasePlan(plan.slug, days);
    setPending(false);
    if (free && res.ok) navigate("/");
    else setResult(res);
  }

  const price = packagePrice(plan, days);
  const theme = PLAN_THEMES[plan.slug] ?? "slate";
  const ramLabel = formatRam(plan.ramMb).replace(" ", "");

  return (
    <div className={`nd nd-v2 dm-${theme}`}>
      <header className="nd-top">
        <Link to="/" className="nd-top-btn" aria-label="Back to devices">
          <ArrowLeftIcon />
        </Link>
        <h1>Buy device</h1>
        <Link to="/support" className="nd-top-btn" aria-label="Support">
          <HeadsetIcon />
        </Link>
      </header>

      <div className="nd-body">
        {/* plan tabs */}
        <div className="nd-ptabs" role="tablist" aria-label="Plan">
          {PLANS.map((p) => (
            <button
              key={p.slug}
              role="tab"
              aria-selected={p.slug === slug}
              className={`nd-ptab${p.slug === slug ? " is-active" : ""}`}
              onClick={() => pickPlan(p.slug)}
            >
              {p.name}
              {subPlan?.slug === p.slug && <span className="nd-ptab-badge">Current</span>}
            </button>
          ))}
        </div>

        {/* plan card */}
        <section className={`nd-pcard dm-${theme}`} aria-label={`${plan.name} specifications`}>
          <span className="nd-pcard-art" aria-hidden>
            {plan.name.charAt(0)}
          </span>
          <p className="nd-pcard-tag">{plan.description}</p>
          <dl className="nd-pcard-specs">
            <div>
              <dt>Cores</dt>
              <dd>{plan.cpu}x</dd>
            </div>
            <div>
              <dt>RAM</dt>
              <dd>{ramLabel}</dd>
            </div>
            <div>
              <dt>ROM</dt>
              <dd>{plan.storageGb}GB</dd>
            </div>
            <div>
              <dt>Devices</dt>
              <dd>{plan.maxDevices}</dd>
            </div>
          </dl>
        </section>

        {/* choose by game */}
        <div className={`nd-games${gamesOpen ? " is-open" : ""}`}>
          <button className="nd-games-head" onClick={() => setGamesOpen((v) => !v)} aria-expanded={gamesOpen}>
            <GamepadIcon />
            <span>
              Choose by game
              {game && (
                <em>
                  {" "}
                  · {GAMES[game].name} → {plan.name}
                </em>
              )}
            </span>
            <ChevronDownIcon />
          </button>
          {gamesOpen && (
            <ul className="nd-game-list">
              {allGames.map((k) => (
                <li key={k}>
                  <button className={`nd-game${game === k ? " is-active" : ""}`} style={{ "--h": GAMES[k].hue }} onClick={() => pickGame(k)}>
                    <span aria-hidden>{GAMES[k].glyph}</span>
                    {GAMES[k].name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Field title="Server">
          <ServerPicker value={region} onChange={setRegion} />
        </Field>

        <Field title="Android version">
          <div className="nd-grid3">
            {versions.map((v) => (
              <button key={v} className={`nd-opt${v === android ? " is-active" : ""}`} onClick={() => setAndroidPick(v)} aria-pressed={v === android}>
                {v}
              </button>
            ))}
          </div>
          {Number(android) < 11 && <p className="nd-hint">Android {android} has no in-browser audio (requires Android 11+).</p>}
        </Field>

        <Field title="Package">
          {onCurrentPlan && !included && (
            <p className="nd-note">
              All {subPlan.maxDevices} device slots on your {subPlan.name} plan are in use. Buy another rental to add a device.
            </p>
          )}
          <div className="nd-wallet">
            <span>
              Wallet balance: <b>{formatPrice(wallet)}</b>
            </span>
            <Link to="/wallet/topup">Top-up</Link>
          </div>
          <div className="nd-pkgs" role="radiogroup" aria-label="Package">
            {included && (
              <button role="radio" aria-checked={free} className={`nd-pkg nd-pkg-slot${free ? " is-active" : ""}`} onClick={() => setUseSlot(true)}>
                <span className="nd-pkg-badge">Current plan</span>
                <span className="nd-pkg-name">
                  <strong>
                    <CheckIcon /> Use included slot
                  </strong>
                  <small>
                    {devices.length}/{subPlan.maxDevices} devices used · active until {formatDate(subscription.end)}
                  </small>
                </span>
                <span className="nd-pkg-price">
                  <strong>Free</strong>
                </span>
              </button>
            )}
            {PACKAGES.map((pkg) => {
              const pp = packagePrice(plan, pkg.days);
              const badge = PACKAGE_BADGES[pkg.days];
              const on = !free && days === pkg.days;
              return (
                <button
                  key={pkg.days}
                  role="radio"
                  aria-checked={on}
                  className={`nd-pkg${on ? " is-active" : ""}`}
                  onClick={() => {
                    setDays(pkg.days);
                    setUseSlot(false);
                    setResult(null);
                  }}
                >
                  {badge && <span className="nd-pkg-badge">{badge}</span>}
                  <span className="nd-pkg-name">
                    <strong>{pkg.days} days</strong>
                    <small>{formatPrice(pp.perDay)}/day</small>
                  </span>
                  <span className="nd-pkg-price">
                    <strong>{formatPrice(pp.total)}</strong>
                    {pp.discountPct > 0 && <s>{formatPrice(pp.regular)}</s>}
                  </span>
                </button>
              );
            })}
          </div>
          {onCurrentPlan && !free && <p className="nd-hint">Buying {plan.name} again adds the days to your current plan — all your devices are extended.</p>}
          {free && (
            <label className="nd-name">
              <span>Device name (optional)</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={nextDeviceName(plan, devices)} maxLength={40} />
            </label>
          )}
        </Field>
      </div>

      <footer className="nd-bar">
        {result?.error && <p className="nd-error">{result.error}</p>}
        {result?.ok && <p className="nd-success">{result.message}</p>}
        {!free && wallet < price.total ? (
          <Link to="/wallet/topup" className="nd-buy">
            Buy Now
          </Link>
        ) : (
          <div className="nd-buy-form">
            <button className="nd-buy" disabled={pending} onClick={submit}>
              {free ? (pending ? "Creating…" : "Create device") : pending ? "Paying…" : `Buy now · ${formatPrice(price.total)}`}
            </button>
          </div>
        )}
      </footer>
    </div>
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

import { Link } from "react-router-dom";
import { planBySlug, useStore } from "../api";
import { formatDate, formatRam } from "../api/format";
import { AccountShell } from "../components/AccountShell";
import { CardIcon } from "../components/Icons";

const STATUS_LABEL = { active: "Active", expired: "Expired", canceled: "Replaced" };

export default function Subscriptions() {
  const { subscription, subscriptionHistory, devices } = useStore();
  const now = Date.now();
  const current = subscription && subscription.status === "active" && new Date(subscription.end).getTime() > now ? subscription : null;
  const history = current ? subscriptionHistory : [...(subscription ? [{ id: "s-last", ...subscription, status: "expired" }] : []), ...subscriptionHistory];

  return (
    <AccountShell title="Subscriptions">
      {current ? (
        <CurrentPlan sub={current} deviceCount={devices.length} now={now} />
      ) : (
        <div className="ac-empty">
          <CardIcon />
          <strong>No active plan</strong>
          <span className="muted">Buy a plan or redeem a code to start a cloud phone.</span>
          <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
            <Link to="/new" className="dd-new">
              Choose a plan
            </Link>
            <Link to="/redeem?type=plan" className="vd-more-btn">
              Redeem code
            </Link>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <section className="ac-section">
          <h2>History</h2>
          <ul className="ac-list">
            {history.map((s) => (
              <li key={s.id} className="ac-item">
                <span className="ac-item-icon">
                  <CardIcon />
                </span>
                <div className="ac-item-main">
                  <strong>{planBySlug(s.planSlug)?.name ?? s.planSlug}</strong>
                  <span>
                    {formatDate(s.start)} – {formatDate(s.end)}
                  </span>
                </div>
                <span className={`ac-badge ac-badge-${s.status}`}>{STATUS_LABEL[s.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AccountShell>
  );
}

function CurrentPlan({ sub, deviceCount, now }) {
  const p = planBySlug(sub.planSlug);
  const start = new Date(sub.start).getTime();
  const end = new Date(sub.end).getTime();
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86_400_000));
  const pctLeft = end > start ? Math.max(0, Math.min(100, ((end - now) / (end - start)) * 100)) : 0;

  return (
    <section className="sb-card">
      <div className="sb-top">
        <div>
          <span className="sb-label">Current plan</span>
          <h2>{p.name}</h2>
          {p.description && <p className="muted">{p.description}</p>}
        </div>
        <span className="ac-badge ac-badge-active">Active</span>
      </div>

      <dl className="sb-specs">
        <div>
          <dt>CPU</dt>
          <dd>{p.cpu} cores</dd>
        </div>
        <div>
          <dt>RAM</dt>
          <dd>{formatRam(p.ramMb)}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>{p.storageGb} GB</dd>
        </div>
        <div>
          <dt>Devices</dt>
          <dd>
            {deviceCount}/{p.maxDevices}
          </dd>
        </div>
      </dl>

      <div className="sb-time">
        <div className="sb-time-row">
          <strong className={daysLeft <= 3 ? "dd-warn-text" : undefined}>
            {daysLeft} day{daysLeft === 1 ? "" : "s"} left
          </strong>
          <span className="muted">
            {formatDate(sub.start)} – {formatDate(sub.end)}
          </span>
        </div>
        <div className="sb-meter" aria-hidden>
          <i style={{ width: `${pctLeft}%` }} />
        </div>
      </div>

      <div className="sb-actions">
        <Link to="/redeem?type=renew" className="dd-new">
          Renew with code
        </Link>
        <Link to="/new" className="vd-more-btn">
          Buy / upgrade
        </Link>
      </div>
    </section>
  );
}

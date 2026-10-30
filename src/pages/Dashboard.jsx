import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { planBySlug, useStore } from "../api";
import { AccountMenu } from "../components/AccountMenu";
import { DeviceCard } from "../components/DeviceCard";
import { LayersIcon, PhoneIcon, PlusIcon } from "../components/Icons";
import { ProfileCard } from "../components/ProfileCard";
import { VerifyBanner } from "../components/VerifyBanner";

export default function Dashboard({ onSignOut }) {
  const { devices, subscription, profile, wallet, gems, messages } = useStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const unread = messages.filter((m) => !m.readAt).length;
  const subPlan = subscription && planBySlug(subscription.planSlug);
  const renewHref = "/redeem?type=renew";

  return (
    <div className="dd">
      <aside className="dd-side">
        <ProfileCard profile={profile} balance={wallet} gems={gems} />

        <nav className="dd-groups" aria-label="Device groups">
          <span className="dd-groups-title">My cloud phones</span>
          <span className="dd-group is-active">
            <LayersIcon />
            <span>All devices</span>
            <em>{devices.length}</em>
          </span>
        </nav>

        <AccountMenu unread={unread} onSignOut={onSignOut} />
      </aside>

      <div className="dd-main">
        <VerifyBanner />
        <header className="dd-head">
          <div>
            <h1>My Cloud Phones</h1>
            <p className="muted">Phones keep running 24/7 — close the tab any time.</p>
          </div>
        </header>

        {devices.length === 0 && (
          <div className="dd-empty">
            <PhoneIcon />
            <strong>No cloud phones yet</strong>
            <span className="muted">Create your first device to start playing.</span>
          </div>
        )}
        <div className="dd-grid">
          {devices.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              now={now}
              renewHref={renewHref}
              planName={subscription?.planSlug === d.planSlug ? subPlan?.name : undefined}
            />
          ))}
          <Link to="/new" className="dd-card dd-buy" aria-label="Buy a new cloud phone">
            <span className="dd-buy-icon" aria-hidden>
              <PlusIcon />
            </span>
            Buy
          </Link>
        </div>
      </div>
    </div>
  );
}

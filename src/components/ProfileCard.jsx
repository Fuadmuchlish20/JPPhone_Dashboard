import { Link } from "react-router-dom";
import { formatPrice } from "../api/format";
import { CardIcon, ChevronRightIcon, GemIcon, PlusIcon } from "./Icons";

/** Sidebar header: who's signed in, quick links (incl. gem balance), and the wallet balance. */
export function ProfileCard({ profile, balance, gems }) {
  const name = profile.displayName?.trim() || profile.email.split("@")[0] || "User";

  return (
    <div className="pf">
      <div className="pf-who">
        <span className="pf-avatar" aria-hidden>
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="pf-name">
          <strong title={name}>{name}</strong>
          <span>ID: {profile.id.replace(/-/g, "").slice(0, 8).toUpperCase()}</span>
        </div>
      </div>

      <nav className="pf-actions" aria-label="Quick actions">
        <Link to="/gem" aria-label={`${gems} gems — redeem for cloud phone time`}>
          <span className="pf-action-icon">
            <GemIcon />
          </span>
          {gems}
        </Link>
        <Link to="/new">
          <span className="pf-action-icon">
            <PlusIcon />
          </span>
          Buy / Renew
        </Link>
        <Link to="/subscriptions">
          <span className="pf-action-icon">
            <CardIcon />
          </span>
          Plan
        </Link>
      </nav>

      <div className="pf-balance">
        <span className="pf-label">
          Wallet Balance
          <span className="pf-help" title="Use your balance to buy or renew plans." aria-label="Use your balance to buy or renew plans.">
            ?
          </span>
        </span>
        <div className="pf-balance-row">
          <strong>{formatPrice(balance)}</strong>
          <Link to="/wallet/topup" className="pf-topup">
            Top-up
          </Link>
        </div>
        <Link to="/wallet" className="pf-history">
          Transaction History <ChevronRightIcon />
        </Link>
      </div>
    </div>
  );
}

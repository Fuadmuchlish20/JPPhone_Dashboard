import { Link } from "react-router-dom";
import { useStore } from "../api";
import { formatDate, formatPrice } from "../api/format";
import { AccountShell } from "../components/AccountShell";
import { CardIcon, HeadsetIcon } from "../components/Icons";

const KIND_LABEL = { topup: "Top-up", purchase: "Plan purchase", refund: "Refund", adjustment: "Adjustment" };

export default function Wallet() {
  const { wallet, transactions } = useStore();

  return (
    <AccountShell title="Wallet">
      <section className="wl-card">
        <span className="pf-label">Wallet Balance</span>
        <strong className="wl-amount">{formatPrice(wallet)}</strong>
        <p className="muted">Use your balance to buy or renew any plan on the New device page.</p>
        <div className="sb-actions">
          <Link to="/new" className="dd-new">
            Buy / Renew plan
          </Link>
        </div>
      </section>

      <section className="ac-section" id="topup">
        <h2>Top-up</h2>
        <div className="wl-topup">
          <HeadsetIcon />
          <div>
            <strong>Add balance</strong>
            <span>Pick an amount and payment method. Some amounts include bonus balance.</span>
          </div>
          <Link to="/wallet/topup" className="pf-topup">
            Top-up
          </Link>
        </div>
      </section>

      <section className="ac-section">
        <h2>Transaction History</h2>
        {transactions.length === 0 ? (
          <div className="ac-empty">
            <CardIcon />
            <strong>No transactions yet</strong>
            <span className="muted">Top-ups and plan purchases will show up here.</span>
          </div>
        ) : (
          <ul className="ac-list">
            {transactions.map((t) => (
              <li key={t.id} className="ac-item">
                <span className="ac-item-icon">
                  <CardIcon />
                </span>
                <div className="ac-item-main">
                  <strong>{KIND_LABEL[t.kind]}</strong>
                  <span>
                    {formatDate(t.createdAt)}
                    {t.note && <> · {t.note}</>}
                  </span>
                </div>
                <div className="ac-item-end">
                  <strong className={t.amount > 0 ? "wl-plus" : undefined}>
                    {t.amount > 0 ? "+" : "−"}
                    {formatPrice(Math.abs(t.amount))}
                  </strong>
                  <span className="muted wl-after">Balance {formatPrice(t.balanceAfter)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AccountShell>
  );
}

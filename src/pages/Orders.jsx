import { planBySlug, useStore } from "../api";
import { formatDate, formatPrice } from "../api/format";
import { AccountShell } from "../components/AccountShell";
import { ReceiptIcon } from "../components/Icons";

const SOURCE_LABEL = { payment: "Payment", redeem: "Redeem code", admin: "Granted by support", wallet: "Wallet" };
const STATUS_LABEL = { pending: "Pending", paid: "Completed", failed: "Failed", refunded: "Refunded" };

export default function Orders() {
  const { orders } = useStore();

  return (
    <AccountShell title="Order History">
      {orders.length === 0 ? (
        <div className="ac-empty">
          <ReceiptIcon />
          <strong>No orders yet</strong>
          <span className="muted">Plan purchases, renewals and redeemed codes will show up here.</span>
        </div>
      ) : (
        <ul className="ac-list">
          {orders.map((o) => (
            <li key={o.id} className="ac-item">
              <span className="ac-item-icon">
                <ReceiptIcon />
              </span>
              <div className="ac-item-main">
                <strong>
                  {o.kind === "new" ? "New plan" : "Renewal"} · {planBySlug(o.planSlug)?.name ?? "Plan"} · {o.days} day{o.days === 1 ? "" : "s"}
                </strong>
                <span>
                  {formatDate(o.createdAt)} · {SOURCE_LABEL[o.source]}
                  {o.reference && <> · {o.reference}</>}
                </span>
              </div>
              <div className="ac-item-end">
                <strong>{o.amount > 0 ? formatPrice(o.amount) : "Free"}</strong>
                <span className={`ac-badge ac-badge-${o.status}`}>{STATUS_LABEL[o.status]}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}

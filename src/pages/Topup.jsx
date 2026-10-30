import { useState } from "react";
import { Link } from "react-router-dom";
import { REMOTE, cancelTopup, confirmTopup, createTopup, useStore } from "../api";
import { formatDate, formatPrice } from "../api/format";
import { ActionButton } from "../components/ActionButton";
import { AccountShell } from "../components/AccountShell";
import { CheckIcon } from "../components/Icons";
import { SUPPORT } from "../config";
import { PAYMENT_METHODS, TOPUP_MAX, TOPUP_MIN, TOPUP_PRESETS, bonusFor, roundMoney } from "../data/topup";

const usd = (n) => formatPrice(n);
const supportHref = SUPPORT.chatUrl || "/support";

export default function Topup() {
  const { wallet, topups } = useStore();
  const pending = topups.filter((t) => t.status === "pending");

  const [preset, setPreset] = useState(TOPUP_PRESETS[0].amount);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState(PAYMENT_METHODS[0].id);
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState(null);

  const amount = preset ?? roundMoney(Number(custom));
  const valid = Number.isFinite(amount) && amount >= TOPUP_MIN && amount <= TOPUP_MAX;
  const bonus = preset ? bonusFor(preset) : 0;
  const methodName = PAYMENT_METHODS.find((m) => m.id === method)?.name ?? method;

  async function submit() {
    setSubmitting(true);
    const res = await createTopup(amount, bonus, method);
    // With an online payment provider the server returns its payment page; the wallet is credited by its webhook.
    if (res.ok && res.payUrl) return window.location.assign(res.payUrl);
    setState(res);
    setSubmitting(false);
  }

  return (
    <AccountShell
      title="Top-up"
      backHref="/wallet"
      actions={
        <Link to="/wallet" className="tp-history">
          Transaction History
        </Link>
      }
    >
      <div className="tp">
        <div className="tp-balance">
          <span className="pf-label">
            Wallet Balance
            <span className="pf-help" title="Use your balance to buy or renew plans.">
              ?
            </span>
          </span>
          <strong>{usd(wallet)}</strong>
        </div>

        {state?.ok ? (
          <section className="tp-done" role="status">
            <CheckIcon />
            <div>
              <strong>Top-up created</strong>
              <span>
                Pay <b>{usd(amount)}</b> with {methodName} and send your reference to customer service. Your balance
                {bonus > 0 ? ` (+${usd(bonus)} bonus)` : ""} is added as soon as the payment is confirmed.
              </span>
              <code className="tp-ref">{state.message}</code>
            </div>
            <div className="tp-done-actions">
              {supportHref.startsWith("http") ? (
                <a href={supportHref} className="dd-new" target="_blank" rel="noopener noreferrer">
                  Contact customer service
                </a>
              ) : (
                <Link to={supportHref} className="dd-new">
                  Contact customer service
                </Link>
              )}
              <button className="vd-more-btn" onClick={() => setState(null)}>
                Back to top-up
              </button>
            </div>
          </section>
        ) : (
          <>
            <section>
              <h2 className="tp-h">Top-up Amount</h2>
              <div className="tp-amounts" role="radiogroup" aria-label="Top-up amount">
                {TOPUP_PRESETS.map((p) => (
                  <button
                    key={p.amount}
                    role="radio"
                    aria-checked={preset === p.amount}
                    className={`tp-amount${preset === p.amount ? " is-active" : ""}`}
                    onClick={() => setPreset(p.amount)}
                  >
                    <span className="tp-price">
                      <small>$</small>
                      {p.amount.toFixed(2)}
                    </span>
                    {p.bonus > 0 && <span className="tp-bonus">Bonus {usd(p.bonus)}</span>}
                  </button>
                ))}
                <label className={`tp-amount tp-custom${preset === null ? " is-active" : ""}`}>
                  <span className="tp-price">
                    <small>$</small>
                  </span>
                  <input
                    inputMode="decimal"
                    placeholder="Custom Amount"
                    value={custom}
                    onFocus={() => setPreset(null)}
                    onChange={(e) => {
                      setPreset(null);
                      setCustom(e.target.value.replace(/[^\d.]/g, ""));
                    }}
                    aria-label={`Custom amount, ${TOPUP_MIN} to ${TOPUP_MAX} dollars`}
                  />
                </label>
              </div>
              {preset === null && custom && !valid && (
                <p className="rc-error">
                  Enter between {usd(TOPUP_MIN)} and {usd(TOPUP_MAX)}.
                </p>
              )}
            </section>

            <section>
              <h2 className="tp-h">Method</h2>
              <div className="tp-methods" role="radiogroup" aria-label="Payment method">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    role="radio"
                    aria-checked={method === m.id}
                    className={`tp-method${method === m.id ? " is-active" : ""}`}
                    style={{ "--c": m.color }}
                    onClick={() => setMethod(m.id)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {pending.length > 0 && (
          <section>
            <h2 className="tp-h">Waiting for payment</h2>
            <ul className="ac-list">
              {pending.map((t) => (
                <li key={t.id} className="ac-item">
                  <div className="ac-item-main">
                    <strong>
                      {usd(t.amount)}
                      {t.bonus > 0 && <span className="tp-bonus"> +{usd(t.bonus)}</span>}
                    </strong>
                    <span>
                      <code>{t.reference}</code> · {PAYMENT_METHODS.find((m) => m.id === t.method)?.name ?? t.method} · {formatDate(t.createdAt)}
                    </span>
                  </div>
                  {t.payUrl && (
                    <a href={t.payUrl} className="ms-link">
                      Pay now
                    </a>
                  )}
                  {/* Offline demo only: with the backend, the payment provider or an admin confirms the top-up. */}
                  {!REMOTE && <ActionButton action={() => confirmTopup(t.id)} label="Mark paid (demo)" className="ms-link" />}
                  <ActionButton action={() => cancelTopup(t.id)} label="Cancel" className="ms-link" />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {!state?.ok && (
        <footer className="tp-bar">
          {state?.error && <p className="nd-error">{state.error}</p>}
          <button className="tp-confirm" disabled={!valid || submitting} onClick={submit}>
            {submitting ? "Creating…" : valid ? `Confirm payment ${usd(amount)}` : "Enter an amount"}
          </button>
        </footer>
      )}
    </AccountShell>
  );
}

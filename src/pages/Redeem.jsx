import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { redeemCode } from "../api";
import { AccountShell } from "../components/AccountShell";
import { CheckIcon } from "../components/Icons";

const CARDS = [
  { kind: "plan", title: "Add New Cloud Phone", body: "Activate a plan with a code, then create your device.", tone: "lime" },
  { kind: "renew", title: "Renew Cloud Phone", body: "Add days to your current plan. All your devices are extended.", tone: "dark" },
];

export default function Redeem() {
  const [params] = useSearchParams();
  const initial = ["plan", "renew"].includes(params.get("type")) ? params.get("type") : null;
  const [open, setOpen] = useState(initial);

  return (
    <AccountShell title="Redeem Code">
      <div className="rc">
        {CARDS.map((c) => (
          <section key={c.kind} className={`rc-card rc-${c.tone}${open === c.kind ? " is-open" : ""}`}>
            <button className="rc-head" onClick={() => setOpen(open === c.kind ? null : c.kind)} aria-expanded={open === c.kind}>
              <span className="rc-title">{c.title}</span>
              <span className="rc-body">{c.body}</span>
              <span className="rc-tiles" aria-hidden>
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            </button>
            {open === c.kind && <RedeemForm kind={c.kind} />}
          </section>
        ))}
        <p className="rc-help">
          Codes look like <code>ABCD-EFGH-JKLM-NPQR</code>. Each code can be used once per account. Demo codes:{" "}
          <code>DEMO-PLAN-2026</code> (plan) and <code>DEMO-RENEW-7D</code> (renew).
        </p>
      </div>
    </AccountShell>
  );
}

function RedeemForm({ kind }) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [state, setState] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setPending(true);
    setState(await redeemCode(kind, code));
    setPending(false);
  }

  if (state?.ok) {
    return (
      <div className="rc-form rc-done" role="status">
        <CheckIcon />
        <div>
          <strong>Code redeemed</strong>
          <span>{state.message}</span>
        </div>
        <Link to={kind === "plan" ? "/new" : "/"} className="rc-btn">
          {kind === "plan" ? "Create device" : "My devices"}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rc-form">
      <label className="sr-only" htmlFor={`code-${kind}`}>
        Redeem code
      </label>
      <input
        id={`code-${kind}`}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter your code"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={40}
        required
        autoFocus
      />
      <button className="rc-btn" disabled={pending}>
        {pending ? "Checking…" : "Redeem"}
      </button>
      {state?.error && <p className="rc-error">{state.error}</p>}
    </form>
  );
}

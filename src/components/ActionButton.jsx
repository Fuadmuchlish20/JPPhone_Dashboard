import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * Button that runs an async action `() => Promise<{ ok } | { error }>` and shows its pending/error state.
 * `confirm` (message, or a list) asks first in a dialog titled `confirmTitle` (defaults to the label), OK button `confirmLabel`.
 */
export function ActionButton({ action, label, pendingLabel, confirm, confirmTitle, confirmLabel, className = "btn btn-sm", disabled, icon, onDone }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [asking, setAsking] = useState(false);

  async function run() {
    setAsking(false);
    setPending(true);
    setError(null);
    const res = await action();
    setPending(false);
    if (res?.error) setError(res.error);
    else onDone?.(res);
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => (confirm ? setAsking(true) : run())}
        disabled={pending || disabled}
        title={error ?? (icon ? label : undefined)}
        aria-label={icon ? label : undefined}
        aria-busy={pending || undefined}
      >
        {icon ?? (pending ? (pendingLabel ?? `${label}…`) : label)}
      </button>
      {error && !icon && <span className="form-error">{error}</span>}
      {asking && <ConfirmDialog title={confirmTitle ?? label} message={confirm} confirmLabel={confirmLabel} onConfirm={run} onCancel={() => setAsking(false)} />}
    </>
  );
}

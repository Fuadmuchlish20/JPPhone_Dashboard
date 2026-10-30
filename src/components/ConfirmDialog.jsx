import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/** Small "are you sure?" dialog (Cancel / OK). `message` may be text or a list. Esc or clicking outside cancels. */
export function ConfirmDialog({ title, message, confirmLabel = "OK", onConfirm, onCancel }) {
  const okRef = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    okRef.current?.focus();
    return () => prev?.focus?.();
  }, []);

  return createPortal(
    <div
      className="cf-backdrop"
      onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        // Keep Esc from also closing a sheet underneath.
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        onCancel();
      }}
    >
      <div className="cf" role="alertdialog" aria-modal="true" aria-labelledby="cf-title" aria-describedby="cf-msg">
        <h2 id="cf-title">{title}</h2>
        <div id="cf-msg" className="cf-msg">
          {Array.isArray(message) ? (
            <ol>
              {message.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ol>
          ) : (
            <p>{message}</p>
          )}
        </div>
        <div className="cf-actions">
          <button onClick={onCancel}>Cancel</button>
          <button ref={okRef} className="cf-ok" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

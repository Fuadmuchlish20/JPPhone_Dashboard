import { useState } from "react";
import { REMOTE, resendVerification, useStore } from "../api";

/** Reminder to confirm the account email (backend mode), with a resend button. */
export function VerifyBanner() {
  const { emailVerified, requireVerifiedEmail, profile } = useStore();
  const [state, setState] = useState(null);
  if (!REMOTE || emailVerified !== false) return null;

  async function resend() {
    setState("sending");
    const res = await resendVerification();
    setState(res.error ? { error: res.error } : "sent");
  }

  return (
    <div className="vb" role="status">
      <div>
        <strong>Confirm your email</strong>
        <span>
          We sent a link to <b>{profile.email}</b>.{requireVerifiedEmail ? " You can top up and create cloud phones once it's confirmed." : ""}
          {state === "sent" && " A new link is on its way."}
          {state?.error && ` ${state.error}`}
        </span>
      </div>
      <button onClick={resend} disabled={state === "sending" || state === "sent"}>
        {state === "sending" ? "Sending…" : state === "sent" ? "Sent" : "Resend link"}
      </button>
    </div>
  );
}

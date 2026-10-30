import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword, verifyEmail } from "../api";
import { Logo } from "../components/Logo";

/** /reset-password?token=… — the link from the reset email. */
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) return setResult({ error: "The two passwords don't match." });
    setPending(true);
    setResult(await resetPassword(token, password));
    setPending(false);
  }

  if (result?.ok) {
    return (
      <Card title="Password changed">
        <p className="muted">You're signed in with your new password. Other devices were signed out.</p>
        <Link to="/" className="au-submit au-link">
          Go to my cloud phones
        </Link>
      </Card>
    );
  }

  return (
    <Card title="Choose a new password">
      <form className="au-form" onSubmit={submit}>
        <label className="au-field">
          <span>New password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} maxLength={200} autoFocus />
          <small>At least 8 characters.</small>
        </label>
        <label className="au-field">
          <span>Repeat new password</span>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={8} maxLength={200} />
        </label>
        {result?.error && (
          <p className="au-error" role="alert">
            {result.error}
          </p>
        )}
        <button className="au-submit" disabled={pending || !token}>
          {pending ? "Saving…" : "Save new password"}
        </button>
        {!token && <p className="au-error">This link is incomplete. Open it again from the email.</p>}
      </form>
    </Card>
  );
}

/** /verify-email?token=… — the link from the verification email. */
export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (token) verifyEmail(token).then(setResult);
  }, [token]);

  if (!token) {
    return (
      <Card title="Link incomplete">
        <p className="au-error">Open the link again from the email.</p>
      </Card>
    );
  }
  if (!result) {
    return (
      <Card title="Confirming your email…">
        <p className="muted">One moment.</p>
      </Card>
    );
  }
  return (
    <Card title={result.ok ? "Email confirmed" : "Couldn't confirm"}>
      {result.ok ? <p className="muted">Thanks! You can now top up and create cloud phones.</p> : <p className="au-error">{result.error}</p>}
      <Link to="/" className="au-submit au-link">
        {result.ok ? "Go to my cloud phones" : "Back to the dashboard"}
      </Link>
    </Card>
  );
}

function Card({ title, children }) {
  return (
    <section className="au">
      <div className="au-card">
        <span className="au-logo">
          <Logo />
        </span>
        <h1>{title}</h1>
        {children}
      </div>
    </section>
  );
}

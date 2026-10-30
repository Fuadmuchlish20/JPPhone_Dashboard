import { useState } from "react";
import { requestPasswordReset, signIn, signUp } from "../api";
import { Logo } from "../components/Logo";

/** Sign in / create account / forgot password (backend mode). */
export default function SignIn() {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const creating = mode === "signup";
  const forgot = mode === "forgot";

  async function submit(e) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = forgot ? await requestPasswordReset(email) : creating ? await signUp(name, email, password) : await signIn(email, password);
    setPending(false);
    if (res.error) setError(res.error);
    else if (forgot) setSent(true);
  }

  function switchTo(next) {
    setMode(next);
    setError(null);
    setSent(false);
  }

  if (forgot) {
    return (
      <section className="au">
        <form className="au-card" onSubmit={submit}>
          <span className="au-logo">
            <Logo />
          </span>
          <h1>Reset your password</h1>
          {sent ? (
            <p className="muted" role="status">
              If an account exists for <b>{email}</b>, we've sent a link to choose a new password. It works for 1 hour — check your spam folder too.
            </p>
          ) : (
            <>
              <p className="muted">Enter your account email and we'll send you a link.</p>
              <label className="au-field">
                <span>Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={120} autoFocus />
              </label>
              {error && (
                <p className="au-error" role="alert">
                  {error}
                </p>
              )}
              <button className="au-submit" disabled={pending}>
                {pending ? "Sending…" : "Send reset link"}
              </button>
            </>
          )}
          <button type="button" className="au-text-btn" onClick={() => switchTo("signin")}>
            Back to sign in
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="au">
      <form className="au-card" onSubmit={submit}>
        <span className="au-logo">
          <Logo />
        </span>
        <h1>{creating ? "Create your account" : "Sign in"}</h1>
        <p className="muted">{creating ? "Rent cloud phones that keep running 24/7." : "Welcome back — your cloud phones are waiting."}</p>

        <div className="au-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!creating} className={!creating ? "is-active" : undefined} onClick={() => switchTo("signin")}>
            Sign in
          </button>
          <button type="button" role="tab" aria-selected={creating} className={creating ? "is-active" : undefined} onClick={() => switchTo("signup")}>
            Create account
          </button>
        </div>

        {creating && (
          <label className="au-field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} placeholder="Your name" />
          </label>
        )}
        <label className="au-field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={120} autoFocus />
        </label>
        <label className="au-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={creating ? "new-password" : "current-password"}
            required
            minLength={creating ? 8 : undefined}
            maxLength={200}
          />
          {creating && <small>At least 8 characters.</small>}
        </label>
        {!creating && (
          <button type="button" className="au-text-btn au-forgot" onClick={() => switchTo("forgot")}>
            Forgot password?
          </button>
        )}

        {error && (
          <p className="au-error" role="alert">
            {error}
          </p>
        )}
        <button className="au-submit" disabled={pending}>
          {pending ? "Please wait…" : creating ? "Create account" : "Sign in"}
        </button>
      </form>
    </section>
  );
}

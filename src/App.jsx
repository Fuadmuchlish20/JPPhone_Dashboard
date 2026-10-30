import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { REMOTE, signOut, useStore } from "./api";
import { Logo } from "./components/Logo";
import { BRAND } from "./config";
import Customize from "./pages/Customize";
import Dashboard from "./pages/Dashboard";
import { ResetPassword, VerifyEmail } from "./pages/EmailLinks";
import Device from "./pages/Device";
import Gem from "./pages/Gem";
import Install from "./pages/Install";
import Messages from "./pages/Messages";
import NewDevice from "./pages/NewDevice";
import NotFound from "./pages/NotFound";
import Orders from "./pages/Orders";
import Redeem from "./pages/Redeem";
import Replace from "./pages/Replace";
import Screenshot from "./pages/Screenshot";
import Section from "./pages/Section";
import SignIn from "./pages/SignIn";
import Subscriptions from "./pages/Subscriptions";
import Support from "./pages/Support";
import Topup from "./pages/Topup";
import Upload from "./pages/Upload";
import Wallet from "./pages/Wallet";

export default function App() {
  const { profile, session } = useStore();
  const [demoSignedOut, setDemoSignedOut] = useState(false);
  // Backend: a real session. Offline demo: a local toggle.
  const signedIn = REMOTE ? session === "user" : !demoSignedOut;
  const leave = REMOTE ? signOut : () => setDemoSignedOut(true);
  // Links from emails work whether or not this browser is signed in.
  const emailLinkPage = REMOTE && pathname === "/reset-password" ? <ResetPassword /> : REMOTE && pathname === "/verify-email" ? <VerifyEmail /> : null;
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Screenshots open in their own tab without the dashboard header.
  if (/^\/device\/[^/]+\/screenshot\/?$/.test(pathname)) {
    return (
      <Routes>
        <Route path="/device/:id/screenshot" element={<Screenshot />} />
      </Routes>
    );
  }

  return (
    <>
      <header className="site-header">
        <div className="container">
          <Link to="/" className="logo" aria-label={`${BRAND.name} dashboard`}>
            <Logo />
          </Link>
          <nav className="nav">
            <Link to="/">Devices</Link>
            <Link to="/new">Buy device</Link>
            <Link to="/wallet">Wallet</Link>
          </nav>
          <span className="spacer" />
          {signedIn && (
            <div className="row">
              <span className="muted hdr-user">{profile.email}</span>
              <button className="btn btn-sm btn-ghost" onClick={leave}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main>
        {emailLinkPage ? (
          emailLinkPage
        ) : signedIn ? (
          <Routes>
            <Route path="/" element={<Dashboard onSignOut={leave} />} />
            <Route path="/new" element={<NewDevice />} />
            <Route path="/device/:id" element={<Device />} />
            <Route path="/device/:id/replace" element={<Replace />} />
            <Route path="/device/:id/install" element={<Install />} />
            <Route path="/device/:id/upload" element={<Upload />} />
            <Route path="/device/:id/customize" element={<Customize />} />
            <Route path="/gem" element={<Gem />} />
            <Route path="/redeem" element={<Redeem />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/wallet/topup" element={<Topup />} />
            <Route path="/support" element={<Support />} />
            <Route path="/section/:section" element={<Section />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        ) : REMOTE ? (
          session === "loading" ? (
            <p className="muted au-loading">Loading…</p>
          ) : (
            <SignIn />
          )
        ) : (
          <section className="dd-section">
            <div className="dd-soon">
              <h1>You&apos;re signed out</h1>
              <p className="muted">Demo mode — sign back in to return to your devices.</p>
              <button className="dd-new" onClick={() => setDemoSignedOut(false)}>
                Sign in again
              </button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

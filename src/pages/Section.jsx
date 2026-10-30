import { Link, useParams } from "react-router-dom";
import { ACCOUNT_SECTIONS } from "../components/AccountMenu";
import { ArrowLeftIcon } from "../components/Icons";
import NotFound from "./NotFound";

/** "Coming soon" page for account sections that don't have a real page yet. */
export default function Section() {
  const { section } = useParams();
  const s = Object.hasOwn(ACCOUNT_SECTIONS, section) ? ACCOUNT_SECTIONS[section] : null;
  if (!s) return <NotFound />;
  const Icon = s.icon;

  return (
    <section className="dd-section">
      <Link to="/" className="dd-back">
        <ArrowLeftIcon /> Back to devices
      </Link>
      <div className="dd-soon">
        <span className="dd-soon-icon">
          <Icon />
        </span>
        <h1>{s.label}</h1>
        <p className="muted">{s.body}</p>
        <span className="dd-soon-tag">Coming soon</span>
      </div>
    </section>
  );
}

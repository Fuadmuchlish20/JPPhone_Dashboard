import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "../components/Icons";

export default function NotFound() {
  return (
    <section className="dd-section">
      <Link to="/" className="dd-back">
        <ArrowLeftIcon /> Back to devices
      </Link>
      <div className="dd-soon">
        <h1>Page not found</h1>
        <p className="muted">The page you&apos;re looking for doesn&apos;t exist.</p>
      </div>
    </section>
  );
}

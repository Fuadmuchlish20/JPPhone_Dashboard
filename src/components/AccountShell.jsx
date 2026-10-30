import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "./Icons";

/** Page frame for Account sub-pages: back arrow + title bar, centered content. */
export function AccountShell({ title, backHref = "/", actions, children }) {
  return (
    <div className="ac">
      <header className="ac-top">
        <Link to={backHref} className="nd-top-btn" aria-label="Back to devices">
          <ArrowLeftIcon />
        </Link>
        <h1>{title}</h1>
        <span className="spacer" />
        {actions}
      </header>
      <div className="ac-body">{children}</div>
    </div>
  );
}

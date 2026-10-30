import { Link } from "react-router-dom";
import {
  BookIcon,
  CardIcon,
  ChevronRightIcon,
  GiftIcon,
  HeadsetIcon,
  LogoutIcon,
  MessageIcon,
  PlanetIcon,
  ReceiptIcon,
  TicketIcon,
} from "./Icons";

// Sections without a real page yet render the "coming soon" page at /section/:section.
export const ACCOUNT_SECTIONS = {
  rewards: { label: "Rewards", icon: GiftIcon, body: "Earn free device time by checking in daily and inviting friends." },
  discover: { label: "Discover", icon: PlanetIcon, body: "Browse supported games, tips and community picks for your cloud phones." },
  guide: { label: "Function Introduction", icon: BookIcon, body: "A tour of every feature: multi-device control, batch actions, APK install and more." },
};

const ITEMS = [
  { to: "/section/rewards", label: ACCOUNT_SECTIONS.rewards.label, icon: GiftIcon },
  { to: "/redeem", label: "Redeem Code", icon: TicketIcon },
  { to: "/subscriptions", label: "Subscriptions", icon: CardIcon },
  { to: "/messages", label: "Messages", icon: MessageIcon, badge: "unread" },
  { to: "/orders", label: "Order History", icon: ReceiptIcon },
  { to: "/section/discover", label: ACCOUNT_SECTIONS.discover.label, icon: PlanetIcon },
  { to: "/support", label: "Support", icon: HeadsetIcon },
  { to: "/section/guide", label: ACCOUNT_SECTIONS.guide.label, icon: BookIcon },
];

export function AccountMenu({ unread = 0, onSignOut }) {
  return (
    <nav className="dd-menu" aria-label="Account">
      <span className="dd-groups-title">Account</span>
      <ul>
        {ITEMS.map(({ to, label, icon: Icon, badge }) => (
          <li key={to}>
            <Link to={to} className="dd-menu-item">
              <Icon />
              <span>{label}</span>
              {badge === "unread" && unread > 0 && (
                <em className="dd-menu-badge" aria-label={`${unread} unread`}>
                  {unread > 99 ? "99+" : unread}
                </em>
              )}
              <ChevronRightIcon />
            </Link>
          </li>
        ))}
        <li>
          <button type="button" className="dd-menu-item" onClick={onSignOut}>
            <LogoutIcon />
            <span>Sign Out</span>
            <ChevronRightIcon />
          </button>
        </li>
      </ul>
    </nav>
  );
}

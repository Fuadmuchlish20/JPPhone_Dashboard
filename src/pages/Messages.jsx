import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { markMessagesRead, useStore } from "../api";
import { formatDate, timeAgo } from "../api/format";
import { AccountShell } from "../components/AccountShell";
import { BoltIcon, CheckIcon, ClockIcon, MessageIcon } from "../components/Icons";

const KIND_ICON = { info: <BoltIcon />, success: <CheckIcon />, warning: <ClockIcon /> };

/** Unread messages stay highlighted for this visit, then are marked read in the background. */
export default function Messages() {
  const { messages } = useStore();
  // Snapshot on mount so marking them read doesn't remove the highlight while the page is open.
  const [unreadIds] = useState(() => new Set(messages.filter((m) => !m.readAt).map((m) => m.id)));

  useEffect(() => {
    markMessagesRead();
  }, []);

  return (
    <AccountShell title="Messages" actions={unreadIds.size > 0 ? <span className="ac-count">{unreadIds.size} new</span> : null}>
      {messages.length === 0 ? (
        <div className="ac-empty">
          <MessageIcon />
          <strong>No messages</strong>
          <span className="muted">Updates about your plan and devices will appear here.</span>
        </div>
      ) : (
        <ul className="ac-list">
          {messages.map((m) => (
            <li key={m.id} className={`ac-item ms-item ms-${m.kind}${unreadIds.has(m.id) ? " is-unread" : ""}`}>
              <span className="ac-item-icon">{KIND_ICON[m.kind]}</span>
              <div className="ac-item-main">
                <strong>{m.title}</strong>
                {m.body && <p>{m.body}</p>}
                <span title={formatDate(m.createdAt)}>{timeAgo(m.createdAt)}</span>
              </div>
              {m.link && (
                <Link to={m.link} className="ms-link">
                  View
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}

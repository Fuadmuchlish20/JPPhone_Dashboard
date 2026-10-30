/** Illustrated Android home screen shown in device cards until a live screenshot is available. */

const APPS = [
  { name: "Browser", bg: "#ffffff", fg: "#1a73e8", shape: "globe" },
  { name: "Store", bg: "#e8f5e9", fg: "#34a853", shape: "play" },
  { name: "Games", bg: "#ede7f6", fg: "#7c4dff", shape: "pad" },
  { name: "Files", bg: "#e3f2fd", fg: "#1e88e5", shape: "folder" },
  { name: "Gallery", bg: "#fff3e0", fg: "#fb8c00", shape: "photo" },
  { name: "Camera", bg: "#eceff1", fg: "#455a64", shape: "camera" },
  { name: "Settings", bg: "#e0f2f1", fg: "#00897b", shape: "gear" },
  { name: "Clock", bg: "#fce4ec", fg: "#d81b60", shape: "clock" },
];

const DOCK = [
  { bg: "#43a047", shape: "phone" },
  { bg: "#1e88e5", shape: "chat" },
  { bg: "#ffffff", shape: "globe" },
  { bg: "#fdd835", shape: "photo" },
];

function Glyph({ shape, color }) {
  const p = { fill: "none", stroke: color, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (shape) {
    case "globe":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" {...p} />
          <path d="M4 12h16M12 4c2.2 2.3 3.3 5 3.3 8s-1.1 5.7-3.3 8c-2.2-2.3-3.3-5-3.3-8S9.8 6.3 12 4z" {...p} />
        </svg>
      );
    case "play":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M7 4.5v15l12-7.5z" fill={color} />
        </svg>
      );
    case "pad":
      return (
        <svg viewBox="0 0 24 24">
          <rect x="3" y="8" width="18" height="10" rx="5" {...p} />
          <path d="M8 11v4M6 13h4M16 12h.01M18 14h.01" {...p} />
        </svg>
      );
    case "folder":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M3 7h6l2 2h10v9H3z" fill={color} />
        </svg>
      );
    case "photo":
      return (
        <svg viewBox="0 0 24 24">
          <rect x="4" y="5" width="16" height="14" rx="2" {...p} />
          <path d="m4 16 5-5 4 4 2-2 5 5" {...p} />
        </svg>
      );
    case "camera":
      return (
        <svg viewBox="0 0 24 24">
          <rect x="3" y="7" width="18" height="12" rx="3" {...p} />
          <circle cx="12" cy="13" r="3.2" {...p} />
        </svg>
      );
    case "gear":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" {...p} />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" {...p} />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" {...p} />
          <path d="M12 8v4l3 2" {...p} />
        </svg>
      );
    case "phone":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M6.6 3.5 9 6.8 7.6 9.1a12 12 0 0 0 7.3 7.3l2.3-1.4 3.3 2.4-1.1 2.6c-9 .3-15.8-6.5-15.5-15.5z" fill="#fff" />
        </svg>
      );
    case "chat":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 5h16v11H9l-5 4z" fill="#fff" />
        </svg>
      );
    default:
      return null;
  }
}

export function AndroidHome({ now, dim }) {
  const d = new Date(now);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className={`ah${dim ? " is-dim" : ""}`} aria-hidden>
      <div className="ah-status">
        <span>{time}</span>
        <span className="ah-status-icons">
          <i className="ah-wifi" />
          <i className="ah-signal" />
          <i className="ah-battery" />
        </span>
      </div>

      <div className="ah-clock">
        <strong>{time}</strong>
        <span>{date}</span>
      </div>

      <div className="ah-search">
        <i />
      </div>

      <div className="ah-grid">
        {APPS.map((a) => (
          <span key={a.name} className="ah-app">
            <span className="ah-icon" style={{ background: a.bg }}>
              <Glyph shape={a.shape} color={a.fg} />
            </span>
            <small>{a.name}</small>
          </span>
        ))}
      </div>

      <div className="ah-dock">
        {DOCK.map((a, i) => (
          <span key={i} className="ah-icon" style={{ background: a.bg }}>
            <Glyph shape={a.shape} color={a.shape === "globe" ? "#1a73e8" : "#fff"} />
          </span>
        ))}
      </div>

      <div className="ah-nav">
        <i />
      </div>
    </div>
  );
}

import { AccountShell } from "../components/AccountShell";
import { ChevronDownIcon, HeadsetIcon, MessageIcon } from "../components/Icons";
import { SUPPORT } from "../config";

const FAQ = [
  {
    q: "How to install a game or app",
    a: (
      <>
        Open your device and press <b>Install APK</b> in the toolbar, then pick an <code>.apk</code> file (up to 500 MB). You can also download
        APKs with the browser inside Android. Google Play isn&apos;t preinstalled.
      </>
    ),
  },
  {
    q: "How to control the cloud phone",
    a: (
      <>
        Click to tap, click and drag to swipe, and use the mouse wheel to scroll. Type with your keyboard; <b>Ctrl+V</b> pastes text from your
        computer. The side buttons give you Back, Home, Recent apps, volume, power, rotate and notifications. Lower the bitrate or frame rate if
        your connection is slow.
      </>
    ),
  },
  {
    q: "How to restart or reset a cloud phone",
    a: (
      <>
        Press the gear button next to the device name on <b>My Cloud Phones</b>. <b>Reboot</b> restarts Android and keeps your data. <b>Reset</b>{" "}
        erases all apps and data.
      </>
    ),
  },
  {
    q: "Why did my device stop?",
    a: (
      <>
        Devices stop when your plan expires. Your apps and data are kept — renew your plan (for example with a renewal code under{" "}
        <b>Redeem Code</b>) and press <b>Power on</b>.
      </>
    ),
  },
  {
    q: "How to renew or add more time",
    a: (
      <>
        Go to <b>Subscriptions</b> to see your remaining days, or redeem a renewal code under <b>Redeem Code → Renew cloud phone</b>. Renewing
        extends every device on your plan.
      </>
    ),
  },
  {
    q: "There's no sound on my device",
    a: <>Audio streaming needs Android 11 or newer, so Android 10 devices play without sound. Also check that your browser tab isn&apos;t muted.</>,
  },
];

export default function Support() {
  const { chatUrl, businessEmail, discordUrl, email } = SUPPORT;

  return (
    <AccountShell title="Support">
      <div className="sp">
        {chatUrl && (
          <a href={chatUrl} className="sp-card sp-chat" target="_blank" rel="noopener noreferrer">
            <span className="sp-icon">
              <HeadsetIcon />
            </span>
            <span className="sp-text">
              <strong>Online customer service</strong>
              <small>Questions about devices, billing or your account</small>
            </span>
          </a>
        )}

        {businessEmail && (
          <a href={`mailto:${businessEmail}`} className="sp-card sp-business">
            <span className="sp-icon">
              <MessageIcon />
            </span>
            <span className="sp-text">
              <strong>Business Cooperation</strong>
              <small>{businessEmail}</small>
            </span>
          </a>
        )}

        {discordUrl && (
          <section className="sp-community">
            <h2>Community</h2>
            <a href={discordUrl} target="_blank" rel="noopener noreferrer" className="sp-discord">
              <DiscordIcon />
              Discord
            </a>
          </section>
        )}

        {!chatUrl && !businessEmail && !discordUrl && <p className="muted sp-none">Contact channels haven&apos;t been set up yet.</p>}

        <section className="sp-faq">
          <h2>FAQ</h2>
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <ChevronDownIcon />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
          {email && (
            <p className="sp-more">
              Still stuck? Email <a href={`mailto:${email}`}>{email}</a>
            </p>
          )}
        </section>
      </div>
    </AccountShell>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.6 5.3A16.6 16.6 0 0 0 15.5 4l-.5 1a15.4 15.4 0 0 0-6 0L8.5 4a16.6 16.6 0 0 0-4.1 1.3C1.8 9.2 1.1 13 1.4 16.7a16.8 16.8 0 0 0 5.1 2.6l1.1-1.7c-.6-.2-1.2-.5-1.7-.9l.4-.3a11.9 11.9 0 0 0 11.4 0l.4.3c-.5.4-1.1.7-1.7.9l1.1 1.7a16.7 16.7 0 0 0 5.1-2.6c.4-4.3-.7-8-2.9-11.4zM8.7 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z" />
    </svg>
  );
}

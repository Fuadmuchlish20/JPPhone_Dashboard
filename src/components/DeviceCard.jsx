import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { deviceAction } from "../api";
import { formatRam, timeLeft } from "../api/format";
import { ActionButton } from "./ActionButton";
import { AndroidHome } from "./AndroidHome";
import { DeviceMenu } from "./DeviceSheet";
import { PowerIcon } from "./Icons";
import { Player } from "./Player";

export const TRANSITIONAL = new Set(["creating", "starting", "stopping"]);

export const STATUS_LABEL = {
  running: "Running",
  stopped: "Powered off",
  creating: "Creating…",
  starting: "Booting…",
  stopping: "Shutting down…",
  error: "Error",
};

const EXPIRING_DAYS = 3;

export function DeviceCard({ device, now, renewHref, planName }) {
  const s = device.status;
  const running = s === "running";
  const busy = TRANSITIONAL.has(s);
  const left = timeLeft(device.expiresAt, now);
  const [playing, setPlaying] = useState(false);
  const closePlayer = useCallback(() => setPlaying(false), []);

  return (
    <article className="dd-card">
      <div className="dd-screen">
        <span className={`dd-status dd-status-${s}`}>{STATUS_LABEL[s] ?? s}</span>

        <div className="dd-screen-inner">
          <AndroidHome now={now} dim={!running} />
          {!running && (
            <div className={`dd-placeholder${busy ? " is-busy" : ""}`}>
              {busy ? <span className="dd-spinner" /> : <PowerIcon />}
              <span>{STATUS_LABEL[s]}</span>
            </div>
          )}
        </div>

        {left.days < EXPIRING_DAYS ? (
          <div className={`dd-expire${left.days <= 0 ? " is-expired" : ""}`}>
            <span>{left.days <= 0 ? "Plan expired" : `Expires in ${left.label.replace(" left", "")}`}</span>
            <Link to={renewHref} className="dd-renew">
              Renew
            </Link>
          </div>
        ) : (
          <span className="dd-left">{left.label}</span>
        )}

        <div className="dd-hover">
          {running ? (
            <button className="dd-enter" onClick={() => setPlaying(true)}>
              Enter
            </button>
          ) : (
            !busy && <ActionButton action={() => deviceAction(device.id, "start")} label="Power on" className="dd-enter" />
          )}
        </div>
      </div>

      <div className="dd-info-row">
        <div className="dd-info">
          <strong title={device.name}>{device.name}</strong>
          <span>
            {device.cpu}C · {formatRam(device.ramMb)} · {device.storageGb}G · Android {device.androidVersion}
          </span>
        </div>
        <DeviceMenu device={device} busy={busy} now={now} planName={planName} renewHref={renewHref} />
      </div>
      {s === "error" && device.statusMessage && <p className="dd-error">{device.statusMessage}</p>}
      {playing && <Player deviceId={device.id} onExit={closePlayer} />}
    </article>
  );
}

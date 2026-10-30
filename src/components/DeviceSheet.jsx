import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { PLANS, deviceAction, planBySlug, renameDevice, setRoot } from "../api";
import { preciseLeft } from "../api/format";
import { ActionButton } from "./ActionButton";

// Leaflet is heavy; load the map only when someone opens GPS changer.
const GpsDialog = lazy(() => import("./GpsDialog").then((m) => ({ default: m.GpsDialog })));
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  EditIcon,
  FolderUpIcon,
  GearIcon,
  GemIcon,
  ImageIcon,
  InstallIcon,
  PointerIcon,
  PowerIcon,
  RestartIcon,
  RootIcon,
  ShieldIcon,
  SwapIcon,
  TargetIcon,
} from "./Icons";

export const REBOOT_CONFIRM = "This operation will shut down all your running apps, are you sure?";
const RESET_CONFIRM = "This will erase all data from your cloud phone's internal storage, are you sure?";
const ROOT_TIPS = ["Some app may not run properly after changing root status.", "Changing root status requires phone reboot."];

// Shown in the grid to match the planned feature set; tapping explains they're not available yet.
const SOON = [{ label: "Authorization", icon: ShieldIcon }];

/** Gear button next to the device name; opens the device settings sheet. */
export function DeviceMenu({ device, busy, now, planName, renewHref }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);

  return (
    <>
      <button
        ref={trigger}
        className={`dm-menu-btn${open ? " is-open" : ""}`}
        onClick={() => setOpen(true)}
        aria-label={`Settings for ${device.name}`}
        aria-haspopup="dialog"
      >
        <GearIcon />
      </button>
      {open &&
        createPortal(
          <DeviceSheet
            device={device}
            busy={busy}
            now={now}
            planName={planName}
            renewHref={renewHref}
            onClose={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          />,
          document.body,
        )}
    </>
  );
}

function DeviceSheet({ device, busy, now, planName, renewHref, onClose }) {
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState(null);
  const [gpsOpen, setGpsOpen] = useState(false);
  const closeRef = useRef(null);
  const running = device.status === "running";
  const plan = planBySlug(device.planSlug);
  // Why a tile can't run right now (shown under the grid instead of disabling the tile).
  const blocked = (needsRunning) =>
    busy ? "Please wait until the device finishes its current operation." : needsRunning && !running ? "Turn on the device first." : null;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  function copyId() {
    navigator.clipboard?.writeText(device.id).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  }

  const soonTile = (t) => <SoonTile key={t.label} {...t} onPick={(label) => setNote(`${label} isn't available yet.`)} />;

  return (
    <div className="ds-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ds" role="dialog" aria-modal="true" aria-labelledby={`ds-title-${device.id}`}>
        <header className="ds-head">
          <span className="ds-avatar" aria-hidden>
            {(planName ?? device.name).charAt(0).toUpperCase()}
          </span>
          <div className="ds-meta">
            {renaming ? (
              <RenameForm device={device} onDone={() => setRenaming(false)} />
            ) : (
              <div className="ds-title-row">
                <h2 id={`ds-title-${device.id}`}>{device.name}</h2>
                <span className="ds-chip">{device.androidVersion}.0</span>
                {planName && <span className="ds-chip ds-chip-plan">{planName}</span>}
                {device.rooted && <span className="ds-chip ds-chip-root">Root</span>}
                <button className="ds-mini" onClick={() => setRenaming(true)} aria-label="Rename device">
                  <EditIcon />
                </button>
              </div>
            )}
            <p>
              Device ID: <code title={device.id}>{device.id.toUpperCase()}</code>
              <button className="ds-mini" onClick={copyId} aria-label="Copy device ID">
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            </p>
            <p>
              Time left:{" "}
              <b className={new Date(device.expiresAt).getTime() - now < 3 * 86_400_000 ? "dd-warn-text" : undefined}>
                {preciseLeft(device.expiresAt, now)}
              </b>
            </p>
          </div>
          <button ref={closeRef} className="ds-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <div className="ds-grid">
          {SOON.slice(0, 1).map(soonTile)}
          <NoteTile
            icon={<PointerIcon />}
            label="Customize"
            onPick={() => (blocked(false) ? setNote(blocked(false)) : navigate(`/device/${device.id}/customize`))}
          />
          <NoteTile
            icon={<SwapIcon />}
            label="Replace"
            onPick={() => (blocked(false) ? setNote(blocked(false)) : navigate(`/device/${device.id}/replace`))}
          />
          <NoteTile icon={<GemIcon />} label="Gem" onPick={() => navigate(`/gem?device=${device.id}`)} />
          {!plan?.rootAccess ? (
            <NoteTile
              icon={<RootIcon />}
              label="Root"
              onPick={() => setNote(`Root isn't included in ${plan?.name ?? "this plan"} — available on ${PLANS.filter((p) => p.rootAccess).map((p) => p.name).join(", ")}.`)}
            />
          ) : blocked(false) ? (
            <NoteTile icon={<RootIcon />} label="Root" onPick={() => setNote(blocked(false))} />
          ) : (
            <ActionButton
              action={() => setRoot(device.id, !device.rooted)}
              label={device.rooted ? "Root: on" : "Root: off"}
              icon={<Tile icon={<RootIcon />} label={device.rooted ? "Root · On" : "Root"} />}
              className={`ds-tile${device.rooted ? " is-on" : ""}`}
              confirm={ROOT_TIPS}
              confirmTitle="Tips"
              confirmLabel={device.rooted ? "Disable root" : "Enable root"}
              onDone={() => setNote(device.rooted ? "Disabling root — the device is rebooting…" : "Enabling root — the device is rebooting…")}
            />
          )}
          {blocked(false) ? (
            <NoteTile icon={<PowerIcon />} label="Reboot" onPick={() => setNote(blocked(false))} />
          ) : (
            <ActionButton
              action={() => deviceAction(device.id, "restart")}
              label="Reboot"
              icon={<Tile icon={<PowerIcon />} label="Reboot" />}
              className="ds-tile"
              confirm={REBOOT_CONFIRM}
              onDone={() => setNote("Rebooting…")}
            />
          )}
          {blocked(false) ? (
            <NoteTile icon={<RestartIcon />} label="Reset" onPick={() => setNote(blocked(false))} />
          ) : (
            <ActionButton
              action={() => deviceAction(device.id, "reset")}
              label="Reset"
              icon={<Tile icon={<RestartIcon />} label="Reset" />}
              className="ds-tile"
              confirm={RESET_CONFIRM}
              onDone={() => setNote("Device reset to factory settings.")}
            />
          )}
          {blocked(true) ? (
            <NoteTile icon={<ImageIcon />} label="Screenshot" onPick={() => setNote(blocked(true))} />
          ) : (
            <NoteTile
              icon={<ImageIcon />}
              label="Screenshot"
              onPick={() => {
                window.open(`/device/${device.id}/screenshot`, "_blank", "noopener");
                setNote("Screenshot opened in a new tab.");
              }}
            />
          )}
          {blocked(true) ? (
            <NoteTile icon={<InstallIcon />} label="Install" onPick={() => setNote(blocked(true))} />
          ) : (
            <NoteTile icon={<InstallIcon />} label="Install" onPick={() => navigate(`/device/${device.id}/install`)} />
          )}
          <NoteTile
            icon={<FolderUpIcon />}
            label="Upload File"
            onPick={() => (blocked(true) ? setNote(blocked(true)) : navigate(`/device/${device.id}/upload`))}
          />
          <NoteTile icon={<TargetIcon />} label="GPS changer" onPick={() => (blocked(false) ? setNote(blocked(false)) : setGpsOpen(true))} />
        </div>
        {note && (
          <p className="ds-soon" role="status">
            {note}
          </p>
        )}
        {device.gps && (
          <p className="ds-gps">
            <TargetIcon /> GPS: {device.gps.label ?? `${device.gps.lat}, ${device.gps.lng}`}
          </p>
        )}
        {gpsOpen && (
          <Suspense fallback={<p className="ds-soon">Loading map…</p>}>
            <GpsDialog device={device} onClose={() => setGpsOpen(false)} />
          </Suspense>
        )}

        <footer className="ds-foot">
          <Link to={renewHref} className="ds-btn">
            Renew
          </Link>
          {running ? (
            <Link to={`/device/${device.id}`} className="ds-btn ds-btn-primary">
              Open cloud phone
            </Link>
          ) : (
            <ActionButton action={() => deviceAction(device.id, "start")} label="Power on to use" className="ds-btn ds-btn-primary" disabled={busy} />
          )}
        </footer>
      </div>
    </div>
  );
}

function SoonTile({ label, icon: Icon, onPick }) {
  return (
    <button className="ds-tile" onClick={() => onPick(label)}>
      <Icon />
      <span>{label}</span>
    </button>
  );
}

/** Looks and clicks like an action tile, but runs a plain callback. */
function NoteTile({ icon, label, onPick }) {
  return (
    <button className="ds-tile" onClick={onPick}>
      <Tile icon={icon} label={label} />
    </button>
  );
}

function Tile({ icon, label }) {
  return (
    <>
      {icon}
      <span>{label}</span>
    </>
  );
}

function RenameForm({ device, onDone }) {
  const [name, setName] = useState(device.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setPending(true);
    const res = await renameDevice(device.id, name);
    setPending(false);
    if (res.error) setError(res.error);
    else onDone();
  }

  return (
    <form onSubmit={submit} className="ds-rename">
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoFocus aria-label="Device name" />
      <button className="ds-mini ds-mini-ok" disabled={pending} aria-label="Save name">
        <CheckIcon />
      </button>
      <button type="button" className="ds-mini" onClick={onDone} aria-label="Cancel rename">
        <CloseIcon />
      </button>
      {error && <span className="form-error">{error}</span>}
    </form>
  );
}

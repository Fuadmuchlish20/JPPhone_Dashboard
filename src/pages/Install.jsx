import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PLAN_THEMES, installApps, planBySlug, useStore } from "../api";
import { formatDate, formatSize } from "../api/format";
import { STATUS_LABEL } from "../components/DeviceCard";
import { ArrowLeftIcon, CheckIcon, CloseIcon, InstallIcon, UploadIcon } from "../components/Icons";
import { STORE_GAMES, STORE_SOFTWARE, UPLOAD_LIMIT_MB } from "../data/apps";
import { gamesForPlan } from "../data/games";
import NotFound from "./NotFound";

/** Bulk install: pick store apps or upload APKs, then install them on one or more running cloud phones. */
export default function Install() {
  const { id } = useParams();
  const { devices, installs } = useStore();
  const [showHistory, setShowHistory] = useState(false);
  const device = devices.find((d) => d.id === id);

  if (!device) return <NotFound />;
  const theme = PLAN_THEMES[device.planSlug] ?? "slate";

  return (
    <div className={`nd nd-v2 rp ia dm-${theme}`}>
      <header className="nd-top">
        <Link to="/" className="nd-top-btn" aria-label="Back to devices">
          <ArrowLeftIcon />
        </Link>
        <h1>{showHistory ? "Install history" : "Bulk Install Apps"}</h1>
        <button className="rp-history-btn" onClick={() => setShowHistory((v) => !v)} aria-pressed={showHistory}>
          {showHistory ? "Back" : "History"}
        </button>
      </header>

      {showHistory ? <History installs={installs} /> : <InstallForm key={device.id} device={device} devices={devices} />}
    </div>
  );
}

function InstallForm({ device, devices }) {
  // Backend lists which catalog apps have an APK on the server; offline everything is installable.
  const storeApps = useStore((s) => s.storeApps);
  const [tab, setTab] = useState("store");
  const [kind, setKind] = useState("game");
  const [picked, setPicked] = useState({}); // key -> { name, source }
  const [uploads, setUploads] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const [targets, setTargets] = useState(() => (device.status === "running" ? [device.id] : []));
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  // Games listed for any target's plan are "recommended"; the rest may run slowly on that hardware.
  const targetDevices = devices.filter((d) => targets.includes(d.id));
  const targetPlans = [...new Set((targetDevices.length ? targetDevices : [device]).map((d) => d.planSlug))];
  const recommended = new Set(targetPlans.flatMap((slug) => gamesForPlan(slug)));
  const planNames = targetPlans.map((slug) => planBySlug(slug)?.name).join(" / ");
  const games = [...STORE_GAMES].sort((a, b) => recommended.has(b.key) - recommended.has(a.key));
  const list = kind === "game" ? games : STORE_SOFTWARE;

  const pickedApps = Object.values(picked);
  const offPlan = STORE_GAMES.filter((g) => picked[`store:${g.key}`] && !recommended.has(g.key));

  function toggle(key, app) {
    setResult(null);
    setPicked((p) => {
      const next = { ...p };
      if (next[key]) delete next[key];
      else next[key] = app;
      return next;
    });
  }

  function addFiles(files) {
    setUploadError(null);
    const added = [];
    for (const f of files) {
      if (!/\.(apk|xapk)$/i.test(f.name)) {
        setUploadError(`${f.name} isn't an .apk or .xapk file.`);
        continue;
      }
      if (f.size > UPLOAD_LIMIT_MB * 1024 * 1024) {
        setUploadError(`${f.name} is larger than ${UPLOAD_LIMIT_MB / 1024} GB.`);
        continue;
      }
      added.push({ key: `upload:${f.name}:${f.size}`, name: f.name, sizeMb: f.size / 1024 / 1024, file: f });
    }
    setUploads((u) => [...u, ...added.filter((a) => !u.some((x) => x.key === a.key))]);
    setPicked((p) => Object.fromEntries([...Object.entries(p), ...added.map((a) => [a.key, { name: a.name, source: "upload", file: a.file }])]));
  }

  function removeUpload(key) {
    setUploads((u) => u.filter((x) => x.key !== key));
    setPicked((p) => {
      const next = { ...p };
      delete next[key];
      return next;
    });
  }

  function toggleTarget(id) {
    setResult(null);
    setTargets((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  }

  async function submit() {
    setPending(true);
    setResult(null);
    const res = await installApps(targets, pickedApps);
    setPending(false);
    if (res.ok) {
      setPicked({});
      setUploads([]);
      setResult({ ok: true, message: `Installing ${pickedApps.length} app(s) on ${targets.length} cloud phone(s)…` });
    } else setResult(res);
  }

  return (
    <>
      <div className="ia-tabs" role="tablist" aria-label="Source">
        {[
          ["store", "Cloud store"],
          ["upload", "Local upload"],
        ].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`ia-tab${tab === k ? " is-active" : ""}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      <div className="nd-body">
        {tab === "store" ? (
          <section className="nd-field">
            <div className="ia-seg" role="tablist" aria-label="Category">
              {[
                ["game", "Game"],
                ["software", "Software"],
              ].map(([k, label]) => (
                <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "is-active" : undefined} onClick={() => setKind(k)}>
                  {label}
                </button>
              ))}
            </div>
            <ul className="ia-list">
              {list.map((a) => {
                const key = `store:${a.key}`;
                const on = !!picked[key];
                const available = !storeApps || storeApps.includes(a.key);
                return (
                  <li key={a.key}>
                    <label className={`ia-row${on ? " is-on" : ""}${available ? "" : " is-unavailable"}`}>
                      <span className="ia-icon" style={{ "--h": a.hue }} aria-hidden>
                        {a.glyph}
                      </span>
                      <span className="ia-name">
                        <strong>
                          {a.name}
                          {kind === "game" && recommended.has(a.key) && <em>Recommended for {planNames}</em>}
                        </strong>
                        {available ? a.note && <small>{a.note}</small> : <small>Coming soon to this server</small>}
                      </span>
                      <input type="checkbox" checked={on} disabled={!available} onChange={() => toggle(key, { name: a.name, source: "store", key: a.key })} />
                      <span className="ia-check" aria-hidden>
                        <CheckIcon />
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <section className="nd-field">
            <label className="ia-drop">
              <UploadIcon />
              <strong>Choose APK files</strong>
              <small>.apk or .xapk, up to {UPLOAD_LIMIT_MB / 1024} GB each. You can pick several.</small>
              <input
                type="file"
                accept=".apk,.xapk"
                multiple
                hidden
                onChange={(e) => {
                  addFiles([...(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
            </label>
            {uploadError && <p className="nd-note">{uploadError}</p>}
            {uploads.length > 0 && (
              <ul className="ia-list">
                {uploads.map((u) => (
                  <li key={u.key}>
                    <div className="ia-row is-on">
                      <span className="ia-icon ia-icon-apk" aria-hidden>
                        <InstallIcon />
                      </span>
                      <span className="ia-name">
                        <strong>{u.name}</strong>
                        <small>{formatSize(u.sizeMb)}</small>
                      </span>
                      <button className="ds-mini" onClick={() => removeUpload(u.key)} aria-label={`Remove ${u.name}`}>
                        <CloseIcon />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="nd-field">
          <h2>Install to</h2>
          <div className="ia-targets">
            {devices.map((d) => {
              const running = d.status === "running";
              const on = targets.includes(d.id);
              return (
                <button
                  key={d.id}
                  className={`ia-target${on ? " is-on" : ""}`}
                  onClick={() => toggleTarget(d.id)}
                  disabled={!running}
                  aria-pressed={on}
                  title={running ? undefined : `${STATUS_LABEL[d.status] ?? d.status} — turn it on to install`}
                >
                  {on && <CheckIcon />}
                  {d.name}
                  <em>{running ? planBySlug(d.planSlug)?.name : (STATUS_LABEL[d.status] ?? d.status)}</em>
                </button>
              );
            })}
          </div>
          {offPlan.length > 0 && (
            <p className="nd-hint">
              {offPlan.map((g) => g.name).join(", ")} {offPlan.length > 1 ? "aren't" : "isn't"} in the recommended list for {planNames} and may run slowly.
            </p>
          )}
        </section>
      </div>

      <footer className="nd-bar">
        {result?.error && <p className="nd-error">{result.error}</p>}
        {result?.ok && <p className="nd-success">{result.message}</p>}
        <button className="nd-buy" disabled={pending || !pickedApps.length || !targets.length} onClick={submit}>
          {pending
            ? "Installing…"
            : pickedApps.length
              ? `Install ${pickedApps.length} app${pickedApps.length > 1 ? "s" : ""}${targets.length > 1 ? ` · ${targets.length} devices` : ""}`
              : "Install"}
        </button>
      </footer>
    </>
  );
}

function History({ installs }) {
  if (!installs.length) return <p className="muted rp-empty">No installs yet.</p>;
  return (
    <ul className="rp-history">
      {installs.map((i) => (
        <li key={i.id}>
          <span className="rp-history-icon" aria-hidden>
            <InstallIcon />
          </span>
          <div>
            <strong>
              {i.app} <em>{i.source === "upload" ? "APK" : "Store"}</em>
              <em className={i.status === "installed" ? "rp-tag-lossless" : "ia-tag-busy"}>{i.status === "installed" ? "Installed" : "Installing…"}</em>
            </strong>
            <span>{i.deviceName}</span>
          </div>
          <time dateTime={i.createdAt}>
            {formatDate(i.createdAt)} {new Date(i.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </time>
        </li>
      ))}
    </ul>
  );
}

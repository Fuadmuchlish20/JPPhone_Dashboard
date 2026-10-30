import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PLAN_THEMES, planBySlug, storageUsedGb, uploadFiles, useStore } from "../api";
import { formatDate, formatSize } from "../api/format";
import { STATUS_LABEL } from "../components/DeviceCard";
import { ArrowLeftIcon, CheckIcon, CloseIcon, FolderUpIcon, PlusIcon } from "../components/Icons";
import { UPLOAD_LIMIT_MB } from "../data/apps";
import NotFound from "./NotFound";

/** Upload files to /sdcard/Download on one or more running cloud phones; storage is capped by each device's plan ROM. */
export default function Upload() {
  const { id } = useParams();
  const { devices, uploads } = useStore();
  const [showList, setShowList] = useState(false);
  const device = devices.find((d) => d.id === id);

  if (!device) return <NotFound />;
  const theme = PLAN_THEMES[device.planSlug] ?? "slate";

  return (
    <div className={`nd nd-v2 rp ia dm-${theme}`}>
      <header className="nd-top">
        <Link to="/" className="nd-top-btn" aria-label="Back to devices">
          <ArrowLeftIcon />
        </Link>
        <h1>{showList ? "Uploaded files" : "Upload File"}</h1>
        <button className="rp-history-btn" onClick={() => setShowList((v) => !v)} aria-pressed={showList}>
          {showList ? "Back" : "List"}
        </button>
      </header>

      {showList ? <FileList uploads={uploads} /> : <UploadForm key={device.id} device={device} devices={devices} uploads={uploads} />}
    </div>
  );
}

function UploadForm({ device, devices, uploads }) {
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState(null);
  const [targets, setTargets] = useState(() => (device.status === "running" ? [device.id] : []));
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  const plan = planBySlug(device.planSlug);
  const usedGb = storageUsedGb(uploads, device.id);
  const pickedGb = files.reduce((sum, f) => sum + f.sizeMb / 1024, 0);
  const usedPct = Math.min(100, (usedGb / plan.storageGb) * 100);
  const pickedPct = Math.min(100 - usedPct, (pickedGb / plan.storageGb) * 100);

  function addFiles(list) {
    setFileError(null);
    setResult(null);
    const added = [];
    for (const f of list) {
      if (f.size > UPLOAD_LIMIT_MB * 1024 * 1024) {
        setFileError(`${f.name} is larger than ${UPLOAD_LIMIT_MB / 1024} GB.`);
        continue;
      }
      added.push({ key: `${f.name}:${f.size}`, name: f.name, sizeMb: f.size / 1024 / 1024, file: f });
    }
    setFiles((cur) => [...cur, ...added.filter((a) => !cur.some((x) => x.key === a.key))]);
  }

  function toggleTarget(id) {
    setResult(null);
    setTargets((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  }

  async function submit() {
    setPending(true);
    setResult(null);
    const res = await uploadFiles(targets, files);
    setPending(false);
    if (res.ok) {
      setResult({ ok: true, message: `Uploading ${files.length} file(s) to Download on ${targets.length} cloud phone(s)…` });
      setFiles([]);
    } else setResult(res);
  }

  return (
    <>
      <div className="nd-body">
        <section className="nd-field">
          <label className="up-add">
            <PlusIcon />
            Tap to add file
            <input
              type="file"
              multiple
              hidden
              onChange={(e) => {
                addFiles([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
          </label>
          {fileError && <p className="nd-note up-note">{fileError}</p>}
          {files.length > 0 && (
            <ul className="ia-list up-files">
              {files.map((f) => (
                <li key={f.key}>
                  <div className="ia-row">
                    <span className="ia-icon ia-icon-apk" aria-hidden>
                      <FolderUpIcon />
                    </span>
                    <span className="ia-name">
                      <strong>{f.name}</strong>
                      <small>{formatSize(f.sizeMb)}</small>
                    </span>
                    <button className="ds-mini" onClick={() => setFiles((cur) => cur.filter((x) => x.key !== f.key))} aria-label={`Remove ${f.name}`}>
                      <CloseIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="nd-field">
          <h2>
            Storage on {device.name} <span className="up-plan">{plan.name}</span>
          </h2>
          <div className="up-bar" role="img" aria-label={`${usedGb.toFixed(1)} of ${plan.storageGb} GB used`}>
            <span className="up-bar-used" style={{ width: `${usedPct}%` }} />
            <span className="up-bar-new" style={{ width: `${pickedPct}%` }} />
          </div>
          <p className="nd-hint">
            {usedGb.toFixed(1)} GB used{pickedGb > 0 && ` + ${formatSize(pickedGb * 1024)} selected`} of {plan.storageGb} GB. Files are saved to{" "}
            <code>/sdcard/Download</code>, up to {UPLOAD_LIMIT_MB / 1024} GB per file.
          </p>
        </section>

        <section className="nd-field">
          <h2>Upload to</h2>
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
                  title={running ? undefined : `${STATUS_LABEL[d.status] ?? d.status} — turn it on to upload`}
                >
                  {on && <CheckIcon />}
                  {d.name}
                  <em>{running ? planBySlug(d.planSlug)?.name : (STATUS_LABEL[d.status] ?? d.status)}</em>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="nd-bar">
        {result?.error && <p className="nd-error">{result.error}</p>}
        {result?.ok && <p className="nd-success">{result.message}</p>}
        <button className="nd-buy" disabled={pending || !files.length || !targets.length} onClick={submit}>
          {pending ? "Uploading…" : files.length ? `Upload ${files.length} file${files.length > 1 ? "s" : ""} · ${formatSize(pickedGb * 1024)}` : "Upload"}
        </button>
      </footer>
    </>
  );
}

function FileList({ uploads }) {
  if (!uploads.length) return <p className="muted rp-empty">No files uploaded yet.</p>;
  return (
    <ul className="rp-history">
      {uploads.map((u) => (
        <li key={u.id}>
          <span className="rp-history-icon" aria-hidden>
            <FolderUpIcon />
          </span>
          <div>
            <strong>
              {u.name}
              <em className={u.status === "done" ? "rp-tag-lossless" : "ia-tag-busy"}>{u.status === "done" ? "Uploaded" : "Uploading…"}</em>
            </strong>
            <span>
              {u.deviceName} · {formatSize(u.sizeMb)}
            </span>
          </div>
          <time dateTime={u.createdAt}>
            {formatDate(u.createdAt)} {new Date(u.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </time>
        </li>
      ))}
    </ul>
  );
}

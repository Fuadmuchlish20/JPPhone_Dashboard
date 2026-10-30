import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { takeScreenshot, useStore } from "../api";
import { RestartIcon } from "../components/Icons";

/** Full-screen capture of a cloud phone, opened in its own tab (no dashboard chrome). */
export default function Screenshot() {
  const { id } = useParams();
  const device = useStore().devices.find((d) => d.id === id);
  const [shot, setShot] = useState(null);
  const [error, setError] = useState(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let url = null;
    setError(null);
    takeScreenshot(id).then((res) => {
      if (res.ok) url = res.url;
      if (cancelled) return;
      if (res.ok) setShot(res);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, round]);

  useEffect(() => {
    document.title = shot ? `getPhoto (${shot.width}×${shot.height})` : "Screenshot";
  }, [shot]);

  const stamp = shot && new Date(shot.takenAt).toISOString().replace(/\D/g, "").slice(0, 14);

  return (
    <div className="ss">
      {shot ? (
        <img src={shot.url} width={shot.width} height={shot.height} alt={`Screenshot of ${device?.name ?? id}`} />
      ) : (
        <p className="ss-msg">{error ?? "Capturing screen…"}</p>
      )}
      <div className="ss-bar">
        <span>
          {device?.name ?? id}
          {shot && <small> · {new Date(shot.takenAt).toLocaleTimeString("en-GB")}</small>}
        </span>
        <button onClick={() => setRound((r) => r + 1)} aria-label="Take a new screenshot">
          <RestartIcon /> Retake
        </button>
        {shot && (
          <a href={shot.url} download={`${device?.name ?? id}-${stamp}.png`}>
            Download
          </a>
        )}
      </div>
    </div>
  );
}

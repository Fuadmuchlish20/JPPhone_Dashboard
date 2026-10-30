import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { REMOTE, deviceAction, planBySlug, screenUrl, sendInput, streamUrl, useStore } from "../api";
import { speed, useLatency } from "../api/latency";
import { AndroidHome } from "./AndroidHome";
import { ConfirmDialog } from "./ConfirmDialog";
import { STATUS_LABEL, TRANSITIONAL } from "./DeviceCard";
import { REBOOT_CONFIRM } from "./DeviceSheet";
import {
  ChevronRightIcon,
  ClipboardIcon,
  HeadsetIcon,
  LogoutIcon,
  RestartIcon,
  RotateIcon,
  TargetIcon,
  UploadIcon,
  VolumeDownIcon,
  VolumeUpIcon,
  WifiIcon,
} from "./Icons";

const GpsDialog = lazy(() => import("./GpsDialog").then((m) => ({ default: m.GpsDialog })));

const QUALITIES = ["Smooth", "HD", "Ultra HD"];
// Delay before fetching the next frame, by quality. Lower = smoother, more server load.
const FRAME_MS = { Smooth: 120, HD: 250, "Ultra HD": 400 };
const MAX_VOLUME = 15;
const KEY = { back: 4, home: 3, recents: 187, volUp: 24, volDown: 25 };

/**
 * Full-screen cloud phone player over the page: top bar (device, quality, latency), the screen,
 * Android nav keys and a tool rail. With the backend (VITE_BACKEND=1) the screen is the real phone
 * (screenshots refreshed back-to-back) and taps, swipes and keys go to it; offline it shows a placeholder.
 */
export function Player({ deviceId, onExit }) {
  const navigate = useNavigate();
  const { devices } = useStore();
  const [id, setId] = useState(deviceId);
  const device = devices.find((d) => d.id === id);
  const [now, setNow] = useState(() => Date.now());
  const [quality, setQuality] = useState("Smooth");
  const [landscape, setLandscape] = useState(false);
  const [volume, setVolume] = useState(8);
  const [panel, setPanel] = useState(null); // "devices" | "quality" | "clipboard"
  const [dialog, setDialog] = useState(null); // "reboot" | "gps"
  const [clip, setClip] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const control = useRef(null); // direct scrcpy control channel while live video is on (null = use adb input)
  const panelRef = useRef(panel);
  panelRef.current = panel;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    // Esc closes an open menu first, then the player.
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (panelRef.current) setPanel(null);
      else onExit();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearInterval(t);
      clearTimeout(toastTimer.current);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onExit]);

  const latencies = useLatency();

  if (!device) return null;

  const plan = planBySlug(device.planSlug);
  const running = device.status === "running";
  const busy = TRANSITIONAL.has(device.status);
  const latency = latencies[device.region] ?? { ms: 0, live: false };

  function say(text) {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }

  const live = REMOTE && running;

  /** Send to the phone in backend mode; show what happened either way. */
  async function act(ev, message) {
    if (live && control.current && (ev.type === "key" || ev.type === "text")) {
      control.current(ev.type === "key" ? { t: "key", code: ev.code } : { t: "text", text: ev.text });
    } else if (live) {
      const res = await sendInput(device.id, ev);
      if (res?.error) return say(res.error);
    }
    if (message) say(message);
  }

  function changeVolume(delta) {
    const next = Math.min(MAX_VOLUME, Math.max(0, volume + delta));
    setVolume(next);
    act({ type: "key", code: delta > 0 ? KEY.volUp : KEY.volDown }, `Volume ${next}/${MAX_VOLUME}`);
  }

  function rotate() {
    const next = !landscape;
    setLandscape(next);
    act({ type: "rotate", landscape: next });
  }

  function leaveTo(path) {
    onExit();
    navigate(path);
  }

  const tools = [
    { label: "Volume up", iconOnly: true, icon: <VolumeUpIcon />, run: () => changeVolume(1) },
    { label: "Volume down", iconOnly: true, icon: <VolumeDownIcon />, run: () => changeVolume(-1), divider: true },
    { label: "Upload", icon: <UploadIcon />, run: () => leaveTo(`/device/${device.id}/upload`) },
    { label: "Contact us", icon: <HeadsetIcon />, run: () => leaveTo("/support") },
    { label: "Clipboard", icon: <ClipboardIcon />, run: () => setPanel((p) => (p === "clipboard" ? null : "clipboard")) },
    { label: "Rotate", icon: <RotateIcon />, run: rotate },
    { label: "Reboot", icon: <RestartIcon />, run: () => setDialog("reboot"), disabled: busy },
    { label: "GPS changer", icon: <TargetIcon />, run: () => setDialog("gps"), disabled: busy },
    { label: "Exit", icon: <LogoutIcon />, run: onExit },
  ];

  return createPortal(
    <div className="py" role="dialog" aria-modal="true" aria-label={`${device.name} cloud phone`}>
      <div className={`py-stage${landscape ? " is-landscape" : ""}`}>
        <header className="py-top">
          <button className="py-device" onClick={() => setPanel((p) => (p === "devices" ? null : "devices"))} aria-expanded={panel === "devices"}>
            <span className="py-badge" aria-hidden>
              {plan.name.charAt(0)}
            </span>
            {device.name}
            <ChevronRightIcon />
          </button>
          <span className="spacer" />
          <div className="py-pop-wrap">
            <button className="py-quality" onClick={() => setPanel((p) => (p === "quality" ? null : "quality"))} aria-expanded={panel === "quality"}>
              {quality} ▾
            </button>
            {panel === "quality" && (
              <ul className="py-menu py-menu-right" role="listbox" aria-label="Picture quality">
                {QUALITIES.map((q) => (
                  <li key={q}>
                    <button
                      role="option"
                      aria-selected={q === quality}
                      onClick={() => {
                        setQuality(q);
                        setPanel(null);
                        say(`Picture quality: ${q}`);
                      }}
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {panel === "devices" && (
            <ul className="py-menu" aria-label="Switch cloud phone">
              {devices.map((d) => (
                <li key={d.id}>
                  <button
                    className={d.id === device.id ? "is-current" : undefined}
                    onClick={() => {
                      setId(d.id);
                      setPanel(null);
                      setLandscape(false);
                    }}
                  >
                    <span className="py-badge" aria-hidden>
                      {planBySlug(d.planSlug).name.charAt(0)}
                    </span>
                    {d.name}
                    <small>{STATUS_LABEL[d.status] ?? d.status}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </header>

        <div className={`py-screen${live ? " is-live" : ""}`}>
          <div className="py-screen-inner">
            {live ? <LiveView key={device.id} device={device} quality={quality} onError={say} onControl={(fn) => (control.current = fn)} /> : <AndroidHome now={now} dim={!running} />}
          </div>
          {!running && (
            <div className={`dd-placeholder${busy ? " is-busy" : ""}`}>
              {busy ? <span className="dd-spinner" /> : null}
              <span>{STATUS_LABEL[device.status] ?? device.status}</span>
              {!busy && (
                <button className="py-power" onClick={() => deviceAction(device.id, "start")}>
                  Power on
                </button>
              )}
            </div>
          )}
          {toast && (
            <p className="py-toast" role="status">
              {toast}
            </p>
          )}
        </div>

        <nav className="py-keys" aria-label="Android keys">
          <button onClick={() => act({ type: "key", code: KEY.back }, live ? null : "Back")} aria-label="Back" disabled={!running}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M16 5 7 12l9 7z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </button>
          <button onClick={() => act({ type: "key", code: KEY.home }, live ? null : "Home")} aria-label="Home" disabled={!running}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
          <button onClick={() => act({ type: "key", code: KEY.recents }, live ? null : "Recent apps")} aria-label="Recent apps" disabled={!running}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </nav>
      </div>

      <aside className="py-rail" aria-label="Tools">
        <span className={`py-latency py-latency-${speed(latency.ms)}`} title={latency.live ? "Latency measured from your browser" : "Estimated latency"}>
          <WifiIcon />
          {latency.live ? "" : "~"}
          {latency.ms}ms
        </span>
        {tools.map((t) => (
          <span key={t.label} className={t.divider ? "py-tool-wrap has-divider" : "py-tool-wrap"}>
            <button className="py-tool" onClick={t.run} disabled={t.disabled} aria-label={t.label} title={t.label}>
              {t.icon}
              {!t.iconOnly && <small>{t.label}</small>}
            </button>
          </span>
        ))}
        {panel === "clipboard" && (
          <form
            className="py-clip"
            onSubmit={(e) => {
              e.preventDefault();
              if (!clip.trim()) return;
              act({ type: "text", text: clip }, "Text sent to the cloud phone");
              setClip("");
              setPanel(null);
            }}
          >
            <label htmlFor="py-clip-text">Send text to the cloud phone</label>
            <textarea id="py-clip-text" value={clip} onChange={(e) => setClip(e.target.value)} rows={4} maxLength={1000} autoFocus placeholder="Tap a text field on the phone first — this text is typed into it." />
            <div>
              <button type="button" onClick={() => setPanel(null)}>
                Cancel
              </button>
              <button className="py-clip-send" disabled={!clip.trim()}>
                Send
              </button>
            </div>
          </form>
        )}
      </aside>

      {dialog === "reboot" && (
        <ConfirmDialog
          title="Reboot"
          message={REBOOT_CONFIRM}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            deviceAction(device.id, "restart");
          }}
        />
      )}
      {dialog === "gps" && (
        <Suspense fallback={null}>
          <GpsDialog device={device} onClose={() => setDialog(null)} />
        </Suspense>
      )}
    </div>,
    document.body,
  );
}

/** Real phone: H.264 video when the server and browser support it, screenshots otherwise. */
function LiveView({ device, quality, onError, onControl }) {
  const [mode, setMode] = useState(() => (typeof window.VideoDecoder === "function" ? "video" : "frames"));
  return mode === "video" ? (
    <LiveVideo key={quality} device={device} quality={quality} onError={onError} onControl={onControl} onFallback={() => setMode("frames")} />
  ) : (
    <LiveScreen device={device} frameMs={FRAME_MS[quality]} onError={onError} />
  );
}

/** Click = tap, drag = swipe, mapped from the element to phone pixels (720×1280, or 1280×720 when landscape). */
function useTouch(device, onError, afterSend) {
  const down = useRef(null);

  function toPhone(e) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const wide = (el.naturalWidth ?? el.width) > (el.naturalHeight ?? el.height);
    const [w, h] = wide ? [1280, 720] : [720, 1280];
    return { x: ((e.clientX - rect.left) / rect.width) * w, y: ((e.clientY - rect.top) / rect.height) * h };
  }

  return {
    onPointerDown(e) {
      e.currentTarget.setPointerCapture(e.pointerId);
      down.current = { ...toPhone(e), t: performance.now() };
    },
    async onPointerUp(e) {
      const start = down.current;
      down.current = null;
      if (!start) return;
      const end = toPhone(e);
      const moved = Math.hypot(end.x - start.x, end.y - start.y) > 12;
      const ev = moved ? { type: "swipe", x: start.x, y: start.y, x2: end.x, y2: end.y, ms: Math.min(2000, Math.max(80, performance.now() - start.t)) } : { type: "tap", x: start.x, y: start.y };
      const res = await sendInput(device.id, ev);
      if (res?.error) onError(res.error);
      afterSend?.();
    },
  };
}

/** H.264 Annex-B config packet → WebCodecs codec string, e.g. "avc1.42c01f" (from the SPS: profile, constraints, level). */
function avcCodec(config) {
  for (let i = 0; i + 4 < config.length; i++) {
    const startCode = config[i] === 0 && config[i + 1] === 0 && (config[i + 2] === 1 || (config[i + 2] === 0 && config[i + 3] === 1));
    if (!startCode) continue;
    const nal = i + (config[i + 2] === 1 ? 3 : 4);
    if ((config[nal] & 0x1f) === 7 && nal + 3 < config.length) {
      return "avc1." + [config[nal + 1], config[nal + 2], config[nal + 3]].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  }
  return null;
}

/**
 * Touch straight to scrcpy over the video WebSocket: real down / move / up in video-frame pixels,
 * so drags, holds and swipes behave like a finger. Moves are sent at most once per animation frame.
 */
function useDirectTouch(send) {
  const down = useRef(false);
  const pending = useRef(null);
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function pos(e) {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const clamp = (v, max) => Math.min(max, Math.max(0, Math.round(v)));
    return { x: clamp(((e.clientX - r.left) / r.width) * c.width, c.width), y: clamp(((e.clientY - r.top) / r.height) * c.height, c.height), w: c.width, h: c.height };
  }

  function lift(e) {
    if (!down.current) return;
    down.current = false;
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    send({ t: "touch", a: 1, ...pos(e) });
  }

  return {
    onPointerDown(e) {
      e.currentTarget.setPointerCapture(e.pointerId);
      down.current = true;
      send({ t: "touch", a: 0, ...pos(e) });
    },
    onPointerMove(e) {
      if (!down.current) return;
      pending.current = pos(e);
      raf.current ||= requestAnimationFrame(() => {
        raf.current = 0;
        if (down.current) send({ t: "touch", a: 2, ...pending.current });
      });
    },
    onPointerUp: lift,
    onPointerCancel: lift,
  };
}

/**
 * Live video: the server relays scrcpy H.264 over a WebSocket — first a JSON "meta" message, then binary
 * packets [flags u8 (1 = config, 2 = key)][pts u64][Annex-B data]. Decoded with WebCodecs onto a canvas.
 * When the server announces "control", input goes back over the same socket.
 */
function LiveVideo({ device, quality, onError, onControl, onFallback }) {
  const canvas = useRef(null);
  const socket = useRef(null);
  const fallback = useRef(onFallback);
  fallback.current = onFallback;
  const controlCb = useRef(onControl);
  controlCb.current = onControl;
  const [ready, setReady] = useState(false);
  const [direct, setDirect] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const adbTouch = useTouch(device, onError);
  const directTouch = useDirectTouch((msg) => socket.current?.readyState === WebSocket.OPEN && socket.current.send(JSON.stringify(msg)));

  useEffect(() => {
    let decoder = null;
    let config = null;
    let needKey = true;
    let shown = false;
    let disposed = false;
    let retry = null;
    const ws = new WebSocket(streamUrl(device.id, quality));
    ws.binaryType = "arraybuffer";
    socket.current = ws;
    const sendControl = (msg) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg));

    // Before the first picture, any failure means "no video here" → screenshots. Afterwards, reconnect.
    const failed = () => {
      if (disposed) return;
      if (!shown) {
        disposed = true;
        fallback.current();
      } else retry ??= setTimeout(() => setAttempt((n) => n + 1), 1500);
    };

    function draw(frame) {
      const c = canvas.current;
      if (c) {
        if (c.width !== frame.displayWidth || c.height !== frame.displayHeight) {
          c.width = frame.displayWidth;
          c.height = frame.displayHeight;
        }
        c.getContext("2d").drawImage(frame, 0, 0);
      }
      frame.close();
      if (!shown) {
        shown = true;
        setReady(true);
      }
    }

    ws.onmessage = (e) => {
      if (typeof e.data === "string") {
        const msg = JSON.parse(e.data);
        if (msg.type === "unsupported") failed();
        if (msg.type === "control") {
          setDirect(true);
          controlCb.current?.(sendControl);
        }
        return;
      }
      const bytes = new Uint8Array(e.data);
      const flags = bytes[0];
      const timestamp = Number(new DataView(e.data).getBigUint64(1));
      const data = bytes.subarray(9);
      if (flags & 1) {
        // New SPS/PPS (first packet, or the phone rotated): (re)configure the decoder.
        const codec = avcCodec(data);
        if (!codec) return;
        config = data.slice();
        if (decoder?.state !== "closed") decoder?.close();
        decoder = new VideoDecoder({ output: draw, error: failed });
        decoder.configure({ codec, optimizeForLatency: true });
        needKey = true;
        return;
      }
      if (!decoder || decoder.state !== "configured") return;
      const key = Boolean(flags & 2);
      if (needKey && !key) return;
      if (!key && decoder.decodeQueueSize > 8) return; // falling behind: skip to the next key frame
      needKey = false;
      let payload = data;
      if (key) {
        // Key frames carry the SPS/PPS in front so the decoder can start (or restart) from them.
        payload = new Uint8Array(config.length + data.length);
        payload.set(config);
        payload.set(data, config.length);
      }
      decoder.decode(new EncodedVideoChunk({ type: key ? "key" : "delta", timestamp, data: payload }));
    };
    ws.onerror = failed;
    ws.onclose = failed;

    return () => {
      disposed = true;
      clearTimeout(retry);
      setDirect(false);
      controlCb.current?.(null);
      ws.onclose = null;
      ws.close();
      if (decoder && decoder.state !== "closed") decoder.close();
    };
  }, [device.id, quality, attempt]);

  return <canvas ref={canvas} className={`py-live${ready ? " is-loaded" : ""}`} aria-label={`${device.name} screen`} role="img" {...(direct ? directTouch : adbTouch)} />;
}

/** Screenshot fallback: the next frame is requested as soon as the previous one has loaded. */
function LiveScreen({ device, frameMs, onError }) {
  const [frame, setFrame] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function next(delay) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFrame((n) => n + 1), delay);
  }

  const touch = useTouch(device, onError, () => next(60)); // show the result of a tap quickly

  return (
    <img
      className={`py-live${loaded ? " is-loaded" : ""}`}
      src={screenUrl(device.id, frame)}
      alt={`${device.name} screen`}
      draggable={false}
      onLoad={() => {
        setLoaded(true);
        next(frameMs);
      }}
      onError={() => next(1500)}
      {...touch}
    />
  );
}

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { REGIONS, setGps, useStore } from "../api";
import { formatDate } from "../api/format";
import { CloseIcon, SearchIcon } from "./Icons";

// OpenStreetMap tiles + Nominatim search: free, no API key. Swap for Google Maps if you have a key.
const TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const PIN = L.divIcon({ className: "gps-pin", iconSize: [26, 26], iconAnchor: [13, 13] });

const fmt = (n) => String(Math.round(n * 1e6) / 1e6);

/** "GPS changer" modal: pick a point on the map (or search / type coordinates), then Modify. */
export function GpsDialog({ device, onClose }) {
  const gpsHistory = useStore((s) => s.gpsHistory);
  const start = device.gps ?? REGIONS.find((r) => r.code === device.region) ?? { lat: 0, lng: 0 };
  const [tab, setTab] = useState("map");
  const [pos, setPos] = useState({ lat: start.lat, lng: start.lng, label: device.gps?.label ?? "" });
  const [query, setQuery] = useState("");
  const [latText, setLatText] = useState(fmt(start.lat));
  const [lngText, setLngText] = useState(fmt(start.lng));
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(null);
  const [full, setFull] = useState(false);
  const mapEl = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);

  function moveTo(lat, lng, label = "", zoom) {
    setPos({ lat, lng, label });
    setLatText(fmt(lat));
    setLngText(fmt(lng));
    setMessage(null);
    marker.current?.setLatLng([lat, lng]);
    if (zoom) map.current?.flyTo([lat, lng], zoom, { duration: 0.6 });
  }

  // The map lives only on the "GPS changer" tab; rebuild it when coming back from History.
  useEffect(() => {
    if (tab !== "map" || !mapEl.current) return;
    const m = L.map(mapEl.current, { worldCopyJump: true }).setView([pos.lat, pos.lng], device.gps ? 13 : 4);
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(m);
    const mk = L.marker([pos.lat, pos.lng], { icon: PIN, draggable: true, keyboard: false }).addTo(m);
    mk.on("dragend", () => {
      const p = mk.getLatLng();
      moveTo(p.lat, p.lng);
    });
    m.on("click", (e) => moveTo(e.latlng.lat, e.latlng.lng));
    map.current = m;
    marker.current = mk;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only (re)create on tab change; moves go through moveTo
  }, [tab]);

  useEffect(() => {
    // Leaflet must re-measure after the dialog changes size.
    const t = setTimeout(() => map.current?.invalidateSize(), 220);
    return () => clearTimeout(t);
  }, [full]);

  async function search(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      const lat = Number(latText);
      const lng = Number(lngText);
      if (latText === "" || lngText === "" || !(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) {
        setMessage({ error: "Enter a place, or a latitude (−90…90) and longitude (−180…180)." });
        return;
      }
      moveTo(lat, lng, "", 13);
      return;
    }
    setSearching(true);
    setMessage(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
        headers: { Accept: "application/json" },
      });
      const [hit] = res.ok ? await res.json() : [];
      if (hit) moveTo(Number(hit.lat), Number(hit.lon), hit.display_name.split(",").slice(0, 2).join(","), 13);
      else setMessage({ error: `No place found for “${q}”.` });
    } catch {
      setMessage({ error: "Location search is unavailable right now. Enter coordinates instead." });
    }
    setSearching(false);
  }

  async function modify() {
    setPending(true);
    const res = await setGps(device.id, pos);
    setPending(false);
    if (res.ok) onClose();
    else setMessage(res);
  }

  const history = gpsHistory.filter((h) => h.deviceId === device.id);

  return createPortal(
    <div
      className="cf-backdrop gps-backdrop"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        onClose();
      }}
    >
      <div className={`gps${full ? " is-full" : ""}`} role="dialog" aria-modal="true" aria-labelledby="gps-title">
        <header className="gps-head">
          <h2 id="gps-title">GPS changer</h2>
          <button onClick={onClose} aria-label="Close" autoFocus>
            <CloseIcon />
          </button>
        </header>

        <div className="gps-tabs" role="tablist">
          {[
            ["map", "GPS changer"],
            ["history", "History"],
          ].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "is-active" : undefined} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "map" ? (
          <div className="gps-body">
            <div className="gps-map-wrap">
              <form className="gps-search" onSubmit={search}>
                <label className="gps-q">
                  <SearchIcon />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search location" aria-label="Search location" />
                </label>
                <input value={latText} onChange={(e) => setLatText(e.target.value)} inputMode="decimal" aria-label="Latitude" placeholder="Latitude" />
                <input value={lngText} onChange={(e) => setLngText(e.target.value)} inputMode="decimal" aria-label="Longitude" placeholder="Longitude" />
                <button disabled={searching}>{searching ? "…" : "Search"}</button>
              </form>
              <button className="gps-full" onClick={() => setFull((v) => !v)} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen" : "Full screen"}>
                {full ? "⤡" : "⤢"}
              </button>
              <div ref={mapEl} className="gps-map" />
            </div>
            <p className="gps-pos">
              {pos.label ? <b>{pos.label} · </b> : null}
              {fmt(pos.lat)}, {fmt(pos.lng)} <span>— click the map or drag the pin to move it</span>
            </p>
          </div>
        ) : (
          <div className="gps-body">
            {history.length ? (
              <ul className="gps-history">
                {history.map((h) => (
                  <li key={h.id}>
                    <div>
                      <strong>{h.label ?? "Custom location"}</strong>
                      <span>
                        {fmt(h.lat)}, {fmt(h.lng)} · {formatDate(h.createdAt)} {new Date(h.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setPos({ lat: h.lat, lng: h.lng, label: h.label ?? "" });
                        setLatText(fmt(h.lat));
                        setLngText(fmt(h.lng));
                        setTab("map");
                      }}
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted gps-empty">No locations set on {device.name} yet.</p>
            )}
          </div>
        )}

        <footer className="gps-foot">
          {message?.error && <p className="gps-error">{message.error}</p>}
          <button onClick={onClose}>Cancel</button>
          <button className="gps-ok" onClick={modify} disabled={pending || tab !== "map"}>
            {pending ? "Saving…" : "Modify"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

// Real round-trip time from this browser to each server region (backend mode).
// Each region has a ping URL (server/ping.js on that host, or this server's /api/ping); we time a few
// tiny requests and keep the fastest, re-measuring every 30 s while something on screen shows latency.
import { useEffect, useSyncExternalStore } from "react";
import { REGIONS, REMOTE, apiUrl, getState } from "./index";

const SAMPLES = 3;
const EVERY_MS = 30_000;

let measured = {}; // region code -> ms
const listeners = new Set();
let users = 0;
let timer = null;

async function timeOnce(url) {
  const t = performance.now();
  await fetch(url, { cache: "no-store", credentials: "omit", mode: "cors" });
  return performance.now() - t;
}

async function probe(code) {
  const url = getState().regionPing?.[code] ?? apiUrl("/api/ping");
  try {
    await timeOnce(url); // warm-up: DNS, TLS and connection setup aren't part of the latency players feel
    let best = Infinity;
    for (let i = 0; i < SAMPLES; i++) best = Math.min(best, await timeOnce(url));
    return Math.round(best);
  } catch {
    return null; // unreachable: keep showing the estimate
  }
}

async function measureAll() {
  const results = await Promise.all(REGIONS.map(async (r) => [r.code, await probe(r.code)]));
  measured = { ...measured, ...Object.fromEntries(results.filter(([, ms]) => ms !== null)) };
  listeners.forEach((l) => l());
}

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * { [regionCode]: { ms, live } } — live = measured from this browser, otherwise the configured estimate
 * (always the estimate in offline demo mode).
 */
export function useLatency() {
  const snapshot = useSyncExternalStore(subscribe, () => measured);

  useEffect(() => {
    if (!REMOTE) return undefined;
    if (users++ === 0) {
      measureAll();
      timer = setInterval(() => document.visibilityState === "visible" && measureAll(), EVERY_MS);
    }
    return () => {
      if (--users === 0) clearInterval(timer);
    };
  }, []);

  return Object.fromEntries(REGIONS.map((r) => [r.code, snapshot[r.code] != null ? { ms: snapshot[r.code], live: true } : { ms: r.latencyMs, live: false }]));
}

/** Badge colour bucket shared by the server picker and the player. */
export const speed = (ms) => (ms < 60 ? "good" : ms < 120 ? "ok" : "slow");

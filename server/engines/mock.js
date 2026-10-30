// Stand-in engine for development on machines without Docker/ADB: every operation just takes a little time,
// and the "screen" is a generated PNG that changes with each tap so the live view visibly reacts.
import zlib from "node:zlib";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const taps = new Map(); // device id -> last tap { x, y } in 720×1280 space

export const provision = () => sleep(2500);
export const start = () => sleep(1500);
export const stop = () => sleep(800);
export const restart = () => sleep(1500);
export const rebuild = () => sleep(2500);
export const destroy = () => sleep(300);
export const install = () => sleep(1500);
export const push = () => sleep(800);
export const setGps = () => sleep(200);
export const clearAppData = () => sleep(500);

export async function input(d, ev) {
  if (ev.type === "tap") taps.set(d.id, { x: ev.x, y: ev.y });
  await sleep(50);
}

const W = 360; // half resolution keeps the PNG small; the dashboard scales it
const H = 640;

export async function screenshot(d) {
  const hue = [...d.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  const tap = taps.get(d.id);
  const sec = new Date().getSeconds();
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 4 + 1);
    raw[row] = 0; // PNG filter: none
    for (let x = 0; x < W; x++) {
      let [r, g, b] = hsl((hue + (y / H) * 70) % 360, 0.6, 0.35 + (x / W) * 0.15);
      // seconds bar along the top so the image is visibly live
      if (y < 8 && x < (W * sec) / 59) [r, g, b] = [255, 255, 255];
      if (tap && (x - tap.x / 2) ** 2 + (y - tap.y / 2) ** 2 < 14 ** 2) [r, g, b] = [255, 255, 255];
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return [f(0), f(8), f(4)];
}

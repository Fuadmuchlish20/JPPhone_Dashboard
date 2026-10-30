// scrcpy control protocol (v3.x): binary messages written to the control socket.
// Browser sends small JSON messages over the video WebSocket; toControl() validates them and builds the bytes.
//   { t: "touch", a: 0|1|2 (down/up/move), x, y, w, h }   x/y in video-frame pixels, w/h = current frame size
//   { t: "key", code }                                     Android keycode (down + up)
//   { t: "text", text }                                    set the phone clipboard and paste into the focused field
const TYPE = { KEYCODE: 0, TOUCH: 2, SET_CLIPBOARD: 9 };
const POINTER_FINGER = -2n; // POINTER_ID_GENERIC_FINGER
const KEYCODES = new Set([3, 4, 24, 25, 26, 82, 187]); // home, back, vol+, vol−, power, menu, recents

function touch(action, x, y, w, h) {
  const b = Buffer.alloc(32);
  b.writeUInt8(TYPE.TOUCH, 0);
  b.writeUInt8(action, 1);
  b.writeBigInt64BE(POINTER_FINGER, 2);
  b.writeInt32BE(x, 10);
  b.writeInt32BE(y, 14);
  b.writeUInt16BE(w, 18);
  b.writeUInt16BE(h, 20);
  b.writeUInt16BE(action === 1 ? 0 : 0xffff, 22); // pressure (fixed-point 1.0 while touching)
  b.writeUInt32BE(0, 24); // action button
  b.writeUInt32BE(0, 28); // buttons
  return b;
}

function key(action, code) {
  const b = Buffer.alloc(14);
  b.writeUInt8(TYPE.KEYCODE, 0);
  b.writeUInt8(action, 1);
  b.writeUInt32BE(code, 2);
  b.writeUInt32BE(0, 6); // repeat
  b.writeUInt32BE(0, 10); // meta state
  return b;
}

let clipboardSeq = 0n;
function clipboard(text) {
  const data = Buffer.from(text, "utf8");
  const b = Buffer.alloc(14 + data.length);
  b.writeUInt8(TYPE.SET_CLIPBOARD, 0);
  b.writeBigUInt64BE(++clipboardSeq, 1);
  b.writeUInt8(1, 9); // paste after setting
  b.writeUInt32BE(data.length, 10);
  data.copy(b, 14);
  return b;
}

const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

/** Parsed browser message → array of control buffers, or null if invalid. */
export function toControl(raw) {
  let m;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (m?.t === "touch") {
    const w = int(m.w, 4096);
    const h = int(m.h, 4096);
    const x = int(m.x, w ?? 0);
    const y = int(m.y, h ?? 0);
    if (![0, 1, 2].includes(m.a) || w === null || h === null || x === null || y === null) return null;
    return [touch(m.a, x, y, w, h)];
  }
  if (m?.t === "key" && KEYCODES.has(m.code)) return [key(0, m.code), key(1, m.code)];
  if (m?.t === "text" && typeof m.text === "string" && m.text.length > 0 && Buffer.byteLength(m.text) <= 4000) return [clipboard(m.text)];
  return null;
}

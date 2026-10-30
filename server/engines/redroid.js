// Cloud phones as Redroid containers (Android in Docker), driven through ADB.
// Host requirements (Linux): Docker, the `adb` CLI, and the binder kernel modules Redroid needs —
// see https://github.com/remote-android/redroid-doc for the per-distro setup.
//
// Regions: by default every phone runs on this machine. REGION_HOSTS sends a region's phones to another
// Docker host (any `docker -H` address, e.g. ssh://), whose ADB ports this server reaches over a private network:
//   REGION_HOSTS='{"sg": {"docker": "ssh://deploy@10.0.1.5", "adb": "10.0.1.5"}}'
// "*" is the host for every region not listed (e.g. a web-only dashboard server with one separate phone host).
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const DOCKER = process.env.DOCKER_BIN ?? "docker";
const ADB = process.env.ADB_BIN ?? "adb";
// {android} is replaced with the device's Android version, e.g. "13" -> redroid/redroid:13.0.0-latest.
const IMAGE = process.env.REDROID_IMAGE ?? "redroid/redroid:{android}.0.0-latest";
// Optional per-version override, e.g. REDROID_IMAGES='{"15":"redroid/redroid:15.0.0_64only-latest"}'
const IMAGES = JSON.parse(process.env.REDROID_IMAGES ?? "{}");
const LOCAL_ADB_HOST = process.env.ADB_HOST ?? "127.0.0.1";
const REGION_HOSTS = JSON.parse(process.env.REGION_HOSTS ?? "{}");
const GPU_MODE = process.env.REDROID_GPU_MODE ?? "guest"; // "host" if the server has a usable GPU
const BOOT_TIMEOUT_S = Number(process.env.BOOT_TIMEOUT_S ?? 180);
// scrcpy server for live video: download scrcpy-server-v<version> from https://github.com/Genymobile/scrcpy/releases
const SCRCPY_SERVER = process.env.SCRCPY_SERVER ?? path.join(import.meta.dirname, "..", "data", "scrcpy-server");
const SCRCPY_VERSION = process.env.SCRCPY_VERSION ?? "3.1";
const WIDTH = 720;
const HEIGHT = 1280;

/** Where a device's container lives: docker -H address (null = this machine) and the address its ADB port is reached on. */
function hostOf(d) {
  const h = REGION_HOSTS[d.region] ?? REGION_HOSTS["*"];
  return h ? { docker: h.docker, adb: h.adb, bind: h.bind ?? "0.0.0.0" } : { docker: null, adb: LOCAL_ADB_HOST, bind: LOCAL_ADB_HOST };
}

const container = (d) => `jp-${d.id}`;
const volume = (d) => `jp-${d.id}-data`;
const serial = (d) => `${hostOf(d).adb}:${d.adbPort}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function docker(d, ...args) {
  const h = hostOf(d).docker;
  const { stdout } = await run(DOCKER, [...(h ? ["-H", h] : []), ...args], { maxBuffer: 8 << 20 });
  return stdout.trim();
}

async function adb(d, args, opts = {}) {
  const { stdout } = await run(ADB, ["-s", serial(d), ...args], { maxBuffer: 32 << 20, timeout: opts.timeout ?? 120_000, encoding: opts.encoding ?? "utf8" });
  return stdout;
}

const shell = (d, cmd, opts) => adb(d, ["shell", cmd], opts);
const quiet = (p) => p.catch(() => undefined);

/** Boot-time Android properties: screen, phone identity (Customize) and root. */
function bootProps(d) {
  const props = [
    `androidboot.redroid_width=${WIDTH}`,
    `androidboot.redroid_height=${HEIGHT}`,
    "androidboot.redroid_dpi=320",
    "androidboot.use_memfd=true", // kernels 5.18+ have no ashmem
    `androidboot.redroid_gpu_mode=${GPU_MODE}`,
    `ro.secure=${d.rooted ? 0 : 1}`,
  ];
  if (d.phoneModel) {
    const { brand, model } = d.phoneModel;
    props.push(`ro.product.brand=${brand}`, `ro.product.manufacturer=${brand}`, `ro.product.model=${model}`);
  }
  return props;
}

async function createContainer(d) {
  const image = IMAGES[d.androidVersion] ?? IMAGE.replace("{android}", d.androidVersion);
  await docker(
    d,
    "run", "-d",
    "--name", container(d),
    "--privileged",
    "--restart", "unless-stopped",
    "--cpus", String(d.cpu),
    "--memory", `${d.ramMb}m`,
    "-v", `${volume(d)}:/data`,
    "-p", `${hostOf(d).bind}:${d.adbPort}:5555`,
    image,
    ...bootProps(d),
  );
}

async function waitForBoot(d) {
  const deadline = Date.now() + BOOT_TIMEOUT_S * 1000;
  while (Date.now() < deadline) {
    await quiet(run(ADB, ["connect", serial(d)], { timeout: 10_000 }));
    const booted = await shell(d, "getprop sys.boot_completed", { timeout: 10_000 }).catch(() => "");
    if (booted.trim() === "1") return;
    await sleep(3000);
  }
  throw new Error(`Boot timed out after ${BOOT_TIMEOUT_S}s`);
}

async function removeContainer(d, { wipe }) {
  await quiet(run(ADB, ["disconnect", serial(d)]));
  await quiet(docker(d, "rm", "-f", container(d)));
  if (wipe) await quiet(docker(d, "volume", "rm", "-f", volume(d)));
}

export async function provision(d) {
  await removeContainer(d, { wipe: true });
  await createContainer(d);
  await waitForBoot(d);
}

export async function start(d) {
  await docker(d, "start", container(d));
  await waitForBoot(d);
}

export async function stop(d) {
  await quiet(run(ADB, ["disconnect", serial(d)]));
  await docker(d, "stop", container(d));
}

export async function restart(d) {
  await docker(d, "restart", container(d));
  await waitForBoot(d);
}

export async function rebuild(d, { wipe }) {
  await removeContainer(d, { wipe });
  await createContainer(d);
  await waitForBoot(d);
}

export async function destroy(d) {
  await removeContainer(d, { wipe: true });
}

export async function screenshot(d) {
  return adb(d, ["exec-out", "screencap", "-p"], { encoding: "buffer", timeout: 15_000 });
}

// `input text` treats spaces and shell metacharacters specially.
const escapeText = (t) => t.replace(/[\\'"`$&|;<>()*?~!#{}[\]]/g, (c) => `\\${c}`).replace(/ /g, "%s");
const int = (n) => Math.round(Number(n));

export async function input(d, ev) {
  switch (ev.type) {
    case "tap":
      return shell(d, `input tap ${int(ev.x)} ${int(ev.y)}`);
    case "swipe":
      return shell(d, `input swipe ${int(ev.x)} ${int(ev.y)} ${int(ev.x2)} ${int(ev.y2)} ${int(ev.ms ?? 200)}`);
    case "key":
      return shell(d, `input keyevent ${int(ev.code)}`);
    case "text":
      return shell(d, `input text '${escapeText(String(ev.text))}'`);
    case "rotate":
      return shell(d, `settings put system accelerometer_rotation 0 && settings put system user_rotation ${ev.landscape ? 1 : 0}`);
    default:
      throw new Error("Unknown input event.");
  }
}

export async function install(d, apkPath) {
  const out = await adb(d, ["install", "-r", "-g", apkPath], { timeout: 600_000 });
  if (!/Success/.test(out)) throw new Error(out.trim().split("\n").pop() || "Install failed.");
}

export async function push(d, filePath, name) {
  await adb(d, ["push", filePath, `/sdcard/Download/${name.replace(/[/\\]/g, "_")}`], { timeout: 600_000 });
}

// Android 12+: the shell user may register a test "gps" provider and feed it a fixed location.
export async function setGps(d, { lat, lng }) {
  await shell(
    d,
    [
      "cmd location providers add-test-provider gps 2>/dev/null",
      "cmd location providers set-test-provider-enabled gps true",
      `cmd location providers set-test-provider-location gps --location ${Number(lat)},${Number(lng)}`,
    ].join("; "),
  );
}

/** Keep installed apps but clear their data (Customize → "Keep apps, clear app data"). */
export async function clearAppData(d) {
  const list = await shell(d, "pm list packages -3");
  for (const line of list.split("\n")) {
    const pkg = line.replace("package:", "").trim();
    if (/^[\w.]+$/.test(pkg)) await quiet(shell(d, `pm clear ${pkg}`));
  }
}

/* ---------------- live video (scrcpy server → H.264 packets) ---------------- */

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });

/** Connect to the forwarded scrcpy socket; it only counts once the server's dummy byte arrives. */
async function connectScrcpy(port) {
  for (let i = 0; i < 50; i++) {
    const sock = await new Promise((resolve) => {
      const s = net.connect(port, "127.0.0.1");
      const fail = () => (s.destroy(), resolve(null));
      s.once("error", fail);
      s.once("close", fail);
      s.once("data", (chunk) => {
        s.removeListener("close", fail);
        s.removeListener("error", fail);
        s.pause();
        if (chunk.length > 1) s.unshift(chunk.subarray(1));
        resolve(s);
      });
    });
    if (sock) return sock;
    await sleep(100);
  }
  throw new Error("scrcpy server didn't start");
}

/**
 * Start a video stream with a control channel. Calls onMeta({ codec, width, height }) once, then
 * onPacket({ config, key, pts, data }) per encoded packet (config packets carry SPS/PPS).
 * Returns { close(), control(buffer) } — control() writes scrcpy control messages (see scrcpy-control.js).
 */
export async function openStream(d, { maxSize = 1280, bitRate = 4_000_000, maxFps = 30 }, { onMeta, onPacket, onEnd }) {
  if (!fs.existsSync(SCRCPY_SERVER)) throw new Error("Live video isn't set up on this server (missing scrcpy-server).");
  await adb(d, ["push", SCRCPY_SERVER, "/data/local/tmp/scrcpy-server.jar"], { timeout: 30_000 });
  const scid = (Math.floor(Math.random() * 0x7fffffff) >>> 0).toString(16).padStart(8, "0");
  const port = await freePort();
  await adb(d, ["forward", `tcp:${port}`, `localabstract:scrcpy_${scid}`]);
  const args = [
    `scid=${scid}`, "log_level=warn", "tunnel_forward=true", "audio=false", "control=true", "cleanup=true",
    "send_device_meta=false", "send_dummy_byte=true", "send_codec_meta=true", "send_frame_meta=true",
    "video_codec=h264", `max_size=${int(maxSize)}`, `video_bit_rate=${int(bitRate)}`, `max_fps=${int(maxFps)}`,
  ];
  const proc = spawn(ADB, ["-s", serial(d), "shell", `CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server ${SCRCPY_VERSION} ${args.join(" ")}`], { stdio: "ignore" });

  let sock = null;
  let ctl = null;
  let closed = false;
  const close = () => {
    if (closed) return false;
    closed = true;
    sock?.destroy();
    ctl?.destroy();
    proc.kill();
    quiet(adb(d, ["forward", "--remove", `tcp:${port}`]));
    return true;
  };
  // The stream ended on its own (phone stopped, server crashed): clean up and tell the caller once.
  const ended = () => close() && onEnd?.();
  proc.once("exit", ended);

  try {
    sock = await connectScrcpy(port);
    // The server accepts the video socket first, then the control socket on the same tunnel.
    ctl = await new Promise((resolve, reject) => {
      const c = net.connect(port, "127.0.0.1", () => resolve(c));
      c.once("error", reject);
    });
    ctl.on("error", () => undefined);
    ctl.resume(); // device → browser messages (clipboard etc.) aren't used; keep the socket drained
  } catch (e) {
    close();
    throw e;
  }

  // Stream layout: codec meta (codec id u32, width u32, height u32), then packets of
  // [pts+flags u64][size u32][data]; flag bit 63 = config packet, bit 62 = key frame.
  let buf = Buffer.alloc(0);
  let haveMeta = false;
  sock.on("data", (chunk) => {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    for (;;) {
      if (!haveMeta) {
        if (buf.length < 12) return;
        onMeta({ codec: "h264", width: buf.readUInt32BE(4), height: buf.readUInt32BE(8) });
        buf = buf.subarray(12);
        haveMeta = true;
        continue;
      }
      if (buf.length < 12) return;
      const size = buf.readUInt32BE(8);
      if (buf.length < 12 + size) return;
      const head = buf.readBigUInt64BE(0);
      onPacket({
        config: Boolean(head & (1n << 63n)),
        key: Boolean(head & (1n << 62n)),
        pts: head & ((1n << 62n) - 1n),
        data: buf.subarray(12, 12 + size),
      });
      buf = buf.subarray(12 + size);
    }
  });
  sock.on("close", ended);
  ctl.on("close", ended);
  sock.resume();
  return { close, control: (buf) => !closed && ctl.write(buf) };
}

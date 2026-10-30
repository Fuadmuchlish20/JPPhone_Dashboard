// Sample screenshot drawn on a canvas so the Screenshot page works offline.
// With a real backend, takeScreenshot() should return the image URL from the device instead.
export const SHOT_W = 720;
export const SHOT_H = 1280;

const APPS = [
  ["Browser", "#ffffff", "#1a73e8"],
  ["Store", "#e8f5e9", "#34a853"],
  ["Games", "#ede7f6", "#7c4dff"],
  ["Files", "#e3f2fd", "#1e88e5"],
  ["Gallery", "#fff3e0", "#fb8c00"],
  ["Camera", "#eceff1", "#455a64"],
  ["Settings", "#e0f2f1", "#00897b"],
  ["Clock", "#fce4ec", "#d81b60"],
];
const DOCK = ["#43a047", "#1e88e5", "#ffffff", "#fdd835"];

/** Returns a PNG blob of the device's home screen at 720×1280. */
export function drawSampleScreenshot(device, at = new Date()) {
  const c = document.createElement("canvas");
  c.width = SHOT_W;
  c.height = SHOT_H;
  const g = c.getContext("2d");
  const font = (w, px) => `${w} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const time = at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  // wallpaper
  const bg = g.createLinearGradient(0, 0, SHOT_W, SHOT_H);
  bg.addColorStop(0, "#3a1fc4");
  bg.addColorStop(0.55, "#9b1fb8");
  bg.addColorStop(1, "#ff2d6f");
  g.fillStyle = bg;
  g.fillRect(0, 0, SHOT_W, SHOT_H);
  const glow = g.createRadialGradient(560, 380, 20, 560, 380, 520);
  glow.addColorStop(0, "rgba(255, 120, 200, .55)");
  glow.addColorStop(1, "rgba(255, 120, 200, 0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, SHOT_W, SHOT_H);

  // status bar
  g.fillStyle = "#fff";
  g.font = font(600, 24);
  g.textBaseline = "middle";
  g.fillText(time, 22, 22);
  g.fillRect(SHOT_W - 34, 12, 12, 20);
  g.beginPath();
  g.moveTo(SHOT_W - 74, 14);
  g.lineTo(SHOT_W - 50, 14);
  g.lineTo(SHOT_W - 62, 30);
  g.fill();

  // clock + date
  g.textAlign = "center";
  g.font = font(300, 150);
  g.fillText(time, SHOT_W / 2, 250);
  g.font = font(500, 28);
  g.fillText(at.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }), SHOT_W / 2, 350);

  // search pill
  g.fillStyle = "rgba(255, 255, 255, .9)";
  g.beginPath();
  g.roundRect(40, 420, SHOT_W - 80, 76, 38);
  g.fill();
  g.strokeStyle = "#6b7280";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(84, 458, 13, 0, Math.PI * 2);
  g.stroke();

  // app grid
  APPS.forEach(([name, bgc, fg], i) => {
    const x = 90 + (i % 4) * 180;
    const y = 760 + Math.floor(i / 4) * 170;
    g.fillStyle = bgc;
    g.beginPath();
    g.arc(x, y, 50, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = fg;
    g.font = font(800, 36);
    g.fillText(name.charAt(0), x, y + 2);
    g.fillStyle = "#fff";
    g.font = font(500, 22);
    g.fillText(name, x, y + 80);
  });

  // dock
  g.fillStyle = "rgba(255, 255, 255, .18)";
  g.beginPath();
  g.roundRect(30, 1060, SHOT_W - 60, 120, 60);
  g.fill();
  DOCK.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(120 + i * 160, 1120, 40, 0, Math.PI * 2);
    g.fill();
  });

  // nav bar
  g.fillStyle = "#f5f5f5";
  g.fillRect(0, SHOT_H - 72, SHOT_W, 72);
  g.fillStyle = "#222";
  const ny = SHOT_H - 36;
  g.beginPath();
  g.moveTo(230, ny);
  g.lineTo(254, ny - 15);
  g.lineTo(254, ny + 15);
  g.fill();
  g.beginPath();
  g.arc(SHOT_W / 2, ny, 15, 0, Math.PI * 2);
  g.fill();
  g.fillRect(468, ny - 14, 28, 28);

  // label so a sample is never mistaken for a real capture
  g.fillStyle = "rgba(0, 0, 0, .35)";
  g.beginPath();
  g.roundRect(40, 560, SHOT_W - 80, 96, 18);
  g.fill();
  g.fillStyle = "#fff";
  g.font = font(700, 26);
  g.fillText(device.name, SHOT_W / 2, 592);
  g.font = font(400, 20);
  const model = device.phoneModel ? `${device.phoneModel.brand} ${device.phoneModel.model}` : "Android " + device.androidVersion;
  g.fillText(`${model} · sample screenshot`, SHOT_W / 2, 628);

  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

// Cloud store catalog for Bulk Install. Games reuse the tiles in games.js; swap in real icons once you have the rights.
import { GAMES } from "./games.js";

export const STORE_GAMES = Object.entries(GAMES).map(([key, g]) => ({ key, ...g }));

export const STORE_SOFTWARE = [
  { key: "chrome", name: "Chrome", hue: 140, glyph: "◎", note: "Web browser" },
  { key: "telegram", name: "Telegram", hue: 200, glyph: "➤", note: "Messaging" },
  { key: "whatsapp", name: "WhatsApp", hue: 130, glyph: "W", note: "Messaging" },
  { key: "discord", name: "Discord", hue: 235, glyph: "D", note: "Voice & chat for gamers" },
  { key: "youtube", name: "YouTube", hue: 0, glyph: "▶", note: "Video" },
  { key: "autoclicker", name: "Auto Clicker", hue: 280, glyph: "☝", note: "Tap automation for AFK" },
  { key: "zarchiver", name: "ZArchiver", hue: 30, glyph: "Z", note: "Open .zip / .xapk / OBB files" },
  { key: "gboard", name: "Gboard", hue: 210, glyph: "⌨", note: "Keyboard with more languages" },
];

/** Max size per uploaded APK, in MB. */
export const UPLOAD_LIMIT_MB = 2048;

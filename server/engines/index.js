// Picks the cloud phone engine. ENGINE=redroid on a Linux host with Docker + ADB; ENGINE=mock (default) anywhere else.
//
// Every engine exports the same async functions, each taking the device record:
//   provision(d)            create the phone and wait until Android has booted
//   start(d) / stop(d) / restart(d)
//   rebuild(d, { wipe })    recreate with the device's current settings (Android version, model, root); wipe = erase /data
//   destroy(d)              remove the phone and its data
//   screenshot(d)           -> PNG Buffer
//   input(d, ev)            ev: { type: "tap", x, y } | { type: "swipe", x, y, x2, y2, ms } | { type: "key", code } | { type: "text", text } | { type: "rotate", landscape }
//   install(d, apkPath)     push(d, filePath, name)     setGps(d, { lat, lng })     clearAppData(d)
//   openStream(d, opts, handlers)   optional: live H.264 video (see redroid.js); engines without it fall back to screenshots
export const ENGINE_NAME = process.env.ENGINE === "redroid" ? "redroid" : "mock";
export const engine = ENGINE_NAME === "redroid" ? await import("./redroid.js") : await import("./mock.js");

// Latency probe to run on each region host (no dependencies): `PORT=8788 node ping.js`.
// Put it behind HTTPS on that host and list its URL in the main server's REGION_PING, e.g.
//   REGION_PING='{"sg":"https://sg.example.com/ping"}'
// Browsers time a few requests to it to show real milliseconds next to each server.
import http from "node:http";

const PORT = Number(process.env.PORT ?? 8788);

http
  .createServer((req, res) => {
    res.writeHead(req.url?.startsWith("/ping") ? 204 : 404, { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
    res.end();
  })
  .listen(PORT, () => console.log(`ping on :${PORT}`));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // /api (HTTP + the live video WebSocket) goes to the backend in server/ (used with `--mode backend`).
  server: { port: 5173, proxy: { "/api": { target: process.env.API_PROXY ?? "http://127.0.0.1:8787", ws: true } } },
});

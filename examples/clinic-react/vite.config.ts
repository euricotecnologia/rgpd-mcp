import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, the Vite server proxies /api to the clinic backend (server.mjs).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:7600" } },
});

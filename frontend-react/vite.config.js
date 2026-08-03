import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The backend (backend/server.js) serves the API on http://localhost:5000
// by default. In dev, Vite proxies /api and /uploads to it so the app can
// call relative paths ("/api/...") exactly like the old no-build frontend
// did — no host/port hardcoded anywhere in the app code.
//
// In production, build this app (`npm run build`) and point the backend's
// static file serving at `frontend-react/dist` instead of `frontend/`
// (see README.md in this folder), so it's the same single-origin setup.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});

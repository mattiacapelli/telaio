import type { NextConfig } from "next";

// Il .env sta nella radice del monorepo, non in apps/web.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {}

const config: NextConfig = {
  // Permette un secondo dev server (es. per i test e2e) senza il lock su .next.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // I pacchetti del monorepo sono TypeScript sorgente: li compila Next.
  transpilePackages: ["@telaio/core", "@telaio/db", "@telaio/twenty"],
  serverExternalPackages: ["postgres", "ioredis"],
  async headers() {
    return [
      {
        // Il Service Worker non va mai tenuto in cache dal browser: così gli aggiornamenti vengono rilevati.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      { source: "/offline.html", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default config;

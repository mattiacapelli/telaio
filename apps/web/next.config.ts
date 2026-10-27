import type { NextConfig } from "next";

// Il .env sta nella radice del monorepo, non in apps/web.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {}

const config: NextConfig = {
  // I pacchetti del monorepo sono TypeScript sorgente: li compila Next.
  transpilePackages: ["@telaio/core", "@telaio/db", "@telaio/twenty"],
  serverExternalPackages: ["postgres", "ioredis"],
};

export default config;

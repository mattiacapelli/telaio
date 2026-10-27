import type { NextConfig } from "next";

const config: NextConfig = {
  // I pacchetti del monorepo sono TypeScript sorgente: li compila Next.
  transpilePackages: ["@telaio/core", "@telaio/db", "@telaio/twenty"],
  serverExternalPackages: ["postgres", "ioredis"],
};

export default config;

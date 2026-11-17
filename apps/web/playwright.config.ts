import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Le spec condividono impostazioni globali del database di sviluppo (archivio S3, email, MCP):
  // in parallelo si pestano i piedi. Un worker costa pochi secondi in più e non dà falsi errori.
  workers: 1,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

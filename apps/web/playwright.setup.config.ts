import { defineConfig } from "@playwright/test";

// Test della prima configurazione: li avvia `pnpm test:setup`, che prepara un database vuoto e un
// server dedicato (porta 3400). Non vanno lanciati da soli.
export default defineConfig({
  testDir: "./e2e-setup",
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3400" },
  reporter: [["list"]],
});

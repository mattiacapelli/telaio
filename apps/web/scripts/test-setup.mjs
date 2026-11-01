// Prepara un database vuoto (con le migrazioni) e un server Next dedicato, lancia i test di
// e2e-setup e poi elimina tutto. Uso: pnpm --filter @telaio/web test:setup
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {}

const PORTA = process.env.E2E_PORT ?? "3400";
const radice = fileURLToPath(new URL("../../../", import.meta.url));
const web = fileURLToPath(new URL("../", import.meta.url));
const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!base) {
  console.error("Serve DATABASE_URL (o TEST_DATABASE_URL) per creare il database di prova.");
  process.exit(1);
}
const postgres = createRequire(new URL("../../../packages/db/package.json", import.meta.url))(
  "postgres",
);

const nome = `telaio_e2e_setup_${randomBytes(5).toString("hex")}`;
const conNome = (n) => {
  const u = new URL(base);
  u.pathname = `/${n}`;
  return u.toString();
};
const admin = postgres(conNome("postgres"), { max: 1 });
let server;
let esito = 1;

async function pulisci() {
  if (server && !server.killed) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  await admin.unsafe(`DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`).catch(() => {});
  await admin.end({ timeout: 2 }).catch(() => {});
}
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => pulisci().then(() => process.exit(130)));

try {
  await admin.unsafe(`CREATE DATABASE "${nome}"`);
  const env = {
    ...process.env,
    DATABASE_URL: conNome(nome),
    BETTER_AUTH_URL: `http://localhost:${PORTA}`,
    SETUP_TOKEN: "codice-di-prova-0123456789",
    NEXT_DIST_DIR: ".next-e2e-setup",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  const mig = spawnSync("pnpm", ["--filter", "@telaio/db", "migrate"], {
    cwd: radice,
    env,
    stdio: "inherit",
  });
  if (mig.status !== 0) throw new Error("Migrazioni non riuscite");

  const comando =
    process.env.E2E_PRODUZIONE === "1"
      ? ["exec", "next", "start", "-p", PORTA]
      : ["exec", "next", "dev", "-p", PORTA];
  server = spawn("pnpm", comando, { cwd: web, env, stdio: "ignore", detached: true });
  const fine = Date.now() + 180_000;
  for (;;) {
    try {
      const r = await fetch(`http://localhost:${PORTA}/api/health`);
      if (r.status) break;
    } catch {}
    if (Date.now() > fine) throw new Error("Il server non è partito");
    await new Promise((r) => setTimeout(r, 1000));
  }

  const test = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", "-c", "playwright.setup.config.ts", ...process.argv.slice(2)],
    {
      cwd: web,
      env: { ...env, E2E_BASE_URL: `http://localhost:${PORTA}`, E2E_DATABASE_URL: conNome(nome) },
      stdio: "inherit",
    },
  );
  esito = test.status ?? 1;
} catch (e) {
  console.error(e);
} finally {
  await pulisci();
}
process.exit(esito);

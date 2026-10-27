import { createDb } from "@telaio/db";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { generaRateAbbonamenti } from "./jobs/genera-rate";
import { nonImplementato } from "./jobs/stub";

const NOME_CODA = "telaio";
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const { db } = createDb();

// Job ricorrenti (cron in fuso Europe/Rome). Solo `genera-rate` è implementato.
const SCHEDULE = [
  { nome: "genera-rate", cron: "0 3 * * *" },
  { nome: "solleciti", cron: "0 9 * * *" },
  { nome: "sync-twenty", cron: "*/30 * * * *" },
  { nome: "consegna-webhook", cron: "* * * * *" },
  { nome: "backup", cron: "30 2 * * *" },
] as const;

const coda = new Queue(NOME_CODA, { connection });
for (const { nome, cron } of SCHEDULE) {
  await coda.upsertJobScheduler(nome, { pattern: cron, tz: "Europe/Rome" }, { name: nome });
}

const worker = new Worker(
  NOME_CODA,
  async (job) => {
    if (job.name === "genera-rate") return generaRateAbbonamenti(db);
    return nonImplementato(job.name);
  },
  { connection },
);

worker.on("completed", (job, res) => console.log(`[worker] ${job.name} ok`, res));
worker.on("failed", (job, err) => console.error(`[worker] ${job?.name} fallito:`, err.message));
console.log(`[worker] in ascolto sulla coda "${NOME_CODA}" con ${SCHEDULE.length} job schedulati`);

// Esegui subito la generazione rate all'avvio: così non si aspetta la notte.
await coda.add("genera-rate", {}, { removeOnComplete: 20, removeOnFail: 50 });

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await worker.close();
    await coda.close();
    process.exit(0);
  });
}

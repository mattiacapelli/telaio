import { createDb } from "@telaio/db";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { backupDatabase } from "./jobs/backup";
import { consegnaWebhook } from "./jobs/consegna-webhook";
import { generaRateAbbonamenti } from "./jobs/genera-rate";
import { proponiSolleciti } from "./jobs/proponi-solleciti";
import { sincronizzaTwenty } from "./jobs/sync-twenty";

const NOME_CODA = "telaio";
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const { db } = createDb();

// Job ricorrenti (cron in fuso Europe/Rome). `solleciti` propone bozze e non invia mai.
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
    if (job.name === "solleciti") return proponiSolleciti(db);
    if (job.name === "sync-twenty") return sincronizzaTwenty(db);
    if (job.name === "consegna-webhook") return consegnaWebhook(db);
    if (job.name === "backup") return backupDatabase();
    throw new Error(`Job sconosciuto: ${job.name}`);
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

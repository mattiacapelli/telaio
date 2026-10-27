import { createDb } from "@telaio/db";
import { backupDatabase } from "./jobs/backup";
import { consegnaWebhook } from "./jobs/consegna-webhook";
import { generaRateAbbonamenti } from "./jobs/genera-rate";
import { proponiSolleciti } from "./jobs/proponi-solleciti";
import { sincronizzaTwenty } from "./jobs/sync-twenty";

/** Esegue un job una volta sola: `pnpm job <nome>` (senza nome: genera-rate e solleciti). */
const { db, client } = createDb();
const JOB: Record<string, () => Promise<unknown>> = {
  "genera-rate": () => generaRateAbbonamenti(db),
  solleciti: () => proponiSolleciti(db),
  "sync-twenty": () => sincronizzaTwenty(db),
  "consegna-webhook": () => consegnaWebhook(db),
  backup: () => backupDatabase(),
};
const richiesto = process.argv[2];
try {
  for (const [nome, esegui] of Object.entries(JOB)) {
    if (richiesto ? nome === richiesto : nome === "genera-rate" || nome === "solleciti") {
      console.log(nome, await esegui());
    }
  }
  if (richiesto && !(richiesto in JOB))
    console.error(`Job sconosciuto: ${richiesto}. Disponibili: ${Object.keys(JOB).join(", ")}`);
} finally {
  await client.end();
}

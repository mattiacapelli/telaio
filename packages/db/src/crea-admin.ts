import { creaAdmin } from "./admin";
import { createDb } from "./client";

// Per la produzione: crea solo l'utente amministratore, senza dati demo e senza valori predefiniti.
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME;
if (!email || !password || !name) {
  console.error("Servono SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD e SEED_ADMIN_NAME.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("La password deve avere almeno 12 caratteri.");
  process.exit(1);
}

const { db, client } = createDb();
console.log(
  (await creaAdmin(db, { email, password, name }))
    ? `Utente creato: ${email}`
    : `Utente ${email} già presente`,
);
await client.end();

// Seed minimale: solo ciò che serve per poter accedere la prima volta.
// Idempotente: se esiste già un utente non fa nulla, così l'entrypoint Docker
// può eseguirlo a ogni avvio senza duplicare o sovrascrivere dati reali.
//
// Niente dati demo qui apposta: ragione sociale, P.IVA, IBAN, regime fiscale
// e conti d'incasso si inseriscono dal browser in Impostazioni dopo il primo
// accesso — un seed che li inventa rischierebbe di finire anche su un
// database di produzione.
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);

/** Stesso formato usato da lib/auth.ts: scrypt:<sale>:<hash>. */
async function hashPassword(password) {
  const sale = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, sale, 64);
  return `scrypt:${sale}:${hash.toString("hex")}`;
}

async function main() {
  if ((await prisma.utente.count()) > 0) {
    console.log("Database già popolato: seed saltato.");
    return;
  }

  const password = process.env.SEED_PASSWORD;
  if (!password) {
    console.error(
      "SEED_PASSWORD non impostata: imposta la variabile d'ambiente prima di seminare " +
        "(niente password di default nel repo).",
    );
    process.exit(1);
  }
  const email = process.env.SEED_EMAIL ?? "admin@localhost";
  const nome = process.env.SEED_NOME ?? "Amministratore";
  const nomeSpazio = process.env.SEED_NOME_SPAZIO ?? "Telaio";

  // Utente di accesso: senza, l'applicazione non è utilizzabile.
  await prisma.utente.create({
    data: {
      email,
      nome,
      passwordHash: await hashPassword(password),
    },
  });

  // Solo il nome dello spazio: gli altri campi restano ai default di schema
  // (tariffa di listino, termini di pagamento, ecc.), modificabili da
  // Impostazioni.
  await prisma.impostazioni.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, nomeSpazio },
  });

  console.log("Seed completato.");
  console.log(`  accesso: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

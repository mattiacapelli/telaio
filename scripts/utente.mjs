#!/usr/bin/env node
/**
 * Gestione degli account di Telaio: non c'è registrazione aperta.
 *
 *   node scripts/utente.mjs crea <email> <nome> [password]
 *   node scripts/utente.mjs password <email> <nuova-password>
 *   node scripts/utente.mjs disattiva <email>
 *   node scripts/utente.mjs attiva <email>
 *   node scripts/utente.mjs elenco
 *
 * Se ometti la password alla creazione ne viene generata una casuale e
 * stampata una sola volta.
 */
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const scryptAsync = promisify(scrypt);
const prisma = new PrismaClient();

const PREFISSO_SESSIONE = "telaio:sessione:";

/**
 * Chiude le sessioni aperte di un utente. Cambiare password o disattivare un
 * account deve avere effetto subito: senza questo, un cookie già rubato
 * resterebbe valido per giorni.
 */
async function revocaSessioni(utenteId) {
  const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6380", {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });
  let revocate = 0;
  try {
    await redis.connect();
    for (const k of await redis.keys(PREFISSO_SESSIONE + "*")) {
      const raw = await redis.get(k);
      if (!raw) continue;
      if (JSON.parse(raw).utenteId === utenteId) {
        await redis.del(k);
        revocate++;
      }
    }
  } catch {
    console.warn("Redis non raggiungibile: sessioni non revocate.");
  } finally {
    redis.disconnect();
  }
  return revocate;
}

// Stessa funzione di lib/auth.ts: lo script gira in Node puro, senza il
// bundler, quindi non può importare il modulo TypeScript.
async function hashPassword(password) {
  const sale = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, sale, 64);
  return `scrypt:${sale}:${hash.toString("hex")}`;
}

const [, , comando, ...args] = process.argv;

async function main() {
  switch (comando) {
    case "crea": {
      const [email, nome, password] = args;
      if (!email || !nome) {
        console.error("uso: node scripts/utente.mjs crea <email> <nome> [password]");
        process.exit(1);
      }
      const pwd = password ?? randomBytes(9).toString("base64url");
      const utente = await prisma.utente.create({
        data: {
          email: email.toLowerCase().trim(),
          nome,
          passwordHash: await hashPassword(pwd),
        },
      });
      console.log(`Creato: ${utente.email}`);
      if (!password) console.log(`Password generata: ${pwd}`);
      break;
    }

    case "password": {
      const [email, password] = args;
      if (!email || !password) {
        console.error("uso: node scripts/utente.mjs password <email> <nuova-password>");
        process.exit(1);
      }
      const aggiornato = await prisma.utente.update({
        where: { email: email.toLowerCase().trim() },
        data: { passwordHash: await hashPassword(password) },
      });
      const chiuse = await revocaSessioni(aggiornato.id);
      console.log(`Password aggiornata per ${email}`);
      if (chiuse > 0) console.log(`Sessioni chiuse: ${chiuse}`);
      break;
    }

    case "disattiva":
    case "attiva": {
      const [email] = args;
      if (!email) {
        console.error(`uso: node scripts/utente.mjs ${comando} <email>`);
        process.exit(1);
      }
      const u = await prisma.utente.update({
        where: { email: email.toLowerCase().trim() },
        data: { attivo: comando === "attiva" },
      });
      if (comando === "disattiva") {
        const chiuse = await revocaSessioni(u.id);
        if (chiuse > 0) console.log(`Sessioni chiuse: ${chiuse}`);
      }
      console.log(`${email}: ${comando === "attiva" ? "attivo" : "disattivato"}`);
      break;
    }

    case "elenco": {
      const utenti = await prisma.utente.findMany({ orderBy: { email: "asc" } });
      if (utenti.length === 0) {
        console.log("Nessun utente. Creane uno con: node scripts/utente.mjs crea <email> <nome>");
        break;
      }
      for (const u of utenti) {
        const ultimo = u.ultimoAccesso
          ? new Date(u.ultimoAccesso).toLocaleString("it-IT")
          : "mai";
        console.log(
          `${u.attivo ? "●" : "○"} ${u.email.padEnd(28)} ${u.nome.padEnd(20)} ultimo accesso: ${ultimo}`,
        );
      }
      break;
    }

    default:
      console.error(
        "comandi: crea | password | disattiva | attiva | elenco\n" +
          "esempio: node scripts/utente.mjs crea marco@studioferrero.it 'Marco Ferrero'",
      );
      process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e.code === "P2002" ? "Esiste già un utente con questa email." : e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

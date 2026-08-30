import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { redis } from "./redis";
import { COOKIE } from "./auth-cookie";

const scryptAsync = promisify(scrypt);

export { COOKIE } from "./auth-cookie";
const PREFISSO = "telaio:sessione:";
/** Durata della sessione: 7 giorni, prolungata a ogni richiesta. */
const DURATA = 60 * 60 * 24 * 7;

// ------------------------------------------------------------------ password

/**
 * Hash scrypt con sale casuale, nel formato `scrypt:<sale>:<hash>`.
 * scrypt è nel core di Node: niente dipendenze native da compilare nel
 * container, e i parametri di costo restano espliciti qui.
 */
export async function hashPassword(password: string) {
  const sale = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, sale, 64)) as Buffer;
  return `scrypt:${sale}:${hash.toString("hex")}`;
}

export async function verificaPassword(password: string, salvata: string) {
  const [schema, sale, hash] = salvata.split(":");
  if (schema !== "scrypt" || !sale || !hash) return false;

  const atteso = Buffer.from(hash, "hex");
  const calcolato = (await scryptAsync(password, sale, atteso.length)) as Buffer;
  // Confronto a tempo costante: evita di rivelare l'hash un byte alla volta.
  return timingSafeEqual(atteso, calcolato);
}

// ------------------------------------------------------------------ sessioni

export type Sessione = { utenteId: string; email: string; nome: string };

/**
 * Le sessioni vivono in Redis, non in un JWT: si possono revocare davvero
 * (logout, utente disattivato) e non serve gestire una chiave di firma.
 */
export async function creaSessione(s: Sessione) {
  const token = randomBytes(32).toString("hex");
  await redis.set(PREFISSO + token, JSON.stringify(s), "EX", DURATA);

  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURATA,
  });
  return token;
}

export async function leggiSessione(): Promise<Sessione | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;

  let sessione: Sessione;
  try {
    const raw = await redis.get(PREFISSO + token);
    if (!raw) return null;
    sessione = JSON.parse(raw) as Sessione;
  } catch {
    // Redis irraggiungibile: meglio chiedere di riautenticarsi che lasciare
    // passare una richiesta non verificata.
    return null;
  }

  // Un account disattivato deve perdere l'accesso subito, non alla scadenza
  // della sessione: senza questo controllo il cookie resterebbe valido per
  // giorni dopo la disattivazione.
  const utente = await prisma.utente.findUnique({
    where: { id: sessione.utenteId },
    select: { attivo: true },
  });
  if (!utente?.attivo) {
    await revocaSessione(token);
    return null;
  }

  // Rinnova la scadenza: chi usa l'app resta connesso.
  try {
    await redis.expire(PREFISSO + token, DURATA);
  } catch {
    /* il rinnovo è best-effort */
  }
  return sessione;
}

/** Invalida un token lato server. */
async function revocaSessione(token: string) {
  try {
    await redis.del(PREFISSO + token);
  } catch {
    /* best-effort */
  }
}

/** Chiude tutte le sessioni aperte di un utente (es. dopo cambio password). */
export async function revocaSessioniUtente(utenteId: string) {
  try {
    // SCAN invece di KEYS: non blocca Redis mentre scandisce il keyspace.
    let cursore = "0";
    do {
      const [prossimo, chiavi] = await redis.scan(
        cursore,
        "MATCH",
        PREFISSO + "*",
        "COUNT",
        200,
      );
      for (const k of chiavi) {
        const raw = await redis.get(k);
        if (!raw) continue;
        const s = JSON.parse(raw) as Sessione;
        if (s.utenteId === utenteId) await redis.del(k);
      }
      cursore = prossimo;
    } while (cursore !== "0");
  } catch {
    /* best-effort */
  }
}

export async function distruggiSessione() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (token) {
    try {
      await redis.del(PREFISSO + token);
    } catch {
      /* il cookie viene comunque rimosso */
    }
  }
  c.delete(COOKIE);
}

// ------------------------------------------------------------------ login

export async function autentica(email: string, password: string) {
  const utente = await prisma.utente.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  // Anche a utente inesistente paghiamo il costo di un hash, così i tempi di
  // risposta non rivelano quali email esistono.
  if (!utente || !utente.attivo) {
    await verificaPassword(password, `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`);
    return null;
  }

  if (!(await verificaPassword(password, utente.passwordHash))) return null;

  await prisma.utente.update({
    where: { id: utente.id },
    data: { ultimoAccesso: new Date() },
  });

  return { utenteId: utente.id, email: utente.email, nome: utente.nome };
}

/** Sessione corrente, o `null`. Usala nelle pagine per mostrare l'utente. */
export async function utenteCorrente() {
  return leggiSessione();
}

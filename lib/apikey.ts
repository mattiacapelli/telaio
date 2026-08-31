import { randomBytes, createHash } from "node:crypto";
import { prisma } from "./prisma";

/**
 * API key per l'accesso programmatico (oggi: il server MCP).
 *
 * A differenza delle password, qui la chiave è già ad alta entropia (32
 * byte casuali): un hash veloce come SHA-256 basta, non serve scrypt. La
 * chiave si vede in chiaro solo al momento della creazione — da quel
 * momento in poi anche il database ne conosce solo l'impronta.
 */
const PREFISSO = "tlk_";

export function generaChiave() {
  const casuale = randomBytes(32).toString("hex");
  return `${PREFISSO}${casuale}`;
}

export function hashChiave(chiave: string) {
  return createHash("sha256").update(chiave).digest("hex");
}

/** Ultimi 4 caratteri, per riconoscere la chiave nell'elenco senza rivelarla. */
export function suffissoChiave(chiave: string) {
  return chiave.slice(-4);
}

/**
 * Verifica una chiave presentata da un chiamante esterno.
 *
 * Ritorna l'id della ApiKey se valida (esiste, non revocata, non scaduta),
 * altrimenti null. Aggiorna `ultimoUsoIl` in background: sapere quando una
 * chiave è stata usata l'ultima volta aiuta a capire quali si possono
 * revocare in sicurezza.
 */
export async function verificaChiave(chiave: string | null | undefined) {
  if (!chiave || !chiave.startsWith(PREFISSO)) return null;

  const hash = hashChiave(chiave);
  const k = await prisma.apiKey.findUnique({ where: { hash } });
  if (!k || k.revocataIl) return null;
  if (k.scadeIl && k.scadeIl < new Date()) return null;

  prisma.apiKey
    .update({ where: { id: k.id }, data: { ultimoUsoIl: new Date() } })
    .catch(() => {});

  return k.id;
}

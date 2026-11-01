import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import type { Database } from "./client";
import { accounts, users } from "./schema";

/** Basta `select` e `insert`: funziona sia con il database sia dentro una transazione. */
export type Scrittore = Pick<Database, "select" | "insert">;

/**
 * Crea l'utente amministratore con accesso email e password, nello stesso formato di Better Auth
 * (tabelle users e accounts, hash scrypt). Accetta la password o direttamente il suo hash.
 * Restituisce l'id dell'utente, oppure null se l'email esiste già.
 */
export async function creaAdmin(
  db: Scrittore,
  dati: { email: string; name: string } & (
    | { password: string; passwordHash?: never }
    | { passwordHash: string; password?: never }
  ),
): Promise<string | null> {
  const [esistente] = await db.select().from(users).where(eq(users.email, dati.email));
  if (esistente) return null;
  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    name: dati.name,
    email: dati.email,
    emailVerified: true,
    role: "admin",
  });
  await db.insert(accounts).values({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: dati.passwordHash ?? (await hashPassword(dati.password)),
  });
  return userId;
}

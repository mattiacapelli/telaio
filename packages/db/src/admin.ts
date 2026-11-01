import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import type { Database } from "./client";
import { accounts, users } from "./schema";

/** Crea l'utente amministratore con accesso email e password. Restituisce false se esiste già. */
export async function creaAdmin(
  db: Database,
  { email, password, name }: { email: string; password: string; name: string },
) {
  const [esistente] = await db.select().from(users).where(eq(users.email, email));
  if (esistente) return false;
  const userId = randomUUID();
  await db.insert(users).values({ id: userId, name, email, emailVerified: true, role: "admin" });
  await db.insert(accounts).values({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: await hashPassword(password),
  });
  return true;
}

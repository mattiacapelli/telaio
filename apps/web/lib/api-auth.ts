import { createHash } from "node:crypto";
import { and, apiKeys, eq, getDb, isNull } from "@telaio/db";
import { getRedis } from "./redis";

export type ChiaveApi = typeof apiKeys.$inferSelect;

const LIMITE_PER_MINUTO = 120;

const errore = (status: number, message: string, headers?: HeadersInit) =>
  Response.json({ error: message }, { status, headers });

/** Verifica chiave (Bearer), ambito, permessi e rate limit per chiave. */
export async function autenticaChiave(
  request: Request,
  opzioni: { scope: "api" | "mcp"; scrittura?: boolean },
): Promise<{ ok: true; chiave: ChiaveApi } | { ok: false; risposta: Response }> {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer)
    return {
      ok: false,
      risposta: errore(401, "Chiave API mancante", { "WWW-Authenticate": "Bearer" }),
    };

  const hash = createHash("sha256").update(bearer).digest("hex");
  const db = getDb();
  const [chiave] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.hash, hash), isNull(apiKeys.revokedAt)));
  if (!chiave)
    return {
      ok: false,
      risposta: errore(401, "Chiave API non valida", { "WWW-Authenticate": "Bearer" }),
    };
  if (!chiave.scopes.includes(opzioni.scope))
    return { ok: false, risposta: errore(403, `La chiave non ha l'ambito ${opzioni.scope}`) };
  if (opzioni.scrittura && chiave.permessi !== "lettura_scrittura") {
    return { ok: false, risposta: errore(403, "La chiave è di sola lettura") };
  }

  // Rate limit a finestra fissa di un minuto. Se Redis non risponde non blocchiamo le richieste.
  try {
    const redis = getRedis();
    const finestra = Math.floor(Date.now() / 60000);
    const k = `rl:${chiave.id}:${finestra}`;
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, 70);
    if (n > LIMITE_PER_MINUTO)
      return { ok: false, risposta: errore(429, "Troppe richieste", { "Retry-After": "60" }) };
  } catch {}

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, chiave.id));
  return { ok: true, chiave };
}

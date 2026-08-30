import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

function create() {
  const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
  });
  // Redis is a cache and a timer store here, never the source of truth, so a
  // connection error must degrade rather than crash the request.
  client.on("error", (err) => console.error("[redis]", err.message));
  return client;
}

export const redis = globalForRedis.redis ?? create();
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

/**
 * Namespace delle chiavi di cache.
 *
 * Sessioni (`telaio:sessione:`) e timer (`telaio:timer:`) vivono FUORI da
 * questo prefisso: `invalidate()` cancella per prefisso, e con un prefisso
 * comune un'invalidazione della cache buttava giù anche le sessioni attive,
 * disconnettendo l'utente a ogni scrittura.
 */
const CACHE = "telaio:cache:";

/** Read-through cache. Falls back to the loader if Redis is unreachable. */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const chiave = CACHE + key;
  try {
    const hit = await redis.get(chiave);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    return load();
  }

  const value = await load();
  try {
    await redis.set(chiave, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    /* cache write is best-effort */
  }
  return value;
}

/**
 * Svuota la cache di lettura dopo una scrittura.
 *
 * Agisce solo sotto `telaio:cache:`, quindi non può toccare sessioni o timer.
 * Usa SCAN invece di KEYS: KEYS blocca Redis finché non ha scandito l'intero
 * keyspace.
 */
export async function invalidate(prefisso = "") {
  const pattern = `${CACHE}${prefisso}*`;
  try {
    let cursore = "0";
    do {
      const [prossimo, chiavi] = await redis.scan(
        cursore,
        "MATCH",
        pattern,
        "COUNT",
        200,
      );
      if (chiavi.length) await redis.del(...chiavi);
      cursore = prossimo;
    } while (cursore !== "0");
  } catch {
    /* best-effort */
  }
}

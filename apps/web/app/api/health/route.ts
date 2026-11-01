import { getDb, sql } from "@telaio/db";
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 2000;

/** Esegue un controllo con un tempo massimo. Non restituisce mai il motivo dell'errore. */
async function controlla(prova: () => Promise<unknown>): Promise<"ok" | "errore"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prova(),
      new Promise((_, rifiuta) => {
        timer = setTimeout(() => rifiuta(new Error("timeout")), TIMEOUT_MS);
      }),
    ]);
    return "ok";
  } catch {
    return "errore";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Stato dell'applicazione per Docker, il reverse proxy e il deploy: 200 se database e Redis
 * rispondono, 503 altrimenti. Non espone stringhe di connessione né messaggi d'errore.
 */
export async function GET() {
  const [database, redis] = await Promise.all([
    controlla(() => getDb().execute(sql`select 1`)),
    controlla(() => getRedis().ping()),
  ]);
  const ok = database === "ok" && redis === "ok";
  return NextResponse.json(
    { stato: ok ? "ok" : "degradato", database, redis, versione: process.env.APP_VERSION ?? "dev" },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

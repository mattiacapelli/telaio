import { NextResponse } from "next/server";
import { leggiSessione } from "@/lib/auth";
import { eseguiScheduler } from "@/lib/scheduler";
import { invalidate } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Esecuzione delle attività ricorrenti.
 *
 * Due modi di autenticarsi: la sessione (esecuzione manuale dalle
 * impostazioni) oppure il segreto condiviso, usato dal processo interno che
 * la richiama a intervalli.
 */
function autorizzatoDaSegreto(req: Request) {
  const atteso = process.env.SCHEDULER_TOKEN;
  if (!atteso) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${atteso}`;
}

export async function POST(req: Request) {
  const conSessione = Boolean(await leggiSessione());
  if (!conSessione && !autorizzatoDaSegreto(req)) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  // L'esecuzione manuale forza la passata anche se è già girata oggi.
  const forza = conSessione;
  const esito = await eseguiScheduler(forza);

  await invalidate();
  return NextResponse.json(esito);
}

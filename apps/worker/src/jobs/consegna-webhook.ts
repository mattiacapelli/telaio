import { createHmac } from "node:crypto";
import { and, type Database, eq, isNull, lte, or, webhookDeliveries, webhooks } from "@telaio/db";

/** Attese tra un tentativo e il successivo: dopo l'ultimo la consegna risulta fallita. */
export const PAUSE_MINUTI = [1, 5, 30, 120, 720];
const TIMEOUT_MS = 10_000;

export function firma(segreto: string, corpo: string): string {
  return `sha256=${createHmac("sha256", segreto).update(corpo).digest("hex")}`;
}

/**
 * Consegna i webhook in coda: POST JSON con l'intestazione `x-telaio-signature` (HMAC-SHA256 del
 * corpo con il segreto del webhook). Un 2xx chiude la consegna; altrimenti si riprova con pause
 * crescenti e, esaurite, la consegna passa a «fallito».
 */
export async function consegnaWebhook(db: Database, ora = new Date()) {
  const dovute = await db
    .select({ d: webhookDeliveries, w: webhooks })
    .from(webhookDeliveries)
    .innerJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId))
    .where(
      and(
        eq(webhookDeliveries.stato, "in_attesa"),
        or(
          isNull(webhookDeliveries.prossimoTentativo),
          lte(webhookDeliveries.prossimoTentativo, ora),
        ),
      ),
    )
    .limit(50);

  let consegnati = 0;
  let falliti = 0;
  for (const { d, w } of dovute) {
    const corpo = JSON.stringify(d.payload);
    let status: number | null = null;
    let errore: string | null = null;
    try {
      const res = await fetch(w.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-telaio-event": d.evento,
          "x-telaio-delivery": d.id,
          "x-telaio-signature": firma(w.secret, corpo),
        },
        body: corpo,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      status = res.status;
      if (!res.ok) errore = `Risposta ${res.status}`;
    } catch (e) {
      errore = e instanceof Error ? e.message : "Errore di rete";
    }

    const tentativi = d.tentativi + 1;
    if (!errore) {
      await db
        .update(webhookDeliveries)
        .set({
          stato: "consegnato",
          tentativi,
          ultimoStatus: status,
          ultimoErrore: null,
          prossimoTentativo: null,
        })
        .where(eq(webhookDeliveries.id, d.id));
      consegnati++;
      continue;
    }
    const pausa = PAUSE_MINUTI[tentativi - 1];
    await db
      .update(webhookDeliveries)
      .set({
        tentativi,
        ultimoStatus: status,
        ultimoErrore: errore,
        stato: pausa === undefined ? "fallito" : "in_attesa",
        prossimoTentativo: pausa === undefined ? null : new Date(ora.getTime() + pausa * 60_000),
      })
      .where(eq(webhookDeliveries.id, d.id));
    if (pausa === undefined) falliti++;
  }
  return { elaborati: dovute.length, consegnati, falliti };
}

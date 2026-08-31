import { createHmac } from "node:crypto";
import { prisma } from "./prisma";

/**
 * Webhook in uscita, come le API integrations di Twenty: quando succede un
 * evento a cui il webhook è iscritto, Telaio invia una POST firmata con il
 * secret, così chi riceve può verificare che il payload venga davvero da qui.
 *
 * Il catalogo eventi rispecchia esattamente quelli che il motore workflow
 * già usa (vedi `scatena()` in lib/workflow/motore.ts): stesso meccanismo,
 * due destinatari diversi — un'automazione interna o un sistema esterno.
 */
export const CATALOGO_EVENTI = [
  { chiave: "preventivo.bozza", etichetta: "Preventivo in bozza" },
  { chiave: "preventivo.inviato", etichetta: "Preventivo inviato" },
  { chiave: "preventivo.accettato", etichetta: "Preventivo accettato" },
  { chiave: "preventivo.rifiutato", etichetta: "Preventivo rifiutato" },
  { chiave: "progetto.da_avviare", etichetta: "Progetto da avviare" },
  { chiave: "progetto.in_corso", etichetta: "Progetto avviato" },
  { chiave: "progetto.in_pausa", etichetta: "Progetto in pausa" },
  { chiave: "progetto.concluso", etichetta: "Progetto concluso" },
  { chiave: "fattura.da_emettere", etichetta: "Fattura da emettere" },
  { chiave: "fattura.emessa", etichetta: "Fattura emessa" },
  { chiave: "fattura.pagata", etichetta: "Fattura pagata" },
  { chiave: "fattura.scaduta", etichetta: "Fattura scaduta" },
] as const;

export type PayloadWebhook = {
  evento: string;
  entita: string;
  id?: string;
  dati: Record<string, unknown>;
  inviataIl: string;
};

export function firmaPayload(corpo: string, secret: string) {
  return createHmac("sha256", secret).update(corpo).digest("hex");
}

/**
 * Notifica tutti i webhook attivi iscritti a un evento. Non solleva mai:
 * un endpoint remoto irraggiungibile non deve far fallire l'operazione che
 * ha generato l'evento, esattamente come per i workflow.
 */
export async function notificaWebhook(
  evento: string,
  ctx: { entita: string; id?: string; dati: Record<string, unknown> },
) {
  try {
    const webhook = await prisma.webhook.findMany({
      where: { attivo: true, eliminataIl: null },
    });
    const iscritti = webhook.filter(
      (w) => w.eventi.includes("*") || w.eventi.includes(evento),
    );
    if (iscritti.length === 0) return;

    const payload: PayloadWebhook = {
      evento,
      entita: ctx.entita,
      id: ctx.id,
      dati: ctx.dati,
      inviataIl: new Date().toISOString(),
    };
    const corpo = JSON.stringify(payload);

    await Promise.all(iscritti.map((w) => consegna(w.id, w.url, w.secret, evento, corpo)));
  } catch {
    /* nessun impatto sull'operazione chiamante */
  }
}

async function consegna(
  webhookId: string,
  url: string,
  secret: string,
  evento: string,
  corpo: string,
) {
  let statusHttp: number | null = null;
  let successo = false;
  let errore: string | null = null;

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telaio-Signature": firmaPayload(corpo, secret),
        "X-Telaio-Event": evento,
      },
      body: corpo,
      signal: controller.signal,
    });
    clearTimeout(t);
    statusHttp = r.status;
    successo = r.ok;
    if (!r.ok) errore = `risposta ${r.status}`;
  } catch (e) {
    errore = e instanceof Error ? e.message : "endpoint non raggiungibile";
  }

  await prisma.registroWebhook
    .create({
      data: {
        webhookId,
        evento,
        payload: JSON.parse(corpo),
        successo,
        statusHttp,
        errore,
      },
    })
    .catch(() => {});
}

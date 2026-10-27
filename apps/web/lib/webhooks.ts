import { type Database, eq, webhookDeliveries, webhooks } from "@telaio/db";

import { type EventoWebhook } from "./eventi-webhook";

/**
 * Mette in coda una consegna per ogni webhook attivo iscritto all'evento. L'invio vero (con
 * firma HMAC e nuovi tentativi) lo fa il job `consegna-webhook` del worker. Non deve mai far
 * fallire l'operazione di dominio che l'ha generato.
 */
export async function emettiEvento(db: Database, evento: EventoWebhook, payload: unknown) {
  try {
    const attivi = await db.select().from(webhooks).where(eq(webhooks.attivo, true));
    const destinatari = attivi.filter((w) => w.eventi.includes(evento) || w.eventi.includes("*"));
    if (destinatari.length === 0) return;
    await db.insert(webhookDeliveries).values(
      destinatari.map((w) => ({
        webhookId: w.id,
        evento,
        payload: { evento, creatoIl: new Date().toISOString(), dati: payload },
      })),
    );
  } catch (e) {
    console.error("[webhook] evento non accodato:", e instanceof Error ? e.message : e);
  }
}

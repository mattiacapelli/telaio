import { and, type Database, eq, rate, solleciti } from "@telaio/db";
import { z } from "zod";
import { inviaEmailPerRagioneSociale } from "../email-ragione-sociale";

export const confermaSollecitoSchema = z.object({
  id: z.uuid(),
  destinatario: z.email("Indirizzo email non valido"),
  oggetto: z.string().trim().min(1, "L'oggetto è obbligatorio"),
  corpo: z.string().trim().min(1, "Il testo è obbligatorio"),
});

/**
 * Invia un sollecito SOLO dopo la conferma dell'utente (con destinatario e testo da lui rivisti).
 * Il sollecito viene "prenotato" con un UPDATE condizionato: una doppia conferma non invia due email.
 * Se l'invio fallisce torna in `da_confermare`.
 */
export async function inviaSollecitoConfermato(
  db: Database,
  input: z.infer<typeof confermaSollecitoSchema>,
) {
  const d = confermaSollecitoSchema.parse(input);
  const [s] = await db
    .update(solleciti)
    .set({
      stato: "inviato",
      inviatoIl: new Date(),
      destinatario: d.destinatario,
      oggetto: d.oggetto,
      corpo: d.corpo,
    })
    .where(and(eq(solleciti.id, d.id), eq(solleciti.stato, "da_confermare")))
    .returning();
  if (!s) throw new Error("Sollecito già gestito o inesistente");

  try {
    const [r] = await db
      .select({ rs: rate.ragioneSocialeId })
      .from(rate)
      .where(eq(rate.id, s.rataId));
    await inviaEmailPerRagioneSociale(db, r?.rs, {
      a: d.destinatario,
      oggetto: d.oggetto,
      testo: d.corpo,
    });
  } catch (e) {
    await db
      .update(solleciti)
      .set({ stato: "da_confermare", inviatoIl: null })
      .where(eq(solleciti.id, s.id));
    throw new Error(
      `Invio email non riuscito: ${e instanceof Error ? e.message : "errore sconosciuto"}`,
    );
  }
}

export async function scartaSollecito(db: Database, id: string) {
  await db
    .update(solleciti)
    .set({ stato: "annullato" })
    .where(and(eq(solleciti.id, id), eq(solleciti.stato, "da_confermare")));
}

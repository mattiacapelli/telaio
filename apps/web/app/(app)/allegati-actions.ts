"use server";

import {
  collegaDocumentiEsistenti,
  eliminaDocumento,
  getDb,
  type Proprietario,
  registraLink,
} from "@telaio/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { archivioPronto, eliminaOggetto } from "@/lib/archivio/s3";
import { audit } from "@/lib/audit";
import { leggi } from "@/lib/form";
import { requireSession } from "@/lib/session";

const vuotoNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** A chi si allega: esattamente uno tra progetto, preventivo e cliente (più il ticket, per i progetti). */
const destinazione = z
  .object({
    progettoId: z.preprocess(vuotoNull, z.uuid().optional()),
    preventivoId: z.preprocess(vuotoNull, z.uuid().optional()),
    clienteRefId: z.preprocess(vuotoNull, z.uuid().optional()),
    ticketId: z.preprocess(vuotoNull, z.uuid().optional()),
  })
  .refine(
    (d) => [d.progettoId, d.preventivoId, d.clienteRefId].filter(Boolean).length === 1,
    "Destinazione non valida",
  );

type Destinazione = z.infer<typeof destinazione>;

function proprietarioDa(d: Destinazione): Proprietario {
  if (d.progettoId) return { progettoId: d.progettoId };
  if (d.preventivoId) return { preventivoId: d.preventivoId };
  return { clienteRefId: d.clienteRefId as string };
}

const linkSchema = z.object({
  titolo: z.string(),
  url: z.string(),
  categoria: z.string().optional(),
  descrizione: z.string().optional(),
});

/** Allega un link a un progetto (o ticket), a un preventivo o a un cliente. */
export async function aggiungiLinkAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const dest = leggi(destinazione, form);
  if (!dest.ok) return dest.state;
  const dati = leggi(linkSchema, form);
  if (!dati.ok) return dati.state;
  const db = getDb();
  try {
    const l = await registraLink(db, {
      ...proprietarioDa(dest.data),
      ticketId: dest.data.ticketId,
      ...dati.data,
      caricatoDaId: user.id,
    });
    await audit(db, {
      userId: user.id,
      azione: "documento.link_aggiunto",
      entita: "progetto_documenti",
      entitaId: l.id,
      dettagli: { ...proprietarioDa(dest.data), titolo: dati.data.titolo },
    });
  } catch (e) {
    return { ok: false, message: messaggioDa(e, "Link non aggiunto") };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Link aggiunto" };
}

const scelteSchema = z.object({
  documentoIds: z
    .array(z.uuid("Identificativo non valido"))
    .min(1, "Scegli almeno un file")
    .max(20),
});

/** Allega file già presenti nell'archivio: nessuna copia, lo stesso oggetto del bucket. */
export async function collegaDocumentiAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const dest = leggi(destinazione, form);
  if (!dest.ok) return dest.state;
  const scelte = scelteSchema.safeParse({ documentoIds: form.getAll("documentoIds") });
  if (!scelte.success)
    return { ok: false, message: scelte.error.issues[0]?.message ?? "Scegli almeno un file" };
  const db = getDb();
  try {
    const creati = await collegaDocumentiEsistenti(db, {
      ...proprietarioDa(dest.data),
      ticketId: dest.data.ticketId,
      documentoIds: scelte.data.documentoIds,
      caricatoDaId: user.id,
    });
    for (const c of creati)
      await audit(db, {
        userId: user.id,
        azione: "documento.collegato",
        entita: "progetto_documenti",
        entitaId: c.id,
        dettagli: { ...proprietarioDa(dest.data), nome: c.nome },
      });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: creati.length === 1 ? "File allegato" : `${creati.length} file allegati`,
    };
  } catch (e) {
    return { ok: false, message: messaggioDa(e, "Allegato non riuscito") };
  }
}

const schema = z.object({ id: z.uuid("Identificativo non valido") });

/**
 * Toglie l'allegato. Il file lascia il bucket solo se nessun altro allegato lo usa; se il bucket
 * non risponde il file resta lì, ma l'app non lo raggiunge più.
 */
export async function eliminaDocumentoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(schema, form);
  if (!r.ok) return r.state;
  const db = getDb();
  try {
    const d = await eliminaDocumento(db, r.data.id);
    await audit(db, {
      userId: user.id,
      azione: "documento.eliminato",
      entita: "progetto_documenti",
      entitaId: r.data.id,
      dettagli: { progettoId: d.progettoId, preventivoId: d.preventivoId, nome: d.nome },
    });
    if (d.chiaveDaRimuovere) {
      try {
        await eliminaOggetto(await archivioPronto(db), d.chiaveDaRimuovere);
      } catch {
        // già tolto dall'elenco: il file rimasto nel bucket non è più raggiungibile dall'app
      }
    }
  } catch (e) {
    return { ok: false, message: messaggioDa(e, "Eliminazione non riuscita") };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Eliminato" };
}

/** Il primo messaggio leggibile: gli errori di validazione di Zod non vanno mostrati come JSON. */
function messaggioDa(e: unknown, predefinito: string) {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? predefinito;
  return e instanceof Error ? e.message : predefinito;
}

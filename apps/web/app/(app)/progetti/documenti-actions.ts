"use server";

import { eliminaDocumento, getDb } from "@telaio/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { archivioPronto, eliminaOggetto } from "@/lib/archivio/s3";
import { audit } from "@/lib/audit";
import { leggi } from "@/lib/form";
import { requireSession } from "@/lib/session";

const schema = z.object({ id: z.uuid("Identificativo non valido") });

/** Toglie il documento dal progetto e il file dal bucket. Se il bucket non risponde il file resta lì, senza padrone. */
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
      dettagli: { progettoId: d.progettoId, nome: d.nome },
    });
    try {
      await eliminaOggetto(await archivioPronto(db), d.chiave);
    } catch {
      // già tolto dal progetto: il file rimasto nel bucket non è più raggiungibile dall'app
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Eliminazione non riuscita" };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Documento eliminato" };
}

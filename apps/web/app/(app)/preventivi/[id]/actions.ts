"use server";

import { accettazioneInputSchema, type StatoPreventivo } from "@telaio/core";
import { accettaPreventivo, getDb } from "@telaio/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import { modificaDataPreventivo } from "@/lib/dominio/preventivi";
import { cambiaStatoPreventivo } from "@/lib/dominio/preventivi-stato";
import { requireSession } from "@/lib/session";
import { emettiEvento } from "@/lib/webhooks";

const stati = z.enum([
  "bozza",
  "inviato",
  "in_revisione",
  "accettato",
  "accettato_parzialmente",
  "rifiutato",
  "scaduto",
]);

export async function cambiaStatoPreventivoAction(form: FormData): Promise<void> {
  const { user } = await requireSession();
  const id = String(form.get("id"));
  const nuovo = stati.parse(form.get("stato")) as StatoPreventivo;
  const db = getDb();
  await cambiaStatoPreventivo(db, id, nuovo);
  await audit(db, {
    userId: user.id,
    azione: "preventivo.stato",
    entita: "preventivi",
    entitaId: id,
    dettagli: { nuovo },
  });
  revalidatePath("/", "layout");
}

/**
 * Registra l'accettazione, totale o parziale, scelta dall'utente. Il client invia solo le scelte:
 * righe indipendenti accettate (`righe`), una scelta esplicita per ogni gruppo di alternative
 * (`gruppo:<id>` = id della riga scelta oppure `none`) e la decorrenza. Tutto il resto si ricalcola
 * e si riconvalida sul server. Con `intent=rifiuta` registra invece il rifiuto.
 */
export async function accettaPreventivoAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireSession();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { ok: false, message: "Preventivo non valido" };
  const db = getDb();

  if (form.get("intent") === "rifiuta") {
    try {
      await cambiaStatoPreventivo(db, id.data, "rifiutato");
      await audit(db, {
        userId: user.id,
        azione: "preventivo.rifiutato",
        entita: "preventivi",
        entitaId: id.data,
        dettagli: { nuovo: "rifiutato" },
      });
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Rifiuto non riuscito" };
    }
    revalidatePath("/", "layout");
    return { ok: true, message: "Preventivo rifiutato" };
  }

  const gruppi: Record<string, string | null> = {};
  for (const [chiave, valore] of form.entries())
    if (chiave.startsWith("gruppo:"))
      gruppi[chiave.slice(7)] = valore === "none" ? null : String(valore);
  const decorrenza = String(form.get("decorrenza") ?? "");
  const input = accettazioneInputSchema.safeParse({
    scelta: { righe: form.getAll("righe").map(String), gruppi },
    decorrenza: decorrenza || undefined,
  });
  if (!input.success)
    return { ok: false, message: input.error.issues[0]?.message ?? "Controlla la selezione" };

  try {
    const esito = await accettaPreventivo(db, id.data, input.data);
    await audit(db, {
      userId: user.id,
      azione:
        esito.stato === "accettato" ? "preventivo.accettato" : "preventivo.accettato_parzialmente",
      entita: "preventivi",
      entitaId: id.data,
      dettagli: {
        stato: esito.stato,
        righeAccettate: esito.righeAccettate,
        righeEscluse: esito.righeEscluse,
        alternativeScelte: esito.alternativeScelte,
        totaliOriginali: esito.totaliOriginali,
        totaliAccettati: esito.totaliAccettati,
        abbonamentiCreati: esito.abbonamentiCreati,
        decorrenza: esito.decorrenza,
        rateGenerate: esito.rateGenerate,
      },
    });
    await emettiEvento(db, "preventivo.stato", {
      preventivoId: id.data,
      stato: esito.stato,
      numero: esito.numero,
    });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        esito.stato === "accettato" ? "Preventivo accettato" : "Preventivo accettato parzialmente",
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Accettazione non riuscita" };
  }
}

/** Cambia la data di un preventivo già inviato; resta nell'anno del suo numero. */
export async function modificaDataPreventivoAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireSession();
  const id = z.uuid().safeParse(form.get("id"));
  const data = String(form.get("data") ?? "");
  if (!id.success) return { ok: false, message: "Preventivo non valido" };
  try {
    const db = getDb();
    await modificaDataPreventivo(db, id.data, data);
    await audit(db, {
      userId: user.id,
      azione: "preventivo.data_modificata",
      entita: "preventivi",
      entitaId: id.data,
      dettagli: { data },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Modifica non riuscita";
    return { ok: false, message, errors: { data: message } };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Data aggiornata" };
}

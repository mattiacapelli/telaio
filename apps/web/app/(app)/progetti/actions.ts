"use server";

import {
  type CategoriaProgetto,
  progettoDatiSchema,
  risorsaSchema,
  STATI_PROGETTO,
  type StatoProgetto,
} from "@telaio/core";
import {
  aggiungiRisorsa,
  cambiaStatoProgetto,
  creaProgetto,
  creaProgettoDaPreventivo,
  eliminaRisorsa,
  getDb,
  modificaProgetto,
  modificaRisorsa,
} from "@telaio/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import { risolviClienteRef } from "@/lib/dominio/cliente-ref";
import { leggi, testoOpt } from "@/lib/form";
import { requireSession } from "@/lib/session";

const idSchema = z.uuid("Identificativo non valido");

const riferimentiSchema = z.object({
  clienteTwentyId: testoOpt,
  preventivoId: testoOpt.refine((v) => v === null || z.uuid().safeParse(v).success, {
    message: "Preventivo non valido",
  }),
});

const errore = (e: unknown, predefinito: string): ActionState => ({
  ok: false,
  message: e instanceof Error ? e.message : predefinito,
});

/** Dati del progetto + cliente e preventivo dal form; tutto riconvalidato qui, il client non è affidabile. */
function leggiForm(form: FormData) {
  const dati = leggi(progettoDatiSchema, form);
  const rif = leggi(riferimentiSchema, form);
  if (!dati.ok) return { ok: false as const, state: dati.state };
  if (!rif.ok) return { ok: false as const, state: rif.state };
  return { ok: true as const, dati: dati.data, rif: rif.data };
}

export async function creaProgettoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const l = leggiForm(form);
  if (!l.ok) return l.state;
  let id: string;
  try {
    const db = getDb();
    const cliente = l.rif.clienteTwentyId
      ? await risolviClienteRef(db, l.rif.clienteTwentyId)
      : null;
    const r = await creaProgetto(db, {
      dati: l.dati,
      clienteRefId: cliente?.id ?? null,
      preventivoId: l.rif.preventivoId,
    });
    id = r.id;
    await audit(db, {
      userId: user.id,
      azione: "progetto.creato",
      entita: "progetti",
      entitaId: id,
      dettagli: { codice: r.codice, preventivoId: l.rif.preventivoId },
    });
  } catch (e) {
    return errore(e, "Creazione non riuscita");
  }
  revalidatePath("/progetti");
  redirect(`/progetti/${id}`);
}

export async function modificaProgettoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return { ok: false, message: "Progetto non valido" };
  const l = leggiForm(form);
  if (!l.ok) return l.state;
  try {
    const db = getDb();
    const cliente = l.rif.clienteTwentyId
      ? await risolviClienteRef(db, l.rif.clienteTwentyId)
      : null;
    const esito = await modificaProgetto(db, id.data, {
      dati: l.dati,
      clienteRefId: cliente?.id ?? null,
      preventivoId: l.rif.preventivoId,
    });
    await audit(db, {
      userId: user.id,
      azione: "progetto.modificato",
      entita: "progetti",
      entitaId: id.data,
      dettagli: { codice: esito.codice },
    });
    if (esito.cambioStato)
      await audit(db, {
        userId: user.id,
        azione: "progetto.stato",
        entita: "progetti",
        entitaId: id.data,
        dettagli: esito.cambioStato,
      });
  } catch (e) {
    return errore(e, "Modifica non riuscita");
  }
  revalidatePath("/progetti", "layout");
  redirect(`/progetti/${id.data}`);
}

export async function cambiaStatoProgettoAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireSession();
  const id = idSchema.safeParse(form.get("id"));
  const stato = z.enum(STATI_PROGETTO).safeParse(form.get("stato"));
  if (!id.success || !stato.success) return { ok: false, message: "Stato non valido" };
  try {
    const db = getDb();
    const cambio = await cambiaStatoProgetto(db, id.data, stato.data as StatoProgetto);
    if (cambio)
      await audit(db, {
        userId: user.id,
        azione: "progetto.stato",
        entita: "progetti",
        entitaId: id.data,
        dettagli: cambio,
      });
  } catch (e) {
    return errore(e, "Cambio di stato non riuscito");
  }
  revalidatePath("/progetti", "layout");
  return { ok: true, message: "Stato aggiornato" };
}

/** Scelta esplicita dell'utente: mai automatica. Un preventivo può generare più progetti. */
export async function creaProgettoDaPreventivoAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireSession();
  const preventivoId = idSchema.safeParse(form.get("preventivoId"));
  if (!preventivoId.success) return { ok: false, message: "Preventivo non valido" };
  const dati = leggi(progettoDatiSchema, form);
  if (!dati.ok) return dati.state;
  let id: string;
  try {
    const db = getDb();
    const r = await creaProgettoDaPreventivo(db, {
      preventivoId: preventivoId.data,
      dati: { nome: dati.data.nome, categoria: dati.data.categoria as CategoriaProgetto },
    });
    id = r.id;
    await audit(db, {
      userId: user.id,
      azione: "progetto.creato_da_preventivo",
      entita: "progetti",
      entitaId: id,
      dettagli: { codice: r.codice, preventivoId: preventivoId.data },
    });
  } catch (e) {
    return errore(e, "Creazione non riuscita");
  }
  revalidatePath("/progetti");
  redirect(`/progetti/${id}`);
}

// ── Risorse ──────────────────────────────────────────────────────────────────────────────────

export async function aggiungiRisorsaAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const progettoId = idSchema.safeParse(form.get("progettoId"));
  if (!progettoId.success) return { ok: false, message: "Progetto non valido" };
  const l = leggi(risorsaSchema, form);
  if (!l.ok) return l.state;
  try {
    const db = getDb();
    const r = await aggiungiRisorsa(db, progettoId.data, l.data);
    await audit(db, {
      userId: user.id,
      azione: "progetto_risorsa.creata",
      entita: "progetto_risorse",
      entitaId: r.id,
      dettagli: { progettoId: progettoId.data, tipo: l.data.tipo, titolo: l.data.titolo },
    });
  } catch (e) {
    return errore(e, "Risorsa non aggiunta");
  }
  revalidatePath(`/progetti/${progettoId.data}`);
  return { ok: true, message: "Risorsa aggiunta" };
}

export async function modificaRisorsaAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return { ok: false, message: "Risorsa non valida" };
  const l = leggi(risorsaSchema, form);
  if (!l.ok) return l.state;
  try {
    const db = getDb();
    const r = await modificaRisorsa(db, id.data, l.data);
    await audit(db, {
      userId: user.id,
      azione: "progetto_risorsa.modificata",
      entita: "progetto_risorse",
      entitaId: id.data,
      dettagli: { progettoId: r.progettoId, tipo: l.data.tipo, titolo: l.data.titolo },
    });
    revalidatePath(`/progetti/${r.progettoId}`);
  } catch (e) {
    return errore(e, "Risorsa non modificata");
  }
  return { ok: true, message: "Risorsa aggiornata" };
}

export async function eliminaRisorsaAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return { ok: false, message: "Risorsa non valida" };
  try {
    const db = getDb();
    const r = await eliminaRisorsa(db, id.data);
    await audit(db, {
      userId: user.id,
      azione: "progetto_risorsa.eliminata",
      entita: "progetto_risorse",
      entitaId: id.data,
      dettagli: { progettoId: r.progettoId, titolo: r.titolo },
    });
    revalidatePath(`/progetti/${r.progettoId}`);
  } catch (e) {
    return errore(e, "Risorsa non eliminata");
  }
  return { ok: true, message: "Risorsa eliminata" };
}

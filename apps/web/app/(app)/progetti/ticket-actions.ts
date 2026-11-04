"use server";

import {
  commentoTicketSchema,
  STATI_TICKET,
  type StatoTicket,
  ticketDatiSchema,
} from "@telaio/core";
import {
  commentaTicket,
  creaTicket,
  eliminaCommento,
  eliminaTicket,
  getDb,
  modificaTicket,
  spostaTicket,
} from "@telaio/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import { leggi } from "@/lib/form";
import { requireSession } from "@/lib/session";
import { leggiTicketImpostazioni } from "@/lib/ticket-impostazioni";

const idSchema = z.uuid("Identificativo non valido");
const errore = (e: unknown, predefinito: string): ActionState => ({
  ok: false,
  message: e instanceof Error ? e.message : predefinito,
});
const aggiorna = () => revalidatePath("/progetti", "layout");

const conProgetto = ticketDatiSchema.safeExtend({ progettoId: idSchema });

export async function creaTicketAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(conProgetto, form);
  if (!r.ok) return r.state;
  const { progettoId, ...dati } = r.data;
  try {
    const db = getDb();
    const t = await creaTicket(db, progettoId, dati, user.id);
    await audit(db, {
      userId: user.id,
      azione: "ticket.creato",
      entita: "ticket",
      entitaId: t.id,
      dettagli: { codice: t.codice, progettoId },
    });
  } catch (e) {
    return errore(e, "Creazione non riuscita");
  }
  aggiorna();
  return { ok: true, message: "Ticket creato" };
}

/** Un ticket creato dalla lavagna con il solo titolo, nella colonna scelta. */
export async function creaTicketRapidoAction(
  progettoId: string,
  stato: StatoTicket,
  titolo: string,
): Promise<ActionState> {
  const { user } = await requireSession();
  if (!idSchema.safeParse(progettoId).success || !STATI_TICKET.includes(stato))
    return { ok: false, message: "Richiesta non valida" };
  try {
    const db = getDb();
    // Con l'assegnazione automatica attiva il ticket rapido va subito a chi lo crea.
    const { autoAssegna } = await leggiTicketImpostazioni(db);
    const t = await creaTicket(
      db,
      progettoId,
      { titolo, stato, assegnatarioId: autoAssegna ? user.id : null },
      user.id,
    );
    await audit(db, {
      userId: user.id,
      azione: "ticket.creato",
      entita: "ticket",
      entitaId: t.id,
      dettagli: { codice: t.codice, progettoId },
    });
  } catch (e) {
    return errore(e, "Creazione non riuscita");
  }
  aggiorna();
  return { ok: true };
}

const conId = ticketDatiSchema.safeExtend({ id: idSchema });

export async function modificaTicketAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(conId, form);
  if (!r.ok) return r.state;
  const { id, ...dati } = r.data;
  try {
    const db = getDb();
    const esito = await modificaTicket(db, id, dati);
    await audit(db, {
      userId: user.id,
      azione: esito.cambioStato ? "ticket.stato" : "ticket.modificato",
      entita: "ticket",
      entitaId: id,
      dettagli: { codice: esito.codice, ...(esito.cambioStato ?? {}) },
    });
  } catch (e) {
    return errore(e, "Modifica non riuscita");
  }
  aggiorna();
  return { ok: true, message: "Ticket aggiornato" };
}

/** Spostamento dalla lavagna: colonna di arrivo e ticket davanti al quale mettersi (`null` = in fondo). */
export async function spostaTicketAction(
  id: string,
  stato: StatoTicket,
  primaDi: string | null,
): Promise<ActionState> {
  const { user } = await requireSession();
  if (
    !idSchema.safeParse(id).success ||
    !STATI_TICKET.includes(stato) ||
    (primaDi !== null && !idSchema.safeParse(primaDi).success)
  )
    return { ok: false, message: "Richiesta non valida" };
  try {
    const db = getDb();
    const esito = await spostaTicket(db, id, { stato, primaDi });
    if (esito.cambioStato)
      await audit(db, {
        userId: user.id,
        azione: "ticket.stato",
        entita: "ticket",
        entitaId: id,
        dettagli: { codice: esito.codice, ...esito.cambioStato },
      });
  } catch (e) {
    return errore(e, "Spostamento non riuscito");
  }
  aggiorna();
  return { ok: true };
}

export async function eliminaTicketAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(z.object({ id: idSchema }), form);
  if (!r.ok) return r.state;
  let progettoId: string;
  try {
    const db = getDb();
    const t = await eliminaTicket(db, r.data.id);
    progettoId = t.progettoId;
    await audit(db, {
      userId: user.id,
      azione: "ticket.eliminato",
      entita: "ticket",
      entitaId: r.data.id,
      dettagli: { codice: t.codice },
    });
  } catch (e) {
    return errore(e, "Eliminazione non riuscita");
  }
  aggiorna();
  redirect(`/progetti/${progettoId}/ticket`);
}

export async function commentaTicketAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(commentoTicketSchema.safeExtend({ ticketId: idSchema }), form);
  if (!r.ok) return r.state;
  try {
    const db = getDb();
    const c = await commentaTicket(db, r.data.ticketId, user.id, { testo: r.data.testo });
    await audit(db, {
      userId: user.id,
      azione: "ticket.commento",
      entita: "ticket",
      entitaId: r.data.ticketId,
      dettagli: { commentoId: c.id },
    });
  } catch (e) {
    return errore(e, "Commento non salvato");
  }
  aggiorna();
  return { ok: true };
}

export async function eliminaCommentoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(z.object({ id: idSchema }), form);
  if (!r.ok) return r.state;
  try {
    const db = getDb();
    await eliminaCommento(db, r.data.id);
    await audit(db, {
      userId: user.id,
      azione: "ticket.commento_eliminato",
      entita: "ticket_commenti",
      entitaId: r.data.id,
    });
  } catch (e) {
    return errore(e, "Eliminazione non riuscita");
  }
  aggiorna();
  return { ok: true, message: "Commento eliminato" };
}

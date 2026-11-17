"use server";

import { formattaOre, leggiDurata } from "@telaio/core";
import {
  aggiornaTimer,
  avviaTimer,
  eliminaTempo,
  fermaTimer,
  getDb,
  modificaTempo,
  registraTempo,
  scartaTimer,
} from "@telaio/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import { oggi, reData } from "@/lib/date";
import { leggi, testoOpt } from "@/lib/form";
import { requireSession } from "@/lib/session";

const uuidOpt = testoOpt.refine((v) => v === null || z.uuid().safeParse(v).success, {
  message: "Identificativo non valido",
});

const durata = z.string().transform((s, ctx) => {
  const m = leggiDurata(s);
  if (m === null) {
    ctx.addIssue({ code: "custom", message: "Durata non valida: scrivi 1:30, 1h30, 90m o 1,5" });
    return z.NEVER;
  }
  return m;
});

const schemaVoce = z.object({
  clienteRefId: uuidOpt,
  monteOreId: uuidOpt,
  ticketId: uuidOpt,
  data: z.string().regex(reData, "Data non valida"),
  durata,
  descrizione: testoOpt,
  // una casella non spuntata non arriva nel form
  fatturabile: z.string().optional(),
});

const errore = (e: unknown, predefinito: string): ActionState => ({
  ok: false,
  message: e instanceof Error ? e.message : predefinito,
});

const ricarica = () => revalidatePath("/", "layout");

/** Registra tempo già lavorato. */
export async function registraTempoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(schemaVoce, form);
  if (!r.ok) return r.state;
  const { durata: minuti, fatturabile, ...resto } = r.data;
  try {
    const db = getDb();
    const v = await registraTempo(db, { ...resto, minuti, fatturabile: fatturabile !== undefined });
    await audit(db, {
      userId: user.id,
      azione: "tempo.registrato",
      entita: "voci_tempo",
      entitaId: v.id,
      dettagli: { minuti: v.minuti, data: resto.data, monteOreId: resto.monteOreId },
    });
  } catch (e) {
    return errore(e, "Voce non registrata");
  }
  ricarica();
  return { ok: true, message: "Tempo registrato" };
}

export async function modificaTempoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { ok: false, message: "Identificativo non valido" };
  const r = leggi(schemaVoce, form);
  if (!r.ok) return r.state;
  const { durata: minuti, fatturabile, ...resto } = r.data;
  try {
    const db = getDb();
    await modificaTempo(db, id.data, { ...resto, minuti, fatturabile: fatturabile !== undefined });
    await audit(db, {
      userId: user.id,
      azione: "tempo.modificato",
      entita: "voci_tempo",
      entitaId: id.data,
      dettagli: { minuti, data: resto.data },
    });
  } catch (e) {
    return errore(e, "Voce non modificata");
  }
  ricarica();
  return { ok: true, message: "Voce aggiornata" };
}

export async function eliminaTempoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { ok: false, message: "Identificativo non valido" };
  try {
    const db = getDb();
    await eliminaTempo(db, id.data);
    await audit(db, {
      userId: user.id,
      azione: "tempo.eliminato",
      entita: "voci_tempo",
      entitaId: id.data,
    });
  } catch (e) {
    return errore(e, "Voce non eliminata");
  }
  ricarica();
  return { ok: true, message: "Voce eliminata" };
}

const schemaTimer = z.object({
  clienteRefId: uuidOpt,
  monteOreId: uuidOpt,
  ticketId: uuidOpt,
  descrizione: testoOpt,
});

export async function avviaTimerAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(schemaTimer, form);
  if (!r.ok) return r.state;
  try {
    const db = getDb();
    const t = await avviaTimer(db, { ...r.data, data: oggi() });
    await audit(db, {
      userId: user.id,
      azione: "tempo.timer_avviato",
      entita: "voci_tempo",
      entitaId: t.id,
    });
  } catch (e) {
    return errore(e, "Timer non avviato");
  }
  ricarica();
  return { ok: true, message: "Timer avviato" };
}

export async function fermaTimerAction(): Promise<ActionState> {
  const { user } = await requireSession();
  try {
    const db = getDb();
    const t = await fermaTimer(db);
    await audit(db, {
      userId: user.id,
      azione: "tempo.timer_fermato",
      entita: "voci_tempo",
      entitaId: t.id,
      dettagli: { minuti: t.minuti },
    });
    ricarica();
    return { ok: true, message: `Registrati ${formattaOre(t.minuti)}` };
  } catch (e) {
    return errore(e, "Timer non fermato");
  }
}

export async function scartaTimerAction(): Promise<ActionState> {
  const { user } = await requireSession();
  try {
    const db = getDb();
    const t = await scartaTimer(db);
    await audit(db, {
      userId: user.id,
      azione: "tempo.timer_scartato",
      entita: "voci_tempo",
      entitaId: t.id,
    });
    ricarica();
    return { ok: true, message: "Timer scartato" };
  } catch (e) {
    return errore(e, "Timer non scartato");
  }
}

/** Scrive o cambia la descrizione del timer in corso (si fa dopo l'avvio, a lavoro iniziato). */
export async function aggiornaDescrizioneTimerAction(descrizione: string): Promise<ActionState> {
  await requireSession();
  const testo = z.string().max(500).safeParse(descrizione);
  if (!testo.success) return { ok: false, message: "Al massimo 500 caratteri" };
  try {
    await aggiornaTimer(getDb(), { descrizione: testo.data });
    return { ok: true };
  } catch (e) {
    return errore(e, "Descrizione non salvata");
  }
}

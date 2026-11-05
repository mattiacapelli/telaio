"use server";

import { getDb } from "@telaio/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import {
  aggiornaPreventivoBozza,
  creaPreventivoLibero,
  creaPreventivoLiberoSchema,
} from "@/lib/dominio/preventivi";
import { requireSession } from "@/lib/session";

function righeDaForm(form: FormData): unknown {
  try {
    return JSON.parse(String(form.get("righe") ?? "[]"));
  } catch {
    return [];
  }
}

export async function creaPreventivoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const cliente = String(form.get("clienteTwentyId") ?? "");
  const parsed = creaPreventivoLiberoSchema.safeParse({
    ragioneSocialeId: form.get("ragioneSocialeId"),
    clienteTwentyId: cliente || undefined,
    righe: righeDaForm(form),
    oggetto: String(form.get("oggetto") ?? "") || undefined,
    note: String(form.get("note") ?? "") || undefined,
    validitaGiorni: Number(form.get("validitaGiorni") ?? 0) || undefined,
  });
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Controlla i dati del preventivo",
    };

  let id: string;
  try {
    const db = getDb();
    ({ id } = await creaPreventivoLibero(db, parsed.data));
    await audit(db, {
      userId: user.id,
      azione: "preventivo.creato",
      entita: "preventivi",
      entitaId: id,
      dettagli: { origine: "editor" },
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Creazione non riuscita" };
  }
  redirect(`/preventivi/${id}`);
}

/** Salva le modifiche di una bozza e torna al suo dettaglio. */
export async function aggiornaPreventivoBozzaAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireSession();
  const id = String(form.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false, message: "Preventivo non valido" };
  const cliente = String(form.get("clienteTwentyId") ?? "");
  const parsed = creaPreventivoLiberoSchema.safeParse({
    ragioneSocialeId: form.get("ragioneSocialeId"),
    clienteTwentyId: cliente || undefined,
    righe: righeDaForm(form),
    oggetto: String(form.get("oggetto") ?? "") || undefined,
    note: String(form.get("note") ?? "") || undefined,
    validitaGiorni: Number(form.get("validitaGiorni") ?? 0) || undefined,
  });
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Controlla i dati del preventivo",
    };
  try {
    const db = getDb();
    await aggiornaPreventivoBozza(db, id, parsed.data);
    await audit(db, {
      userId: user.id,
      azione: "preventivo.modificato",
      entita: "preventivi",
      entitaId: id,
      dettagli: { righe: parsed.data.righe.length },
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Salvataggio non riuscito" };
  }
  revalidatePath("/", "layout");
  redirect(`/preventivi/${id}`);
}

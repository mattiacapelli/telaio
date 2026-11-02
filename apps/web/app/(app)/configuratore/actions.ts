"use server";

import { getDb } from "@telaio/db";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import { creaPreventivoLibero, creaPreventivoLiberoSchema } from "@/lib/dominio/preventivi";
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

"use server";

import { getDb } from "@telaio/db";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import { creaPreventivoDaListino, creaPreventivoSchema } from "@/lib/dominio/preventivi";
import { requireSession } from "@/lib/session";

export async function creaPreventivoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const cliente = String(form.get("clienteTwentyId") ?? "");
  const parsed = creaPreventivoSchema.safeParse({
    ragioneSocialeId: form.get("ragioneSocialeId"),
    clienteTwentyId: cliente || undefined,
    baseId: form.get("baseId"),
    moduloIds: form.getAll("moduloIds"),
    oggetto: String(form.get("oggetto") ?? "") || undefined,
    note: String(form.get("note") ?? "") || undefined,
  });
  if (!parsed.success)
    return { ok: false, message: "Scegli una base prima di creare il preventivo" };

  let id: string;
  try {
    const db = getDb();
    ({ id } = await creaPreventivoDaListino(db, parsed.data));
    await audit(db, {
      userId: user.id,
      azione: "preventivo.creato",
      entita: "preventivi",
      entitaId: id,
      dettagli: { origine: "configuratore" },
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Creazione non riuscita" };
  }
  redirect(`/preventivi/${id}`);
}

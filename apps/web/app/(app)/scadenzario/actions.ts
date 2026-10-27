"use server";

import { getDb } from "@telaio/db";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import {
  confermaSollecitoSchema,
  inviaSollecitoConfermato,
  scartaSollecito,
} from "@/lib/dominio/solleciti";
import { leggi } from "@/lib/form";
import { requireSession } from "@/lib/session";

/** L'invio parte solo da qui, dopo che l'utente ha rivisto destinatario e testo. */
export async function inviaSollecitoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(confermaSollecitoSchema, form);
  if (!r.ok) return r.state;
  try {
    const db = getDb();
    await inviaSollecitoConfermato(db, r.data);
    await audit(db, {
      userId: user.id,
      azione: "sollecito.inviato",
      entita: "solleciti",
      entitaId: r.data.id,
      dettagli: { a: r.data.destinatario },
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Invio non riuscito" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function scartaSollecitoAction(form: FormData): Promise<void> {
  const { user } = await requireSession();
  const id = String(form.get("id"));
  const db = getDb();
  await scartaSollecito(db, id);
  await audit(db, {
    userId: user.id,
    azione: "sollecito.scartato",
    entita: "solleciti",
    entitaId: id,
  });
  revalidatePath("/", "layout");
}

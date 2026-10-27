"use server";

import { getDb } from "@telaio/db";
import { revalidatePath } from "next/cache";
import { confermaAzione, rifiutaAzione } from "@/lib/dominio/pending";
import { requireSession } from "@/lib/session";

export async function decidiAzione(form: FormData): Promise<void> {
  const { user } = await requireSession();
  const id = String(form.get("id"));
  const db = getDb();
  if (form.get("decisione") === "conferma") await confermaAzione(db, id, user.id);
  else await rifiutaAzione(db, id, user.id);
  revalidatePath("/", "layout");
}

"use server";

import { getDb } from "@telaio/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { creaFatturaDaPreventivo, emettiFattura } from "@/lib/dominio/fatture";
import { requireSession } from "@/lib/session";

export async function emettiFatturaAction(form: FormData): Promise<void> {
  const { user } = await requireSession();
  const id = String(form.get("id"));
  const db = getDb();
  const { numero } = await emettiFattura(db, id);
  await audit(db, {
    userId: user.id,
    azione: "fattura.emessa",
    entita: "fatture",
    entitaId: id,
    dettagli: { numero },
  });
  revalidatePath("/", "layout");
}

export async function creaFatturaDaPreventivoAction(form: FormData): Promise<void> {
  const { user } = await requireSession();
  const db = getDb();
  const { id } = await creaFatturaDaPreventivo(db, String(form.get("preventivoId")));
  await audit(db, {
    userId: user.id,
    azione: "fattura.creata",
    entita: "fatture",
    entitaId: id,
    dettagli: { origine: "preventivo" },
  });
  redirect(`/fatture/${id}`);
}

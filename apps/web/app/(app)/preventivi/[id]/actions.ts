"use server";

import type { StatoPreventivo } from "@telaio/core";
import { getDb } from "@telaio/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { cambiaStatoPreventivo } from "@/lib/dominio/preventivi-stato";
import { requireSession } from "@/lib/session";

const stati = z.enum(["bozza", "inviato", "in_revisione", "accettato", "rifiutato", "scaduto"]);

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

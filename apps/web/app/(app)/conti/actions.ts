"use server";

import { conti, getDb } from "@telaio/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import { euroCent, leggi, testoOpt } from "@/lib/form";
import { requireSession } from "@/lib/session";

const schema = z.object({
  nome: z.string().trim().min(1, "Inserisci il nome del conto"),
  tipo: z.enum(["bonifico", "contante", "carta"]),
  ragioneSocialeId: testoOpt,
  iban: testoOpt,
  saldoIniziale: euroCent,
});

export async function creaContoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(schema, form);
  if (!r.ok) return r.state;
  const { saldoIniziale, ...resto } = r.data;
  const db = getDb();
  const [c] = await db
    .insert(conti)
    .values({ ...resto, saldoInizialeCent: saldoIniziale })
    .returning({ id: conti.id });
  await audit(db, { userId: user.id, azione: "conto.creato", entita: "conti", entitaId: c?.id });
  revalidatePath("/", "layout");
  return { ok: true };
}

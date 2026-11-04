"use server";

import { getDb } from "@telaio/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import { reData } from "@/lib/date";
import { modificaDataIncasso, registraIncasso } from "@/lib/dominio/incassi";
import { euroCent, leggi, testoOpt } from "@/lib/form";
import { requireSession } from "@/lib/session";

const schema = z.object({
  contoId: z.uuid("Scegli il conto"),
  data: z.string().regex(reData, "Data non valida"),
  importo: euroCent,
  rataId: testoOpt,
  fatturaId: testoOpt,
  descrizione: testoOpt,
  riferimento: testoOpt,
});

export async function registraIncassoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(schema, form);
  if (!r.ok) return r.state;
  const { importo, ...resto } = r.data;
  try {
    const db = getDb();
    const incasso = await registraIncasso(db, { ...resto, importoCent: importo });
    await audit(db, {
      userId: user.id,
      azione: "incasso.registrato",
      entita: "incassi",
      entitaId: incasso.id,
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Registrazione non riuscita",
      errors: e instanceof z.ZodError ? { importo: e.issues[0]?.message ?? "" } : undefined,
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const schemaData = z.object({
  id: z.uuid(),
  data: z.string().regex(reData, "Data non valida"),
});

export async function modificaDataIncassoAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(schemaData, form);
  if (!r.ok) return r.state;
  try {
    const db = getDb();
    await modificaDataIncasso(db, r.data.id, r.data.data);
    await audit(db, {
      userId: user.id,
      azione: "incasso.data_modificata",
      entita: "incassi",
      entitaId: r.data.id,
      dettagli: { data: r.data.data },
    });
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Modifica non riuscita",
      errors: { data: e instanceof Error ? e.message : "" },
    };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Data aggiornata" };
}

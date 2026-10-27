"use server";

import { getDb } from "@telaio/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { reData } from "@/lib/date";
import { registraMovimento } from "@/lib/dominio/movimenti";
import { euroCent, leggi, testoOpt } from "@/lib/form";
import { requireSession } from "@/lib/session";

const schema = z.object({
  tipo: z.enum(["entrata", "uscita", "giroconto"]),
  data: z.string().regex(reData, "Data non valida"),
  importo: euroCent,
  contoId: z.uuid("Scegli il conto"),
  contoDestinazioneId: testoOpt,
  categoria: testoOpt,
  descrizione: testoOpt,
});

export async function registraMovimentoAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireSession();
  const r = leggi(schema, form);
  if (!r.ok) return r.state;
  const { importo, ...resto } = r.data;
  try {
    await registraMovimento(getDb(), { ...resto, importoCent: importo });
  } catch (e) {
    if (e instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      for (const i of e.issues)
        errors[String(i.path[0] === "importoCent" ? "importo" : i.path[0])] ??= i.message;
      return { ok: false, errors, message: "Controlla i campi evidenziati" };
    }
    return { ok: false, message: e instanceof Error ? e.message : "Registrazione non riuscita" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

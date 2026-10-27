"use server";

import { getDb } from "@telaio/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import { oggi, reData } from "@/lib/date";
import { cambiaStatoAbbonamento, creaAbbonamento } from "@/lib/dominio/abbonamenti";
import { euroCent, leggi, testoOpt } from "@/lib/form";
import { requireSession } from "@/lib/session";

const schema = z.object({
  clienteRefId: z.uuid("Scegli il cliente"),
  ragioneSocialeId: z.uuid("Scegli la ragione sociale"),
  descrizione: z.string().trim().min(1, "Inserisci una descrizione"),
  periodicita: z.enum(["mensile", "trimestrale", "semestrale", "annuale"]),
  importo: euroCent,
  inizio: z.string().regex(reData, "Data non valida"),
  fine: testoOpt.refine((v) => v === null || reData.test(v), "Data non valida"),
});

export async function creaAbbonamentoAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(schema, form);
  if (!r.ok) return r.state;
  const { importo, ...resto } = r.data;
  try {
    const db = getDb();
    const ab = await creaAbbonamento(db, { ...resto, importoRataCent: importo });
    await audit(db, {
      userId: user.id,
      azione: "abbonamento.creato",
      entita: "abbonamenti",
      entitaId: ab.id,
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Creazione non riuscita" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const stati = z.enum(["attivo", "sospeso", "cessato"]);

export async function cambiaStatoAbbonamentoAction(form: FormData): Promise<void> {
  const { user } = await requireSession();
  const id = z.uuid().parse(form.get("id"));
  const stato = stati.parse(form.get("stato"));
  const db = getDb();
  await cambiaStatoAbbonamento(db, id, stato, oggi());
  await audit(db, {
    userId: user.id,
    azione: "abbonamento.stato",
    entita: "abbonamenti",
    entitaId: id,
    dettagli: { stato },
  });
  revalidatePath("/", "layout");
}

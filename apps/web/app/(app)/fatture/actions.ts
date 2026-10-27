"use server";

import { getDb } from "@telaio/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import { creaFatturaDaPreventivo, creaFatturaLibera, emettiFattura } from "@/lib/dominio/fatture";
import { euroCent, leggi, percentualeBp, testoOpt } from "@/lib/form";
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

const NUMERO_RIGHE = 5;

const schemaLibera = z.object({
  ragioneSocialeId: z.uuid("Scegli la ragione sociale"),
  clienteRefId: testoOpt,
  nome: testoOpt,
  partitaIva: testoOpt,
  codiceFiscale: testoOpt,
  indirizzo: testoOpt,
  note: testoOpt,
});

const schemaRiga = z.object({
  descrizione: z.string().trim().min(1),
  quantita: z.coerce.number().int().min(1, "Quantità non valida"),
  prezzo: euroCent,
  sconto: percentualeBp,
});

export async function creaFatturaLiberaAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(schemaLibera, form);
  if (!r.ok) return r.state;

  const righe: z.infer<typeof schemaRiga>[] = [];
  for (let i = 0; i < NUMERO_RIGHE; i++) {
    const descrizione = String(form.get(`descrizione${i}`) ?? "").trim();
    if (!descrizione) continue;
    const riga = schemaRiga.safeParse({
      descrizione,
      quantita: form.get(`quantita${i}`) || "1",
      prezzo: String(form.get(`prezzo${i}`) ?? ""),
      sconto: String(form.get(`sconto${i}`) ?? ""),
    });
    if (!riga.success) {
      return {
        ok: false,
        message: `Riga ${i + 1}: ${riga.error.issues[0]?.message ?? "non valida"}`,
      };
    }
    righe.push(riga.data);
  }

  const { clienteRefId, nome, partitaIva, codiceFiscale, indirizzo, note, ragioneSocialeId } =
    r.data;
  if (!clienteRefId && !nome) {
    return {
      ok: false,
      errors: { nome: "Scegli un cliente o indica il nome" },
      message: "Indica il cliente",
    };
  }
  let id: string;
  try {
    const db = getDb();
    ({ id } = await creaFatturaLibera(db, {
      ragioneSocialeId,
      clienteRefId,
      occasionale: clienteRefId || !nome ? null : { nome, partitaIva, codiceFiscale, indirizzo },
      note,
      righe: righe.map((x) => ({
        descrizione: x.descrizione,
        quantita: x.quantita,
        prezzoUnitarioCent: x.prezzo,
        scontoBp: x.sconto ?? 0,
      })),
    }));
    await audit(db, {
      userId: user.id,
      azione: "fattura.creata",
      entita: "fatture",
      entitaId: id,
      dettagli: { origine: "libera" },
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Creazione non riuscita" };
  }
  redirect(`/fatture/${id}`);
}

"use server";

import { eq, fatture, getDb } from "@telaio/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import { oggi, reData } from "@/lib/date";
import {
  creaFatturaDaPreventivo,
  creaFatturaLibera,
  emettiFattura,
  modificaDateFattura,
} from "@/lib/dominio/fatture";
import { registraIncasso } from "@/lib/dominio/incassi";
import { euroCent, flag, leggi, percentualeBp, testoOpt } from "@/lib/form";
import { requireSession } from "@/lib/session";

export async function emettiFatturaAction(form: FormData): Promise<void> {
  const { user } = await requireSession();
  const id = String(form.get("id"));
  const scelta = String(form.get("dataEmissione") ?? "");
  const db = getDb();
  const { numero } = await emettiFattura(
    db,
    id,
    undefined,
    reData.test(scelta) ? scelta : undefined,
  );
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

const schemaPagina = z.object({
  azione: z.enum(["bozza", "emetti"]),
  ragioneSocialeId: z.uuid("Scegli l'emittente"),
  modo: z.enum(["twenty", "occasionale", "privato"]),
  clienteRefId: testoOpt,
  nome: testoOpt,
  partitaIva: testoOpt,
  codiceFiscale: testoOpt,
  sdiPec: testoOpt,
  indirizzo: testoOpt,
  note: testoOpt,
  incassata: flag,
  contoId: testoOpt,
  metodo: z.enum(["bonifico", "contanti", "carta"]).default("bonifico"),
  giorniScadenza: z.coerce.number().int().min(0).max(365).default(30),
  dataEmissione: z.string().regex(reData, "Data non valida").default(""),
  dataIncasso: z.string().regex(reData, "Data non valida").default(""),
  righe: z.string(),
});

const schemaRiga = z.object({
  d: z.string().trim().min(1),
  q: z.number().int().min(1),
  p: z.string(),
  s: z.string().default(""),
});

export async function salvaFatturaLiberaAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(schemaPagina, form);
  if (!r.ok) return r.state;
  const dati = r.data;

  let grezze: unknown;
  try {
    grezze = JSON.parse(dati.righe);
  } catch {
    return { ok: false, message: "Righe non valide" };
  }
  const parse = z.array(schemaRiga).safeParse(grezze);
  if (!parse.success) return { ok: false, message: "Controlla le righe: descrizione e quantità" };
  const righe = [];
  for (const [i, x] of parse.data.entries()) {
    const prezzo = euroCent.safeParse(x.p);
    const sconto = percentualeBp.safeParse(x.s);
    if (!prezzo.success || !sconto.success) {
      return { ok: false, message: `Riga ${i + 1}: prezzo o sconto non validi` };
    }
    righe.push({
      descrizione: x.d,
      quantita: x.q,
      prezzoUnitarioCent: prezzo.data,
      scontoBp: sconto.data ?? 0,
    });
  }
  if (dati.modo === "twenty" && !dati.clienteRefId) {
    return { ok: false, message: "Scegli l'azienda" };
  }
  if (dati.modo !== "twenty" && !dati.nome) {
    return { ok: false, message: "Indica il nome o la ragione sociale" };
  }
  if (dati.incassata && !dati.contoId) return { ok: false, message: "Scegli il conto" };

  let id: string;
  try {
    const db = getDb();
    ({ id } = await creaFatturaLibera(db, {
      ragioneSocialeId: dati.ragioneSocialeId,
      clienteRefId: dati.modo === "twenty" ? dati.clienteRefId : null,
      occasionale:
        dati.modo === "twenty" || !dati.nome
          ? null
          : {
              nome: dati.nome,
              partitaIva: dati.partitaIva,
              codiceFiscale: dati.codiceFiscale,
              indirizzo: dati.indirizzo,
              sdiPec: dati.sdiPec,
              privato: dati.modo === "privato",
            },
      note: dati.note,
      righe,
    }));
    await audit(db, {
      userId: user.id,
      azione: "fattura.creata",
      entita: "fatture",
      entitaId: id,
      dettagli: { origine: "libera" },
    });
    if (dati.azione === "emetti") {
      const { numero } = await emettiFattura(
        db,
        id,
        dati.giorniScadenza,
        dati.dataEmissione || undefined,
      );
      await audit(db, {
        userId: user.id,
        azione: "fattura.emessa",
        entita: "fatture",
        entitaId: id,
        dettagli: { numero },
      });
      if (dati.incassata && dati.contoId) {
        const [f] = await db.select().from(fatture).where(eq(fatture.id, id));
        await registraIncasso(db, {
          contoId: dati.contoId,
          data: dati.dataIncasso || dati.dataEmissione || oggi(),
          importoCent: f?.nettoDaPagareCent ?? 0,
          fatturaId: id,
          descrizione: `Incasso fattura ${numero} · ${dati.metodo}`,
        });
      }
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Salvataggio non riuscito" };
  }
  revalidatePath("/", "layout");
  redirect(`/fatture/${id}`);
}

const schemaDate = z.object({
  id: z.uuid(),
  dataEmissione: z.string().regex(reData, "Data non valida"),
  scadenza: z.string().regex(reData, "Data non valida"),
});

export async function modificaDateFatturaAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(schemaDate, form);
  if (!r.ok) return r.state;
  try {
    const db = getDb();
    await modificaDateFattura(db, r.data.id, r.data);
    await audit(db, {
      userId: user.id,
      azione: "fattura.date_modificate",
      entita: "fatture",
      entitaId: r.data.id,
      dettagli: { dataEmissione: r.data.dataEmissione, scadenza: r.data.scadenza },
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Modifica non riuscita" };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Date aggiornate" };
}

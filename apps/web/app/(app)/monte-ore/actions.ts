"use server";

import { leggiDurata, monteOreDatiSchema, parseEuro } from "@telaio/core";
import {
  cambiaStatoMonteOre,
  creaMonteOre,
  eliminaMonteOre,
  getDb,
  modificaMonteOre,
} from "@telaio/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import { oggi } from "@/lib/date";
import { fatturaOreExtra } from "@/lib/dominio/ore";
import { requireSession } from "@/lib/session";

const errore = (e: unknown, predefinito: string): ActionState => ({
  ok: false,
  message: e instanceof Error ? e.message : predefinito,
});

const testo = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

/** Dai campi del form (ore scritte a mano, euro con la virgola) ai dati del contratto, già convalidati. */
function leggiDati(form: FormData) {
  const errori: Record<string, string> = {};
  const ore = leggiDurata(testo(form, "oreIncluse"));
  if (ore === null) errori.oreIncluse = "Ore non valide: scrivi 10, 10:30 o 600m";
  const euro = (k: string) => {
    const v = testo(form, k);
    if (v === "") return 0;
    const c = parseEuro(v);
    if (c === null || c < 0) errori[k] = "Importo non valido";
    return c ?? 0;
  };
  const tariffaOrariaCent = euro("tariffaOraria");
  const tariffaExtraCent = euro("tariffaExtra");
  const r = monteOreDatiSchema.safeParse({
    nome: testo(form, "nome"),
    minutiIncluse: ore ?? 0,
    tariffaOrariaCent,
    tariffaExtraCent,
    arrotondamentoMinuti: testo(form, "arrotondamentoMinuti") || undefined,
    dataInizio: testo(form, "dataInizio"),
    dataFine: testo(form, "dataFine"),
  });
  if (!r.success)
    for (const i of r.error.issues) {
      const k = i.path[0] === "minutiIncluse" ? "oreIncluse" : String(i.path[0]);
      errori[k] ??= i.message;
    }
  if (Object.keys(errori).length > 0)
    return {
      ok: false as const,
      state: { ok: false, errors: errori, message: "Controlla i campi evidenziati" } as ActionState,
    };
  return { ok: true as const, dati: (r as { data: z.infer<typeof monteOreDatiSchema> }).data };
}

const ricarica = () => revalidatePath("/", "layout");

export async function creaMonteOreAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const clienteRefId = z.uuid().safeParse(form.get("clienteRefId"));
  if (!clienteRefId.success)
    return {
      ok: false,
      errors: { clienteRefId: "Scegli il cliente" },
      message: "Scegli il cliente",
    };
  const emittente = z.uuid().safeParse(form.get("ragioneSocialeId"));
  if (!emittente.success)
    return {
      ok: false,
      errors: { ragioneSocialeId: "Scegli chi emette le fatture" },
      message: "Scegli chi emette le fatture",
    };
  const l = leggiDati(form);
  if (!l.ok) return l.state;
  let id: string;
  try {
    const db = getDb();
    ({ id } = await creaMonteOre(db, {
      clienteRefId: clienteRefId.data,
      ragioneSocialeId: emittente.data,
      dati: l.dati,
    }));
    await audit(db, {
      userId: user.id,
      azione: "monte_ore.creato",
      entita: "monte_ore",
      entitaId: id,
      dettagli: { nome: l.dati.nome, minutiIncluse: l.dati.minutiIncluse },
    });
  } catch (e) {
    return errore(e, "Contratto non creato");
  }
  ricarica();
  redirect(`/monte-ore/${id}`);
}

export async function modificaMonteOreAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { ok: false, message: "Identificativo non valido" };
  const l = leggiDati(form);
  if (!l.ok) return l.state;
  try {
    const db = getDb();
    const emittente = z.uuid().safeParse(form.get("ragioneSocialeId"));
    await modificaMonteOre(db, id.data, {
      ...l.dati,
      ...(emittente.success && { ragioneSocialeId: emittente.data }),
    });
    await audit(db, {
      userId: user.id,
      azione: "monte_ore.modificato",
      entita: "monte_ore",
      entitaId: id.data,
    });
  } catch (e) {
    return errore(e, "Contratto non modificato");
  }
  ricarica();
  return { ok: true, message: "Contratto aggiornato" };
}

export async function cambiaStatoMonteOreAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { user } = await requireSession();
  const r = z
    .object({ id: z.uuid(), stato: z.enum(["attivo", "concluso"]) })
    .safeParse({ id: form.get("id"), stato: form.get("stato") });
  if (!r.success) return { ok: false, message: "Richiesta non valida" };
  try {
    const db = getDb();
    await cambiaStatoMonteOre(db, r.data.id, r.data.stato);
    await audit(db, {
      userId: user.id,
      azione: "monte_ore.stato",
      entita: "monte_ore",
      entitaId: r.data.id,
      dettagli: { stato: r.data.stato },
    });
  } catch (e) {
    return errore(e, "Stato non cambiato");
  }
  ricarica();
  return {
    ok: true,
    message: r.data.stato === "concluso" ? "Contratto concluso" : "Contratto riaperto",
  };
}

export async function eliminaMonteOreAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { ok: false, message: "Identificativo non valido" };
  try {
    const db = getDb();
    await eliminaMonteOre(db, id.data);
    await audit(db, {
      userId: user.id,
      azione: "monte_ore.eliminato",
      entita: "monte_ore",
      entitaId: id.data,
    });
  } catch (e) {
    return errore(e, "Contratto non eliminato");
  }
  ricarica();
  redirect("/monte-ore");
}

/** Crea la bozza di fattura con le ore extra di un periodo e ci porta sopra. */
export async function fatturaOreExtraAction(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = z
    .object({ id: z.uuid(), ciclo: z.coerce.number().int().min(0) })
    .safeParse({ id: form.get("id"), ciclo: form.get("ciclo") });
  if (!r.success) return { ok: false, message: "Richiesta non valida" };
  let fatturaId: string;
  try {
    const db = getDb();
    const f = await fatturaOreExtra(db, r.data.id, r.data.ciclo, oggi());
    fatturaId = f.fatturaId;
    await audit(db, {
      userId: user.id,
      azione: "monte_ore.extra_fatturate",
      entita: "monte_ore",
      entitaId: r.data.id,
      dettagli: { ciclo: r.data.ciclo, minuti: f.minuti, importoCent: f.importoCent, fatturaId },
    });
  } catch (e) {
    return errore(e, "Fattura non creata");
  }
  ricarica();
  redirect(`/fatture/${fatturaId}`);
}

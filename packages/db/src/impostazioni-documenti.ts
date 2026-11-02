import {
  decodificaLogo,
  EMAIL_PREDEFINITE,
  type EmailImpostazioni,
  emailImpostazioniSchema,
  MODELLO_PDF_PREDEFINITO,
  type ModelloPdf,
  mittenteSchema,
  modelloPdfSchema,
} from "@telaio/core";
import { eq, sql } from "drizzle-orm";
import type { Database } from "./client";
import { impostazioni } from "./schema";

/**
 * Impostazioni di email e di PDF, nella tabella chiave/valore `impostazioni`:
 *   email         { firma, mittenti: { [ragioneSocialeId]: { nome, email, rispondiA } } }
 *   pdf.modelli   { [ragioneSocialeId]: modello del PDF }
 * Le credenziali SMTP non stanno qui: restano nelle variabili d'ambiente.
 */
export const CHIAVE_EMAIL = "email";
export const CHIAVE_MODELLI_PDF = "pdf.modelli";

async function leggi(db: Pick<Database, "select">, chiave: string): Promise<unknown> {
  const [riga] = await db.select().from(impostazioni).where(eq(impostazioni.chiave, chiave));
  return riga?.valore;
}

/** Legge, modifica e riscrive una chiave sotto un blocco: due salvataggi insieme non si sovrascrivono. */
async function modifica(db: Database, chiave: string, f: (attuale: unknown) => unknown) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`impostazioni:${chiave}`}))`);
    const nuovo = f(await leggi(tx, chiave));
    await tx
      .insert(impostazioni)
      .values({ chiave, valore: nuovo })
      .onConflictDoUpdate({
        target: impostazioni.chiave,
        set: { valore: nuovo, updatedAt: new Date() },
      });
  });
}

// ── Email ────────────────────────────────────────────────────────────────────────────────────

export async function leggiEmail(db: Pick<Database, "select">): Promise<EmailImpostazioni> {
  const r = emailImpostazioniSchema.safeParse(await leggi(db, CHIAVE_EMAIL));
  return r.success ? r.data : EMAIL_PREDEFINITE;
}

export async function salvaFirmaEmail(db: Database, firma: string) {
  const f = emailImpostazioniSchema.shape.firma.parse(firma);
  await modifica(db, CHIAVE_EMAIL, (a) => {
    const attuale = emailImpostazioniSchema.safeParse(a);
    return { ...(attuale.success ? attuale.data : EMAIL_PREDEFINITE), firma: f };
  });
}

export async function salvaMittente(
  db: Database,
  ragioneSocialeId: string,
  mittente: { nome?: string; email?: string; rispondiA?: string },
) {
  const m = mittenteSchema.parse(mittente);
  await modifica(db, CHIAVE_EMAIL, (a) => {
    const attuale = emailImpostazioniSchema.safeParse(a);
    const base = attuale.success ? attuale.data : EMAIL_PREDEFINITE;
    return { ...base, mittenti: { ...base.mittenti, [ragioneSocialeId]: m } };
  });
}

// ── Modelli PDF ──────────────────────────────────────────────────────────────────────────────

/** Modelli salvati, per ragione sociale, così come sono (senza il logo di ripiego). */
export async function leggiModelliPdfSalvati(
  db: Pick<Database, "select">,
): Promise<Record<string, ModelloPdf>> {
  const grezzo = await leggi(db, CHIAVE_MODELLI_PDF);
  const out: Record<string, ModelloPdf> = {};
  if (grezzo && typeof grezzo === "object")
    for (const [id, v] of Object.entries(grezzo as Record<string, unknown>)) {
      const r = modelloPdfSchema.safeParse(v);
      if (r.success) out[id] = r.data;
    }
  return out;
}

/**
 * Il modello da usare per i documenti di una ragione sociale. Senza un logo proprio si usa quello
 * caricato nella configurazione iniziale, se è PNG o JPEG (il PDF non legge il WebP).
 */
export async function leggiModelloPdf(
  db: Pick<Database, "select">,
  ragioneSocialeId: string,
): Promise<ModelloPdf> {
  const salvati = await leggiModelliPdfSalvati(db);
  const modello = salvati[ragioneSocialeId] ?? MODELLO_PDF_PREDEFINITO;
  if (modello.logo) return modello;
  const aziendaLogo = (await leggi(db, "azienda.logo")) as { dataUrl?: string } | undefined;
  return aziendaLogo?.dataUrl && decodificaLogo(aziendaLogo.dataUrl)
    ? { ...modello, logo: aziendaLogo.dataUrl }
    : modello;
}

export async function salvaModelloPdf(db: Database, ragioneSocialeId: string, modello: unknown) {
  const m = modelloPdfSchema.parse(modello);
  await modifica(db, CHIAVE_MODELLI_PDF, (a) => ({
    ...(a && typeof a === "object" ? (a as Record<string, unknown>) : {}),
    [ragioneSocialeId]: m,
  }));
}

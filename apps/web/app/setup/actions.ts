"use server";

import {
  adminSchema,
  anagraficaAdminSchema,
  aziendaSchema,
  erroriPerCampo,
  PASSWORD_MINIMA_BASE,
  preferenzeSchema,
  sicurezzaSchema,
} from "@telaio/core";
import {
  BozzaIncompleta,
  getDb,
  InstallazioneNonVuota,
  inizializza,
  leggiBozza,
  SetupGiaCompletato,
  salvaBozza,
} from "@telaio/db";
import { hashPassword } from "better-auth/crypto";
import { redirect } from "next/navigation";
import {
  accessoConsentito,
  codiceCorretto,
  concediAccesso,
  origineFidata,
  setupCompletato,
} from "@/lib/setup-server";

/** Esito di ogni passo. Mai dettagli interni: gli errori veri vanno nel log del server. */
export type EsitoSetup =
  | { ok: true }
  | { ok: false; errori?: Record<string, string>; messaggio?: string; completato?: boolean };

/** Controlli comuni a ogni azione: origine fidata, accesso al wizard, setup non ancora completato. */
async function guardia(): Promise<EsitoSetup | null> {
  if (!(await origineFidata())) return { ok: false, messaggio: "Richiesta non valida." };
  if (!(await accessoConsentito()))
    return { ok: false, messaggio: "Accesso non autorizzato: inserisci il codice di setup." };
  try {
    if (await setupCompletato())
      return {
        ok: false,
        completato: true,
        messaggio: "La configurazione è già stata completata.",
      };
  } catch (e) {
    console.error("[setup] stato non leggibile", e);
    return { ok: false, messaggio: "Database non raggiungibile. Riprova tra poco." };
  }
  return null;
}

const erroreGenerico: EsitoSetup = {
  ok: false,
  messaggio: "Qualcosa è andato storto. Riprova; se continua, controlla i log del server.",
};

export async function verificaCodice(codice: string): Promise<EsitoSetup> {
  if (!(await origineFidata())) return { ok: false, messaggio: "Richiesta non valida." };
  if (typeof codice !== "string" || codice.length > 200)
    return { ok: false, messaggio: "Codice non valido." };
  if (!codiceCorretto(codice)) {
    // Rallenta i tentativi ripetuti. Il codice è lungo e casuale: la forza bruta non è praticabile.
    await new Promise((r) => setTimeout(r, 600));
    return { ok: false, messaggio: "Codice non corretto." };
  }
  await concediAccesso();
  return { ok: true };
}

/** Primo passo: i controlli sono passati, si va avanti. */
export async function iniziaSetup(): Promise<EsitoSetup> {
  const g = await guardia();
  if (g) return g;
  try {
    await salvaBozza(getDb(), { passo: 2 });
    return { ok: true };
  } catch (e) {
    return gestisciErrore(e);
  }
}

export async function salvaAzienda(dati: unknown): Promise<EsitoSetup> {
  const g = await guardia();
  if (g) return g;
  const r = aziendaSchema.safeParse(dati);
  if (!r.success) return { ok: false, errori: erroriPerCampo(r.error) };
  try {
    await salvaBozza(getDb(), { azienda: r.data, passo: 3 });
    return { ok: true };
  } catch (e) {
    return gestisciErrore(e);
  }
}

export async function salvaAdmin(dati: unknown): Promise<EsitoSetup> {
  const g = await guardia();
  if (g) return g;
  try {
    const db = getDb();
    const bozza = await leggiBozza(db);
    const d = (dati ?? {}) as Record<string, unknown>;
    // Password lasciata vuota con una già impostata: si mantiene quella (la bozza ha solo l'hash).
    const mantieni = !!bozza.admin && !d.password && !d.conferma;
    let anagrafica: { nome: string; cognome: string; email: string };
    let credenziali: { passwordHash: string; lunghezzaPassword: number };
    if (mantieni && bozza.admin) {
      const r = anagraficaAdminSchema.safeParse(d);
      if (!r.success) return { ok: false, errori: erroriPerCampo(r.error) };
      anagrafica = r.data;
      credenziali = {
        passwordHash: bozza.admin.passwordHash,
        lunghezzaPassword: bozza.admin.lunghezzaPassword,
      };
    } else {
      const r = adminSchema().safeParse(d);
      if (!r.success) return { ok: false, errori: erroriPerCampo(r.error) };
      const { password, conferma: _, ...resto } = r.data;
      anagrafica = resto;
      credenziali = {
        passwordHash: await hashPassword(password),
        lunghezzaPassword: password.length,
      };
    }
    await salvaBozza(db, { admin: { ...anagrafica, ...credenziali }, passo: 4 });
    return { ok: true };
  } catch (e) {
    return gestisciErrore(e);
  }
}

export async function salvaSicurezza(dati: unknown): Promise<EsitoSetup> {
  const g = await guardia();
  if (g) return g;
  const r = sicurezzaSchema.safeParse(dati);
  if (!r.success) return { ok: false, errori: erroriPerCampo(r.error) };
  try {
    const bozza = await leggiBozza(getDb());
    if (!bozza.admin) return { ok: false, messaggio: "Prima crea l'amministratore." };
    if (bozza.admin.lunghezzaPassword < Math.max(r.data.passwordMinima, PASSWORD_MINIMA_BASE))
      return {
        ok: false,
        errori: {
          passwordMinima: `La password scelta ha ${bozza.admin.lunghezzaPassword} caratteri: scegli un minimo più basso o torna indietro e cambiala.`,
        },
      };
    await salvaBozza(getDb(), { sicurezza: r.data, passo: 5 });
    return { ok: true };
  } catch (e) {
    return gestisciErrore(e);
  }
}

export async function salvaPreferenze(dati: unknown): Promise<EsitoSetup> {
  const g = await guardia();
  if (g) return g;
  const r = preferenzeSchema.safeParse(dati);
  if (!r.success) return { ok: false, errori: erroriPerCampo(r.error) };
  try {
    await salvaBozza(getDb(), { preferenze: r.data, passo: 6 });
    return { ok: true };
  } catch (e) {
    return gestisciErrore(e);
  }
}

/** Ultimo passo: legge la bozza dal database (non dal browser) e inizializza in una transazione. */
export async function completaSetup(): Promise<EsitoSetup> {
  const g = await guardia();
  if (g) return g;
  let guida = false;
  try {
    const bozza = await leggiBozza(getDb());
    guida = bozza.sicurezza?.guidaSicurezza === true;
    await inizializza(getDb(), bozza);
  } catch (e) {
    if (e instanceof SetupGiaCompletato) redirect("/login");
    if (e instanceof InstallazioneNonVuota)
      return {
        ok: false,
        messaggio:
          "Il database contiene già degli utenti: per sicurezza il setup non crea un altro amministratore.",
      };
    if (e instanceof BozzaIncompleta)
      return {
        ok: false,
        messaggio: "Mancano dei dati: torna ai passi precedenti e controlla i campi.",
      };
    console.error("[setup] inizializzazione fallita", e);
    return {
      ok: false,
      messaggio:
        "L'inizializzazione non è riuscita e non è stato salvato nulla. I dati inseriti sono al sicuro: riprova.",
    };
  }
  redirect(`/login?setup=ok${guida ? "&dopo=sicurezza" : ""}`);
}

function gestisciErrore(e: unknown): EsitoSetup {
  if (e instanceof SetupGiaCompletato)
    return { ok: false, completato: true, messaggio: "La configurazione è già stata completata." };
  console.error("[setup]", e);
  return erroreGenerico;
}

import {
  type Azienda,
  anagraficaAdminSchema,
  aziendaSchema,
  type Preferenze,
  preferenzeSchema,
  type Sicurezza,
  sicurezzaSchema,
} from "@telaio/core";
import { eq, sql } from "drizzle-orm";
import { creaAdmin, type Scrittore } from "./admin";
import type { Database } from "./client";
import { impostazioni, ragioniSociali, users } from "./schema";

/**
 * Prima configurazione. Lo stato vive nella tabella `impostazioni` (chiave/valore), non in un
 * modello nuovo, e non dipende dagli utenti: cancellarli non riapre mai il setup.
 *
 *   setup          { setup_completed, setup_version, setup_completed_at, … }  ← scritto una volta sola
 *   setup.bozza    avanzamento del wizard (senza password in chiaro: solo l'hash di Better Auth)
 *   generali       paese, fuso orario, valuta, lingua
 *   azienda.logo   logo come data URL (facoltativo)
 *   sicurezza      lunghezza minima delle password, guida a 2FA e passkey
 */
export const SETUP_VERSION = 1;
export const CHIAVE_SETUP = "setup";
export const CHIAVE_BOZZA = "setup.bozza";
/** Numero del blocco consultivo di Postgres che serializza i setup concorrenti. */
const CHIAVE_BLOCCO = "telaio:setup";

export class SetupGiaCompletato extends Error {
  constructor() {
    super("Il setup è già stato completato");
    this.name = "SetupGiaCompletato";
  }
}
/** Esistono già utenti ma lo stato non è segnato: non si crea mai un secondo amministratore. */
export class InstallazioneNonVuota extends Error {
  constructor() {
    super("L'installazione contiene già degli utenti");
    this.name = "InstallazioneNonVuota";
  }
}
export class BozzaIncompleta extends Error {
  constructor(public readonly campi: string[]) {
    super(`Dati mancanti o non validi: ${campi.join(", ")}`);
    this.name = "BozzaIncompleta";
  }
}

export interface StatoSetup {
  completato: boolean;
  versione: number | null;
  completatoAt: string | null;
}

export interface BozzaSetup {
  /** prossimo passo da compilare (1 = benvenuto … 6 = conferma) */
  passo: number;
  azienda?: Azienda;
  admin?: {
    nome: string;
    cognome: string;
    email: string;
    passwordHash: string;
    lunghezzaPassword: number;
  };
  sicurezza?: Sicurezza;
  preferenze?: Preferenze;
}

/** Quello che si può mostrare al browser: mai l'hash della password. */
export interface BozzaPubblica extends Omit<BozzaSetup, "admin"> {
  admin?: { nome: string; cognome: string; email: string; passwordImpostata: true };
}

export async function leggiStatoSetup(db: Pick<Database, "select">): Promise<StatoSetup> {
  const [riga] = await db.select().from(impostazioni).where(eq(impostazioni.chiave, CHIAVE_SETUP));
  const v = riga?.valore as
    | { setup_completed?: boolean; setup_version?: number; setup_completed_at?: string }
    | undefined;
  return {
    completato: v?.setup_completed === true,
    versione: v?.setup_version ?? null,
    completatoAt: v?.setup_completed_at ?? null,
  };
}

export async function leggiBozza(db: Pick<Database, "select">): Promise<BozzaSetup> {
  const [riga] = await db.select().from(impostazioni).where(eq(impostazioni.chiave, CHIAVE_BOZZA));
  return { passo: 1, ...((riga?.valore as Partial<BozzaSetup> | undefined) ?? {}) };
}

export function bozzaPubblica(bozza: BozzaSetup): BozzaPubblica {
  const { admin, ...resto } = bozza;
  return admin
    ? {
        ...resto,
        admin: {
          nome: admin.nome,
          cognome: admin.cognome,
          email: admin.email,
          passwordImpostata: true,
        },
      }
    : resto;
}

/**
 * Aggiorna la bozza (unisce le chiavi di primo livello). Si rifiuta se il setup è già completato:
 * la verifica e la scrittura avvengono nella stessa transazione, sotto lo stesso blocco di `inizializza`.
 */
export async function salvaBozza(db: Database, patch: Partial<BozzaSetup>): Promise<BozzaSetup> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${CHIAVE_BLOCCO}))`);
    if ((await leggiStatoSetup(tx)).completato) throw new SetupGiaCompletato();
    const attuale = await leggiBozza(tx);
    const nuova: BozzaSetup = {
      ...attuale,
      ...patch,
      passo: Math.max(attuale.passo, patch.passo ?? 1),
    };
    await tx
      .insert(impostazioni)
      .values({ chiave: CHIAVE_BOZZA, valore: nuova })
      .onConflictDoUpdate({
        target: impostazioni.chiave,
        set: { valore: nuova, updatedAt: new Date() },
      });
    return nuova;
  });
}

/** Segna l'installazione come configurata senza passare dal wizard (sviluppo, migrazioni). Idempotente. */
export async function marcaSetupCompletato(db: Pick<Database, "insert">, origine: string) {
  await db
    .insert(impostazioni)
    .values({
      chiave: CHIAVE_SETUP,
      valore: {
        setup_completed: true,
        setup_version: SETUP_VERSION,
        setup_completed_at: new Date().toISOString(),
        origine,
      },
    })
    .onConflictDoNothing();
}

/**
 * Inizializza l'installazione con i dati della bozza, in una sola transazione:
 * azienda, primo amministratore, impostazioni e stato `setup`. O succede tutto o niente.
 * Concorrenza: un blocco consultivo serializza le chiamate; la seconda trova lo stato già scritto
 * e fallisce con `SetupGiaCompletato`. La chiave primaria di `impostazioni` è l'ultima barriera.
 */
export async function inizializza(db: Database, bozza: BozzaSetup): Promise<{ adminId: string }> {
  // Rivalidazione lato server: la bozza è un input come un altro.
  const azienda = aziendaSchema.safeParse(bozza.azienda);
  const sicurezza = sicurezzaSchema.safeParse(bozza.sicurezza);
  const preferenze = preferenzeSchema.safeParse(bozza.preferenze);
  const a = bozza.admin;
  const adminOk =
    !!a &&
    anagraficaAdminSchema.safeParse(a).success &&
    typeof a.passwordHash === "string" &&
    a.passwordHash.length > 20;
  const mancanti = [
    !azienda.success && "azienda",
    !adminOk && "amministratore",
    !sicurezza.success && "sicurezza",
    !preferenze.success && "preferenze",
  ].filter((x): x is string => !!x);
  if (!azienda.success || !adminOk || !a || !sicurezza.success || !preferenze.success)
    throw new BozzaIncompleta(mancanti);
  if (a.lunghezzaPassword < sicurezza.data.passwordMinima) throw new BozzaIncompleta(["password"]);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${CHIAVE_BLOCCO}))`);
    if ((await leggiStatoSetup(tx)).completato) throw new SetupGiaCompletato();
    // Rete di sicurezza: con utenti già presenti non si crea mai un altro amministratore.
    const [utente] = await tx.select({ id: users.id }).from(users).limit(1);
    if (utente) throw new InstallazioneNonVuota();

    await tx.insert(ragioniSociali).values({
      nome: azienda.data.nome,
      tipo: azienda.data.tipo,
      partitaIva: azienda.data.partitaIva,
      ivaAttiva: preferenze.data.ivaAttiva,
      aliquotaIvaBp: preferenze.data.ivaAttiva ? Math.round(preferenze.data.aliquotaIva * 100) : 0,
      formatoPreventivo: preferenze.data.formatoPreventivo,
      formatoFattura: preferenze.data.formatoFattura,
    });

    const adminId = await creaAdmin(tx as Scrittore, {
      email: a.email,
      name: `${a.nome} ${a.cognome}`.trim(),
      passwordHash: a.passwordHash,
    });
    if (!adminId) throw new InstallazioneNonVuota();

    const valori: { chiave: string; valore: unknown }[] = [
      {
        chiave: "generali",
        valore: {
          paese: azienda.data.paese,
          fusoOrario: azienda.data.fusoOrario,
          valuta: azienda.data.valuta,
          lingua: azienda.data.lingua,
        },
      },
      { chiave: "sicurezza", valore: sicurezza.data },
    ];
    if (azienda.data.logo)
      valori.push({ chiave: "azienda.logo", valore: { dataUrl: azienda.data.logo } });
    await tx.insert(impostazioni).values(valori);

    await tx.insert(impostazioni).values({
      chiave: CHIAVE_SETUP,
      valore: {
        setup_completed: true,
        setup_version: SETUP_VERSION,
        setup_completed_at: new Date().toISOString(),
        origine: "wizard",
        admin_id: adminId,
      },
    });
    await tx.delete(impostazioni).where(eq(impostazioni.chiave, CHIAVE_BOZZA));
    return { adminId };
  });
}

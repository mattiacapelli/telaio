import {
  dateEffettiveDaStato,
  type ProgettoDati,
  progettoDatiSchema,
  type RisorsaDati,
  risorsaSchema,
  type StatoProgetto,
  staAccettato,
} from "@telaio/core";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "./client";
import {
  preventivi,
  preventivoRighe,
  progetti,
  progettiNumerazione,
  progettoRisorse,
  users,
} from "./schema";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const oggiIso = () => new Date().toISOString().slice(0, 10);

/** Codice progressivo per anno, assegnato nella stessa transazione del progetto: niente buchi. */
async function assegnaCodice(tx: Tx, anno: number): Promise<string> {
  const [riga] = await tx
    .insert(progettiNumerazione)
    .values({ anno, ultimo: 1 })
    .onConflictDoUpdate({
      target: progettiNumerazione.anno,
      set: { ultimo: sql`${progettiNumerazione.ultimo} + 1` },
    })
    .returning({ ultimo: progettiNumerazione.ultimo });
  if (!riga) throw new Error("Assegnazione del codice progetto fallita");
  return `PRJ-${anno}-${String(riga.ultimo).padStart(3, "0")}`;
}

async function verificaResponsabile(tx: Tx, id: string | null) {
  if (!id) return;
  const [u] = await tx.select({ id: users.id }).from(users).where(eq(users.id, id));
  if (!u) throw new Error("Il responsabile scelto non esiste");
}

/**
 * Un preventivo si collega a un progetto solo se è accettato, anche parzialmente, e ha almeno una
 * prestazione accettata (una tantum o un abbonamento). Le righe escluse non contano. Blocca la riga
 * del preventivo per la durata della transazione, così un cambio di stato concorrente non passa
 * inosservato.
 */
async function verificaPreventivo(
  tx: Tx,
  preventivoId: string,
): Promise<{ clienteRefId: string | null; oggetto: string }> {
  const [p] = await tx
    .select({
      stato: preventivi.stato,
      clienteRefId: preventivi.clienteRefId,
      oggetto: preventivi.oggetto,
    })
    .from(preventivi)
    .where(and(eq(preventivi.id, preventivoId), isNull(preventivi.deletedAt)))
    .for("update");
  if (!p) throw new Error("Preventivo non trovato");
  if (!staAccettato(p.stato))
    throw new Error(
      "Si può creare un progetto solo da un preventivo accettato, anche parzialmente",
    );
  const [accettate] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(preventivoRighe)
    .where(
      and(eq(preventivoRighe.preventivoId, preventivoId), eq(preventivoRighe.accettata, true)),
    );
  if (!accettate?.n)
    throw new Error(
      "Nessuna prestazione accettata: da questo preventivo non si può creare un progetto",
    );
  return { clienteRefId: p.clienteRefId, oggetto: p.oggetto };
}

export interface NuovoProgetto {
  dati: ProgettoDati | unknown;
  clienteRefId?: string | null;
  preventivoId?: string | null;
}

/**
 * Crea un progetto, a mano o da un preventivo accettato. Con un preventivo: se il cliente non è
 * indicato eredita quello del preventivo. Dallo stesso preventivo si possono creare più progetti.
 */
export async function creaProgetto(
  db: Database,
  input: NuovoProgetto,
): Promise<{ id: string; codice: string }> {
  const dati = progettoDatiSchema.parse(input.dati);
  return db.transaction(async (tx) => {
    let clienteRefId = input.clienteRefId ?? null;
    if (input.preventivoId) {
      const p = await verificaPreventivo(tx, input.preventivoId);
      clienteRefId ??= p.clienteRefId;
    }
    await verificaResponsabile(tx, dati.responsabileId);
    const effettive = dateEffettiveDaStato(
      dati.stato,
      { dataInizioEffettiva: null, dataFineEffettiva: null },
      oggiIso(),
    );
    const codice = await assegnaCodice(tx, new Date().getFullYear());
    const [creato] = await tx
      .insert(progetti)
      .values({
        codice,
        ...dati,
        ...effettive,
        clienteRefId,
        preventivoId: input.preventivoId ?? null,
      })
      .returning({ id: progetti.id, codice: progetti.codice });
    if (!creato) throw new Error("Creazione del progetto non riuscita");
    return creato;
  });
}

/**
 * Crea un progetto da un preventivo accettato. Il nome predefinito è l'oggetto del preventivo.
 * Non è idempotente per scelta: un preventivo con più lavori genera più progetti. Contro il doppio
 * clic accidentale c'è il pulsante disattivato durante l'invio.
 */
export async function creaProgettoDaPreventivo(
  db: Database,
  opzioni: {
    preventivoId: string;
    dati: Partial<{ nome: string; categoria: string }>;
  },
): Promise<{ id: string; codice: string }> {
  const [p] = await db
    .select({ oggetto: preventivi.oggetto })
    .from(preventivi)
    .where(and(eq(preventivi.id, opzioni.preventivoId), isNull(preventivi.deletedAt)));
  if (!p) throw new Error("Preventivo non trovato");
  return creaProgetto(db, {
    preventivoId: opzioni.preventivoId,
    dati: { nome: opzioni.dati.nome || p.oggetto, categoria: opzioni.dati.categoria },
  });
}

/** Progetti nati da un preventivo, dal più vecchio al più recente. */
export async function progettiDelPreventivo(
  db: Database,
  preventivoId: string,
): Promise<{ id: string; codice: string; nome: string; stato: StatoProgetto }[]> {
  return db
    .select({
      id: progetti.id,
      codice: progetti.codice,
      nome: progetti.nome,
      stato: progetti.stato,
    })
    .from(progetti)
    .where(and(eq(progetti.preventivoId, preventivoId), isNull(progetti.deletedAt)))
    .orderBy(asc(progetti.createdAt));
}

export interface EsitoModifica {
  codice: string;
  cambioStato: { da: StatoProgetto; a: StatoProgetto } | null;
}

/** Modifica i dati del progetto; cliente e preventivo si cambiano solo se passati (`undefined` = invariati). */
export async function modificaProgetto(
  db: Database,
  id: string,
  input: NuovoProgetto,
): Promise<EsitoModifica> {
  const dati = progettoDatiSchema.parse(input.dati);
  return db.transaction(async (tx) => {
    const [att] = await tx
      .select()
      .from(progetti)
      .where(and(eq(progetti.id, id), isNull(progetti.deletedAt)))
      .for("update");
    if (!att) throw new Error("Progetto non trovato");
    const preventivoId = input.preventivoId === undefined ? att.preventivoId : input.preventivoId;
    if (preventivoId && preventivoId !== att.preventivoId)
      await verificaPreventivo(tx, preventivoId);
    await verificaResponsabile(tx, dati.responsabileId);
    const effettive = dateEffettiveDaStato(dati.stato, att, oggiIso());
    await tx
      .update(progetti)
      .set({
        ...dati,
        ...effettive,
        clienteRefId: input.clienteRefId === undefined ? att.clienteRefId : input.clienteRefId,
        preventivoId,
      })
      .where(eq(progetti.id, id));
    return {
      codice: att.codice,
      cambioStato: att.stato === dati.stato ? null : { da: att.stato, a: dati.stato },
    };
  });
}

/** Cambia solo lo stato, aggiornando le date effettive. Ritorna `null` se lo stato è già quello. */
export async function cambiaStatoProgetto(
  db: Database,
  id: string,
  stato: StatoProgetto,
): Promise<{ da: StatoProgetto; a: StatoProgetto } | null> {
  return db.transaction(async (tx) => {
    const [att] = await tx
      .select()
      .from(progetti)
      .where(and(eq(progetti.id, id), isNull(progetti.deletedAt)))
      .for("update");
    if (!att) throw new Error("Progetto non trovato");
    if (att.stato === stato) return null;
    await tx
      .update(progetti)
      .set({ stato, ...dateEffettiveDaStato(stato, att, oggiIso()) })
      .where(eq(progetti.id, id));
    return { da: att.stato, a: stato };
  });
}

// ── Risorse ──────────────────────────────────────────────────────────────────────────────────

async function bloccaProgetto(tx: Tx, progettoId: string) {
  const [p] = await tx
    .select({ id: progetti.id })
    .from(progetti)
    .where(and(eq(progetti.id, progettoId), isNull(progetti.deletedAt)))
    .for("update");
  if (!p) throw new Error("Progetto non trovato");
}

const tocca = (tx: Tx, progettoId: string) =>
  tx.update(progetti).set({ updatedAt: new Date() }).where(eq(progetti.id, progettoId));

async function liberaPrincipale(tx: Tx, progettoId: string, tranne?: string) {
  await tx
    .update(progettoRisorse)
    .set({ principale: false })
    .where(
      and(
        eq(progettoRisorse.progettoId, progettoId),
        eq(progettoRisorse.principale, true),
        tranne ? ne(progettoRisorse.id, tranne) : undefined,
      ),
    );
}

export async function aggiungiRisorsa(
  db: Database,
  progettoId: string,
  input: RisorsaDati | unknown,
): Promise<{ id: string }> {
  const dati = risorsaSchema.parse(input);
  return db.transaction(async (tx) => {
    await bloccaProgetto(tx, progettoId);
    const [{ ordine } = { ordine: 0 }] = await tx
      .select({ ordine: sql<number>`coalesce(max(${progettoRisorse.ordine}), -1) + 1` })
      .from(progettoRisorse)
      .where(eq(progettoRisorse.progettoId, progettoId));
    if (dati.principale) await liberaPrincipale(tx, progettoId);
    const [r] = await tx
      .insert(progettoRisorse)
      .values({ ...dati, progettoId, ordine })
      .returning({ id: progettoRisorse.id });
    if (!r) throw new Error("Creazione della risorsa non riuscita");
    await tocca(tx, progettoId);
    return r;
  });
}

export async function modificaRisorsa(
  db: Database,
  risorsaId: string,
  input: RisorsaDati | unknown,
): Promise<{ progettoId: string }> {
  const dati = risorsaSchema.parse(input);
  return db.transaction(async (tx) => {
    const [att] = await tx
      .select({ progettoId: progettoRisorse.progettoId })
      .from(progettoRisorse)
      .where(eq(progettoRisorse.id, risorsaId));
    if (!att) throw new Error("Risorsa non trovata");
    await bloccaProgetto(tx, att.progettoId);
    if (dati.principale) await liberaPrincipale(tx, att.progettoId, risorsaId);
    await tx.update(progettoRisorse).set(dati).where(eq(progettoRisorse.id, risorsaId));
    await tocca(tx, att.progettoId);
    return att;
  });
}

/** Le risorse non hanno soft delete: sono semplici collegamenti, e l'audit conserva chi li ha tolti. */
export async function eliminaRisorsa(
  db: Database,
  risorsaId: string,
): Promise<{ progettoId: string; titolo: string }> {
  return db.transaction(async (tx) => {
    const [att] = await tx
      .select({ progettoId: progettoRisorse.progettoId, titolo: progettoRisorse.titolo })
      .from(progettoRisorse)
      .where(eq(progettoRisorse.id, risorsaId));
    if (!att) throw new Error("Risorsa non trovata");
    await bloccaProgetto(tx, att.progettoId);
    await tx.delete(progettoRisorse).where(eq(progettoRisorse.id, risorsaId));
    await tocca(tx, att.progettoId);
    return att;
  });
}

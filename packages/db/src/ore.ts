import {
  arrotondaMinuti,
  MAX_MINUTI_VOCE,
  type MonteOreDati,
  monteOreDatiSchema,
  type SaldoCiclo,
  type StatoMonteOre,
  storicoMonteOre,
} from "@telaio/core";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Database } from "./client";
import {
  clientiRef,
  fatture,
  monteOre,
  monteOreExtra,
  progetti,
  ragioniSociali,
  ticket,
  vociTempo,
} from "./schema";

/**
 * Contratti a ore e tempo lavorato. Le regole di calcolo (arrotondamento, periodi, saldo) stanno in
 * `@telaio/core/ore`; qui c'è solo la parte che parla con il database.
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

// ── Contratti a ore ────────────────────────────────────────────────────────────────────────────

async function verificaEmittente(db: Database | Tx, id: string) {
  const [rs] = await db
    .select({ id: ragioniSociali.id })
    .from(ragioniSociali)
    .where(and(eq(ragioniSociali.id, id), isNull(ragioniSociali.deletedAt)));
  if (!rs) throw new Error("Ragione sociale non trovata");
}

export async function creaMonteOre(
  db: Database,
  input: {
    clienteRefId: string;
    ragioneSocialeId: string;
    preventivoId?: string | null;
    dati: unknown;
  },
): Promise<{ id: string }> {
  const dati = monteOreDatiSchema.parse(input.dati);
  await verificaEmittente(db, input.ragioneSocialeId);
  const [c] = await db
    .select({ id: clientiRef.id })
    .from(clientiRef)
    .where(eq(clientiRef.id, input.clienteRefId));
  if (!c) throw new Error("Cliente non trovato");
  const [r] = await db
    .insert(monteOre)
    .values({
      clienteRefId: c.id,
      ragioneSocialeId: input.ragioneSocialeId,
      preventivoId: input.preventivoId ?? null,
      ...dati,
    })
    .returning({ id: monteOre.id });
  if (!r) throw new Error("Contratto non creato");
  return r;
}

/** Modifica parziale: i campi non indicati restano. Le voci già registrate devono restare dentro le date. */
export async function modificaMonteOre(
  db: Database,
  id: string,
  campi: Partial<Record<keyof MonteOreDati, unknown>> & {
    preventivoId?: string | null;
    ragioneSocialeId?: string;
  },
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [m] = await tx
      .select()
      .from(monteOre)
      .where(and(eq(monteOre.id, id), isNull(monteOre.deletedAt)))
      .for("update");
    if (!m) throw new Error("Contratto non trovato");
    const { preventivoId, ragioneSocialeId, ...resto } = campi;
    if (ragioneSocialeId) await verificaEmittente(tx, ragioneSocialeId);
    const dati = monteOreDatiSchema.parse({
      nome: m.nome,
      minutiIncluse: m.minutiIncluse,
      tariffaOrariaCent: m.tariffaOrariaCent,
      tariffaExtraCent: m.tariffaExtraCent,
      arrotondamentoMinuti: m.arrotondamentoMinuti,
      dataInizio: m.dataInizio,
      dataFine: m.dataFine,
      ...resto,
    });
    const [fuori] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(vociTempo)
      .where(
        and(
          eq(vociTempo.monteOreId, id),
          isNull(vociTempo.deletedAt),
          sql`(${vociTempo.data} < ${dati.dataInizio} or (${dati.dataFine}::date is not null and ${vociTempo.data} > ${dati.dataFine}::date))`,
        ),
      );
    if (fuori && fuori.n > 0)
      throw new Error(`${fuori.n} voci di tempo cadrebbero fuori dalle nuove date del contratto`);
    await tx
      .update(monteOre)
      .set({
        ...dati,
        ...(preventivoId !== undefined && { preventivoId }),
        ...(ragioneSocialeId && { ragioneSocialeId }),
      })
      .where(eq(monteOre.id, id));
    // se cambia l'arrotondamento, le voci già registrate si ricalcolano: il saldo deve restare coerente
    if (dati.arrotondamentoMinuti !== m.arrotondamentoMinuti) {
      await tx
        .update(vociTempo)
        .set({
          minuti: sql`case when ${vociTempo.minutiEffettivi} <= 0 then 0
            else ceil(${vociTempo.minutiEffettivi}::numeric / ${dati.arrotondamentoMinuti}) * ${dati.arrotondamentoMinuti} end`,
        })
        .where(
          and(
            eq(vociTempo.monteOreId, id),
            isNull(vociTempo.deletedAt),
            isNull(vociTempo.avviatoAt),
          ),
        );
    }
    return { id };
  });
}

export async function cambiaStatoMonteOre(db: Database, id: string, stato: StatoMonteOre) {
  const [r] = await db
    .update(monteOre)
    .set({ stato })
    .where(and(eq(monteOre.id, id), isNull(monteOre.deletedAt)))
    .returning({ id: monteOre.id, stato: monteOre.stato });
  if (!r) throw new Error("Contratto non trovato");
  return r;
}

/** Elimina (soft delete) solo un contratto senza tempo registrato: altrimenti si conclude. */
export async function eliminaMonteOre(db: Database, id: string) {
  return db.transaction(async (tx) => {
    const [m] = await tx
      .select({ id: monteOre.id })
      .from(monteOre)
      .where(and(eq(monteOre.id, id), isNull(monteOre.deletedAt)))
      .for("update");
    if (!m) throw new Error("Contratto non trovato");
    const [v] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(vociTempo)
      .where(and(eq(vociTempo.monteOreId, id), isNull(vociTempo.deletedAt)));
    if (v && v.n > 0)
      throw new Error(`Il contratto ha ${v.n} voci di tempo: non si elimina, si conclude`);
    await tx.update(monteOre).set({ deletedAt: new Date() }).where(eq(monteOre.id, id));
    return { id };
  });
}

/** Un periodo con le ore extra già fatturate e quelle ancora da fatturare. */
export interface SaldoCicloOre extends SaldoCiclo {
  extraFatturati: number;
  daFatturare: number;
}

export interface RiepilogoMonteOre {
  contratto: typeof monteOre.$inferSelect;
  cliente: string;
  /** il periodo di oggi (o l'ultimo se il contratto è finito); null se non è ancora iniziato */
  corrente: SaldoCicloOre | null;
  cicli: SaldoCicloOre[];
}

/** Contratti con il loro saldo, calcolato dalle voci di tempo. */
export async function riepilogoMonteOre(
  db: Database,
  oggi: string,
  filtri: { id?: string; clienteRefId?: string; stato?: StatoMonteOre } = {},
): Promise<RiepilogoMonteOre[]> {
  const contratti = await db
    .select({ m: monteOre, cliente: clientiRef.nome })
    .from(monteOre)
    .innerJoin(clientiRef, eq(clientiRef.id, monteOre.clienteRefId))
    .where(
      and(
        isNull(monteOre.deletedAt),
        filtri.id ? eq(monteOre.id, filtri.id) : undefined,
        filtri.clienteRefId ? eq(monteOre.clienteRefId, filtri.clienteRefId) : undefined,
        filtri.stato ? eq(monteOre.stato, filtri.stato) : undefined,
      ),
    )
    .orderBy(asc(monteOre.stato), desc(monteOre.dataInizio));
  if (contratti.length === 0) return [];
  const ids = contratti.map((c) => c.m.id);
  const [voci, extra] = await Promise.all([
    db
      .select({
        monteOreId: vociTempo.monteOreId,
        data: vociTempo.data,
        minuti: vociTempo.minuti,
      })
      .from(vociTempo)
      .where(
        and(
          inArray(vociTempo.monteOreId, ids),
          isNull(vociTempo.deletedAt),
          isNull(vociTempo.avviatoAt),
        ),
      ),
    // solo le ore extra di fatture non eliminate: eliminando la bozza le ore tornano da fatturare
    db
      .select({
        monteOreId: monteOreExtra.monteOreId,
        cicloN: monteOreExtra.cicloN,
        minuti: monteOreExtra.minuti,
      })
      .from(monteOreExtra)
      .innerJoin(fatture, eq(fatture.id, monteOreExtra.fatturaId))
      .where(and(inArray(monteOreExtra.monteOreId, ids), isNull(fatture.deletedAt))),
  ]);
  return contratti.map(({ m, cliente }) => {
    const sue = voci.filter((v) => v.monteOreId === m.id);
    const { corrente, cicli } = storicoMonteOre(m, sue, oggi);
    const arricchisci = (c: SaldoCiclo): SaldoCicloOre => {
      const fatturati = extra
        .filter((e) => e.monteOreId === m.id && e.cicloN === c.n)
        .reduce((t, e) => t + e.minuti, 0);
      return { ...c, extraFatturati: fatturati, daFatturare: Math.max(0, c.extra - fatturati) };
    };
    return {
      contratto: m,
      cliente,
      corrente: corrente ? arricchisci(corrente) : null,
      cicli: cicli.map(arricchisci),
    };
  });
}

/** Segna come fatturate le ore extra di un periodo (da chiamare nella stessa transazione della fattura). */
export async function registraOreExtraFatturate(
  tx: Tx | Database,
  input: { monteOreId: string; cicloN: number; minuti: number; fatturaId: string },
) {
  await tx.insert(monteOreExtra).values(input);
}

// ── Tempo ──────────────────────────────────────────────────────────────────────────────────────

export interface DatiTempo {
  /** serve se non c'è un contratto; con un contratto è quello del contratto */
  clienteRefId?: string | null;
  monteOreId?: string | null;
  progettoId?: string | null;
  ticketId?: string | null;
  data: string;
  descrizione?: string | null;
  fatturabile?: boolean;
}

/**
 * Risolve cliente, contratto, progetto e ticket di una voce e controlla che siano coerenti.
 * Con un contratto la data deve stare nelle sue date e il contratto deve essere attivo.
 */
async function risolvi(tx: Tx | Database, d: DatiTempo) {
  let clienteRefId = d.clienteRefId ?? null;
  let passo: number | null = null;
  if (d.monteOreId) {
    const [m] = await tx
      .select()
      .from(monteOre)
      .where(and(eq(monteOre.id, d.monteOreId), isNull(monteOre.deletedAt)));
    if (!m) throw new Error("Contratto non trovato");
    if (m.stato !== "attivo") throw new Error("Il contratto è concluso");
    if (clienteRefId && clienteRefId !== m.clienteRefId)
      throw new Error("Il contratto è di un altro cliente");
    if (d.data < m.dataInizio || (m.dataFine && d.data > m.dataFine))
      throw new Error("La data è fuori dal periodo del contratto");
    clienteRefId = m.clienteRefId;
    passo = m.arrotondamentoMinuti;
  }
  let progettoId = d.progettoId ?? null;
  if (d.ticketId) {
    const [t] = await tx
      .select({ progettoId: ticket.progettoId })
      .from(ticket)
      .where(and(eq(ticket.id, d.ticketId), isNull(ticket.deletedAt)));
    if (!t) throw new Error("Ticket non trovato");
    if (progettoId && progettoId !== t.progettoId)
      throw new Error("Il ticket non appartiene a quel progetto");
    progettoId = t.progettoId;
  }
  if (progettoId) {
    const [p] = await tx
      .select({ id: progetti.id, clienteRefId: progetti.clienteRefId })
      .from(progetti)
      .where(and(eq(progetti.id, progettoId), isNull(progetti.deletedAt)));
    if (!p) throw new Error("Progetto non trovato");
    if (!clienteRefId) clienteRefId = p.clienteRefId;
    else if (p.clienteRefId && p.clienteRefId !== clienteRefId)
      throw new Error("Il progetto è di un altro cliente");
  }
  if (!clienteRefId)
    throw new Error(
      progettoId
        ? "Il progetto non ha un cliente: assegnalo al progetto per registrare tempo"
        : "Scegli un cliente o un contratto",
    );
  const [c] = await tx
    .select({ id: clientiRef.id })
    .from(clientiRef)
    .where(eq(clientiRef.id, clienteRefId));
  if (!c) throw new Error("Cliente non trovato");
  return { clienteRefId, passo, progettoId, ticketId: d.ticketId ?? null };
}

function controllaMinuti(minuti: number) {
  if (!Number.isInteger(minuti) || minuti < 1)
    throw new Error("Indica una durata di almeno 1 minuto");
  if (minuti > MAX_MINUTI_VOCE) throw new Error("Una voce non può superare le 24 ore");
}

const testoOrNull = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);

/** Registra tempo già lavorato. Con un contratto la durata conta arrotondata per eccesso al suo passo. */
export async function registraTempo(
  db: Database,
  input: DatiTempo & { minuti: number },
): Promise<{ id: string; minuti: number }> {
  controllaMinuti(input.minuti);
  const r = await risolvi(db, input);
  const [v] = await db
    .insert(vociTempo)
    .values({
      clienteRefId: r.clienteRefId,
      monteOreId: input.monteOreId ?? null,
      progettoId: r.progettoId,
      ticketId: r.ticketId,
      data: input.data,
      minutiEffettivi: input.minuti,
      minuti: r.passo ? arrotondaMinuti(input.minuti, r.passo) : input.minuti,
      descrizione: testoOrNull(input.descrizione),
      fatturabile: input.fatturabile ?? true,
    })
    .returning({ id: vociTempo.id, minuti: vociTempo.minuti });
  if (!v) throw new Error("Voce non registrata");
  return v;
}

/** Modifica una voce (non un timer in corso); i campi non indicati restano. */
export async function modificaTempo(
  db: Database,
  id: string,
  campi: Partial<DatiTempo> & { minuti?: number },
): Promise<{ id: string; minuti: number }> {
  return db.transaction(async (tx) => {
    const [v] = await tx
      .select()
      .from(vociTempo)
      .where(and(eq(vociTempo.id, id), isNull(vociTempo.deletedAt)))
      .for("update");
    if (!v) throw new Error("Voce non trovata");
    if (v.avviatoAt) throw new Error("Il timer è ancora in corso: fermalo prima");
    const effettivi = campi.minuti ?? v.minutiEffettivi;
    controllaMinuti(effettivi);
    const dati: DatiTempo = {
      clienteRefId: "clienteRefId" in campi ? campi.clienteRefId : v.clienteRefId,
      monteOreId: "monteOreId" in campi ? campi.monteOreId : v.monteOreId,
      progettoId: "progettoId" in campi ? campi.progettoId : v.progettoId,
      ticketId: "ticketId" in campi ? campi.ticketId : v.ticketId,
      data: campi.data ?? v.data,
      descrizione: "descrizione" in campi ? campi.descrizione : v.descrizione,
      fatturabile: campi.fatturabile ?? v.fatturabile,
    };
    // un contratto già concluso non si può togliere né cambiare per sbaglio, ma una voce vecchia
    // legata a un contratto concluso resta modificabile nel resto: si ricontrolla solo se cambia.
    const cambiaContratto = dati.monteOreId !== v.monteOreId || dati.data !== v.data;
    const r = cambiaContratto
      ? await risolvi(tx, dati)
      : await risolvi(tx, { ...dati, monteOreId: null }).then(async (x) => {
          const [m] = dati.monteOreId
            ? await tx.select().from(monteOre).where(eq(monteOre.id, dati.monteOreId))
            : [];
          return { ...x, passo: m?.arrotondamentoMinuti ?? null };
        });
    const [n] = await tx
      .update(vociTempo)
      .set({
        clienteRefId: r.clienteRefId,
        monteOreId: dati.monteOreId ?? null,
        progettoId: r.progettoId,
        ticketId: r.ticketId,
        data: dati.data,
        minutiEffettivi: effettivi,
        minuti: r.passo ? arrotondaMinuti(effettivi, r.passo) : effettivi,
        descrizione: testoOrNull(dati.descrizione),
        fatturabile: dati.fatturabile ?? true,
      })
      .where(eq(vociTempo.id, id))
      .returning({ id: vociTempo.id, minuti: vociTempo.minuti });
    if (!n) throw new Error("Voce non modificata");
    return n;
  });
}

export async function eliminaTempo(db: Database, id: string) {
  const [r] = await db
    .update(vociTempo)
    .set({ deletedAt: new Date() })
    .where(and(eq(vociTempo.id, id), isNull(vociTempo.deletedAt)))
    .returning({ id: vociTempo.id });
  if (!r) throw new Error("Voce non trovata");
  return r;
}

/** Avvia un timer: ce n'è uno solo alla volta. `data` è il giorno di oggi (fuso di Roma). */
export async function avviaTimer(
  db: Database,
  input: Omit<DatiTempo, "fatturabile"> & { ora?: Date },
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [attivo] = await tx
      .select({ id: vociTempo.id })
      .from(vociTempo)
      .where(and(isNull(vociTempo.deletedAt), sql`${vociTempo.avviatoAt} is not null`));
    if (attivo) throw new Error("C'è già un timer in corso: fermalo o scartalo prima");
    const r = await risolvi(tx, input);
    const [v] = await tx
      .insert(vociTempo)
      .values({
        clienteRefId: r.clienteRefId,
        monteOreId: input.monteOreId ?? null,
        progettoId: r.progettoId,
        ticketId: r.ticketId,
        data: input.data,
        descrizione: testoOrNull(input.descrizione),
        avviatoAt: input.ora ?? new Date(),
      })
      .returning({ id: vociTempo.id });
    if (!v) throw new Error("Timer non avviato");
    return v;
  });
}

/** Ferma il timer in corso: i minuti sono quelli trascorsi (almeno 1), poi arrotondati col contratto. */
export async function fermaTimer(
  db: Database,
  ora = new Date(),
): Promise<{ id: string; minuti: number }> {
  return db.transaction(async (tx) => {
    const [v] = await tx
      .select()
      .from(vociTempo)
      .where(and(isNull(vociTempo.deletedAt), sql`${vociTempo.avviatoAt} is not null`))
      .for("update");
    if (!v?.avviatoAt) throw new Error("Nessun timer in corso");
    const trascorsi = Math.round((ora.getTime() - v.avviatoAt.getTime()) / 60000);
    const effettivi = Math.min(Math.max(1, trascorsi), MAX_MINUTI_VOCE);
    let passo: number | null = null;
    if (v.monteOreId) {
      const [m] = await tx.select().from(monteOre).where(eq(monteOre.id, v.monteOreId));
      passo = m?.arrotondamentoMinuti ?? null;
    }
    const minuti = passo ? arrotondaMinuti(effettivi, passo) : effettivi;
    await tx
      .update(vociTempo)
      .set({ avviatoAt: null, minutiEffettivi: effettivi, minuti })
      .where(eq(vociTempo.id, v.id));
    return { id: v.id, minuti };
  });
}

/** Butta via il timer in corso senza registrare nulla. */
export async function scartaTimer(db: Database) {
  const [r] = await db
    .update(vociTempo)
    .set({ deletedAt: new Date(), avviatoAt: null })
    .where(and(isNull(vociTempo.deletedAt), sql`${vociTempo.avviatoAt} is not null`))
    .returning({ id: vociTempo.id });
  if (!r) throw new Error("Nessun timer in corso");
  return r;
}

export interface FiltriTempo {
  clienteRefId?: string;
  monteOreId?: string;
  progettoId?: string;
  ticketId?: string;
  da?: string;
  a?: string;
  limite?: number;
}

/** Voci di tempo (senza il timer in corso), dalla più recente, con i nomi di cliente, contratto e progetto. */
export async function elencaTempo(db: Database, f: FiltriTempo = {}) {
  return db
    .select({
      v: vociTempo,
      cliente: clientiRef.nome,
      contratto: monteOre.nome,
      progetto: progetti.codice,
      ticketNumero: ticket.numero,
      ticketTitolo: ticket.titolo,
    })
    .from(vociTempo)
    .innerJoin(clientiRef, eq(clientiRef.id, vociTempo.clienteRefId))
    .leftJoin(monteOre, eq(monteOre.id, vociTempo.monteOreId))
    .leftJoin(progetti, eq(progetti.id, vociTempo.progettoId))
    .leftJoin(ticket, eq(ticket.id, vociTempo.ticketId))
    .where(
      and(
        isNull(vociTempo.deletedAt),
        isNull(vociTempo.avviatoAt),
        f.clienteRefId ? eq(vociTempo.clienteRefId, f.clienteRefId) : undefined,
        f.monteOreId ? eq(vociTempo.monteOreId, f.monteOreId) : undefined,
        f.progettoId ? eq(vociTempo.progettoId, f.progettoId) : undefined,
        f.ticketId ? eq(vociTempo.ticketId, f.ticketId) : undefined,
        f.da ? gte(vociTempo.data, f.da) : undefined,
        f.a ? lte(vociTempo.data, f.a) : undefined,
      ),
    )
    .orderBy(desc(vociTempo.data), desc(vociTempo.createdAt))
    .limit(Math.min(f.limite ?? 200, 1000));
}

/** Il timer in corso, se c'è. */
export async function timerAttivo(db: Database) {
  const [r] = await db
    .select({
      v: vociTempo,
      cliente: clientiRef.nome,
      contratto: monteOre.nome,
      ticketNumero: ticket.numero,
    })
    .from(vociTempo)
    .innerJoin(clientiRef, eq(clientiRef.id, vociTempo.clienteRefId))
    .leftJoin(monteOre, eq(monteOre.id, vociTempo.monteOreId))
    .leftJoin(ticket, eq(ticket.id, vociTempo.ticketId))
    .where(and(isNull(vociTempo.deletedAt), sql`${vociTempo.avviatoAt} is not null`));
  return r ?? null;
}

/** Minuti contati nel periodo, per le testate («oggi», «questo mese»). */
export async function minutiNelPeriodo(db: Database, da: string, a: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`coalesce(sum(${vociTempo.minuti}), 0)::int` })
    .from(vociTempo)
    .where(
      and(
        isNull(vociTempo.deletedAt),
        isNull(vociTempo.avviatoAt),
        gte(vociTempo.data, da),
        lte(vociTempo.data, a),
      ),
    );
  return r?.n ?? 0;
}

/** Cambia la descrizione del timer in corso (si può scrivere dopo averlo avviato). */
export async function aggiornaTimer(db: Database, campi: { descrizione: string | null }) {
  const [r] = await db
    .update(vociTempo)
    .set({ descrizione: testoOrNull(campi.descrizione) })
    .where(and(isNull(vociTempo.deletedAt), sql`${vociTempo.avviatoAt} is not null`))
    .returning({ id: vociTempo.id });
  if (!r) throw new Error("Nessun timer in corso");
  return r;
}

export interface TempoRecente {
  clienteRefId: string;
  cliente: string;
  monteOreId: string | null;
  contratto: string | null;
  descrizione: string | null;
}

/** Le combinazioni (cliente, contratto, descrizione) usate più di recente: avvio con un tocco. */
export async function tempoRecente(db: Database, limite = 6): Promise<TempoRecente[]> {
  const righe = await db.execute<{
    cliente_ref_id: string;
    cliente: string;
    monte_ore_id: string | null;
    contratto: string | null;
    descrizione: string | null;
  }>(sql`
    select v.cliente_ref_id, c.nome as cliente, v.monte_ore_id, m.nome as contratto, v.descrizione
    from voci_tempo v
    join clienti_ref c on c.id = v.cliente_ref_id
    left join monte_ore m on m.id = v.monte_ore_id and m.deleted_at is null
    where v.deleted_at is null and v.avviato_at is null
      and (v.monte_ore_id is null or (m.id is not null and m.stato = 'attivo'))
    group by v.cliente_ref_id, c.nome, v.monte_ore_id, m.nome, v.descrizione
    order by max(v.created_at) desc
    limit ${Math.min(Math.max(limite, 1), 20)}`);
  return [...righe].map((r) => ({
    clienteRefId: r.cliente_ref_id,
    cliente: r.cliente,
    monteOreId: r.monte_ore_id,
    contratto: r.contratto,
    descrizione: r.descrizione,
  }));
}

import { type CategoriaDocumento, documentoDatiSchema, linkDatiSchema } from "@telaio/core";
import { and, desc, eq, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import type { Database } from "./client";
import { clientiRef, preventivi, progetti, progettoDocumenti, ticket, users } from "./schema";

/**
 * Allegati: file (nel bucket S3) e link di un progetto o di un suo ticket, di un preventivo o di
 * un cliente. Un file già nell'archivio può essere allegato anche altrove senza copiarlo: gli
 * allegati puntano alla stessa chiave e l'oggetto lascia il bucket con l'ultimo che lo usa.
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** A chi è allegato: uno solo tra progetto, preventivo e cliente (`clienti_ref`). */
export type Proprietario =
  | { progettoId: string }
  | { preventivoId: string }
  | { clienteRefId: string };

type Comune = {
  ticketId?: string | null;
  categoria?: CategoriaDocumento | string;
  descrizione?: string | null;
  caricatoDaId?: string | null;
};

export type NuovoDocumento = Proprietario &
  Comune & {
    id: string;
    nome: string;
    chiave: string;
    dimensioneByte: number;
    tipoMime?: string;
  };

export type NuovoLink = Proprietario & Comune & { titolo: string; url: string };

/** Quale dei tre è indicato (con un valore): chiavi presenti ma vuote o `undefined` non contano. */
function proprietarioDi(p: Proprietario) {
  if ("progettoId" in p && p.progettoId) return { tipo: "progetto", id: p.progettoId } as const;
  if ("preventivoId" in p && p.preventivoId)
    return { tipo: "preventivo", id: p.preventivoId } as const;
  if ("clienteRefId" in p && p.clienteRefId)
    return { tipo: "cliente", id: p.clienteRefId } as const;
  throw new Error("Indica a chi allegare: un progetto, un preventivo o un cliente");
}

function colonne(p: Proprietario) {
  const o = proprietarioDi(p);
  return {
    progettoId: o.tipo === "progetto" ? o.id : null,
    preventivoId: o.tipo === "preventivo" ? o.id : null,
    clienteRefId: o.tipo === "cliente" ? o.id : null,
  };
}

function condizione(p: Proprietario): SQL {
  const o = proprietarioDi(p);
  if (o.tipo === "progetto") return eq(progettoDocumenti.progettoId, o.id);
  if (o.tipo === "preventivo") return eq(progettoDocumenti.preventivoId, o.id);
  return eq(progettoDocumenti.clienteRefId, o.id);
}

/** Il proprietario esiste (e non è eliminato); il ticket, se c'è, è del progetto. */
async function verificaProprietario(tx: Tx, p: Proprietario, ticketId?: string | null) {
  const o = proprietarioDi(p);
  if (o.tipo === "progetto") {
    const [r] = await tx
      .select({ id: progetti.id })
      .from(progetti)
      .where(and(eq(progetti.id, o.id), isNull(progetti.deletedAt)));
    if (!r) throw new Error("Progetto non trovato");
  } else if (o.tipo === "preventivo") {
    const [r] = await tx
      .select({ id: preventivi.id })
      .from(preventivi)
      .where(and(eq(preventivi.id, o.id), isNull(preventivi.deletedAt)));
    if (!r) throw new Error("Preventivo non trovato");
  } else {
    const [r] = await tx
      .select({ id: clientiRef.id })
      .from(clientiRef)
      .where(eq(clientiRef.id, o.id));
    if (!r) throw new Error("Cliente non trovato");
  }
  if (!ticketId) return;
  if (o.tipo !== "progetto") throw new Error("Un ticket si può indicare solo per un progetto");
  const [t] = await tx
    .select({ id: ticket.id })
    .from(ticket)
    .where(and(eq(ticket.id, ticketId), eq(ticket.progettoId, o.id), isNull(ticket.deletedAt)));
  if (!t) throw new Error("Il ticket non appartiene a questo progetto");
}

async function tocca(tx: Tx, p: { progettoId: string | null }) {
  if (p.progettoId)
    await tx.update(progetti).set({ updatedAt: new Date() }).where(eq(progetti.id, p.progettoId));
}

/**
 * Registra un file già caricato nel bucket. Il ticket, se c'è, deve essere del progetto.
 * Se fallisce, chi chiama toglie l'oggetto dal bucket.
 */
export async function registraDocumento(
  db: Database,
  input: NuovoDocumento,
): Promise<{ id: string }> {
  const { categoria, descrizione } = documentoDatiSchema.parse({
    categoria: input.categoria,
    descrizione: input.descrizione,
  });
  return db.transaction(async (tx) => {
    await verificaProprietario(tx, input, input.ticketId);
    const col = colonne(input);
    const [d] = await tx
      .insert(progettoDocumenti)
      .values({
        id: input.id,
        ...col,
        ticketId: input.ticketId ?? null,
        tipo: "file",
        nome: input.nome,
        chiave: input.chiave,
        dimensioneByte: input.dimensioneByte,
        tipoMime: input.tipoMime || "application/octet-stream",
        categoria,
        descrizione,
        caricatoDaId: input.caricatoDaId ?? null,
      })
      .returning({ id: progettoDocumenti.id });
    if (!d) throw new Error("Registrazione del documento non riuscita");
    await tocca(tx, col);
    return d;
  });
}

/** Allega un link (http o https). */
export async function registraLink(db: Database, input: NuovoLink): Promise<{ id: string }> {
  const link = linkDatiSchema.parse({ titolo: input.titolo, url: input.url });
  const { categoria, descrizione } = documentoDatiSchema.parse({
    categoria: input.categoria,
    descrizione: input.descrizione,
  });
  return db.transaction(async (tx) => {
    await verificaProprietario(tx, input, input.ticketId);
    const col = colonne(input);
    const [d] = await tx
      .insert(progettoDocumenti)
      .values({
        ...col,
        ticketId: input.ticketId ?? null,
        tipo: "link",
        nome: link.titolo,
        url: link.url,
        tipoMime: "text/uri-list",
        categoria,
        descrizione,
        caricatoDaId: input.caricatoDaId ?? null,
      })
      .returning({ id: progettoDocumenti.id });
    if (!d) throw new Error("Registrazione del link non riuscita");
    await tocca(tx, col);
    return d;
  });
}

/**
 * Allega file che sono già nell'archivio (si indicano con l'id di un allegato esistente): nasce
 * un nuovo allegato che punta allo stesso oggetto del bucket, senza copiarlo.
 */
export async function collegaDocumentiEsistenti(
  db: Database,
  input: Proprietario & {
    ticketId?: string | null;
    documentoIds: string[];
    caricatoDaId?: string | null;
  },
): Promise<{ id: string; nome: string }[]> {
  const ids = [...new Set(input.documentoIds)].sort();
  if (ids.length === 0) throw new Error("Scegli almeno un file");
  return db.transaction(async (tx) => {
    await verificaProprietario(tx, input, input.ticketId);
    const col = colonne(input);
    const creati: { id: string; nome: string }[] = [];
    for (const sorgenteId of ids) {
      // FOR SHARE: se nel frattempo viene eliminato l'ultimo allegato di quel file, qui si aspetta
      // e poi lo si trova tolto, invece di allegare un oggetto che sta per sparire dal bucket.
      const [s] = await tx
        .select()
        .from(progettoDocumenti)
        .where(
          and(
            eq(progettoDocumenti.id, sorgenteId),
            eq(progettoDocumenti.tipo, "file"),
            isNull(progettoDocumenti.deletedAt),
          ),
        )
        .for("share");
      if (!s?.chiave || s.dimensioneByte === null)
        throw new Error("Un file scelto non è più nell'archivio");
      const [gia] = await tx
        .select({ id: progettoDocumenti.id })
        .from(progettoDocumenti)
        .where(
          and(
            condizione(input),
            eq(progettoDocumenti.chiave, s.chiave),
            input.ticketId
              ? eq(progettoDocumenti.ticketId, input.ticketId)
              : isNull(progettoDocumenti.ticketId),
            isNull(progettoDocumenti.deletedAt),
          ),
        );
      if (gia) throw new Error(`«${s.nome}» è già allegato qui`);
      const [n] = await tx
        .insert(progettoDocumenti)
        .values({
          ...col,
          ticketId: input.ticketId ?? null,
          tipo: "file",
          nome: s.nome,
          chiave: s.chiave,
          dimensioneByte: s.dimensioneByte,
          tipoMime: s.tipoMime,
          categoria: s.categoria,
          descrizione: s.descrizione,
          caricatoDaId: input.caricatoDaId ?? null,
        })
        .returning({ id: progettoDocumenti.id });
      if (!n) throw new Error("Allegato non riuscito");
      creati.push({ id: n.id, nome: s.nome });
    }
    await tocca(tx, col);
    return creati;
  });
}

export interface FileInArchivio {
  /** id di un allegato che usa il file: serve per allegarlo altrove */
  id: string;
  nome: string;
  dimensioneByte: number;
  tipoMime: string;
  createdAt: Date;
  /** dove è stato caricato per primo, in parole */
  origine: string;
}

/**
 * I file dell'archivio (uno per oggetto del bucket, anche se allegato in più posti), dal più
 * recente, con ricerca per nome. Sono quelli passati dall'app: non il contenuto grezzo del bucket.
 */
export async function fileInArchivio(
  db: Database,
  opzioni: { testo?: string; limite?: number } = {},
): Promise<FileInArchivio[]> {
  const testo = opzioni.testo?.trim();
  const filtro = testo ? sql`and d.nome ilike ${`%${testo.replace(/[\\%_]/g, "\\$&")}%`}` : sql``;
  const limite = Math.min(Math.max(opzioni.limite ?? 50, 1), 200);
  const righe = await db.execute<{
    id: string;
    nome: string;
    dimensione_byte: number;
    tipo_mime: string;
    created_at: string;
    progetto: string | null;
    nome_progetto: string | null;
    preventivo: string | null;
    oggetto_preventivo: string | null;
    cliente: string | null;
  }>(sql`
    select * from (
      select distinct on (d.chiave)
        d.id, d.nome, d.dimensione_byte, d.tipo_mime, d.created_at,
        p.codice as progetto, p.nome as nome_progetto,
        v.numero as preventivo, v.oggetto as oggetto_preventivo,
        c.nome as cliente
      from progetto_documenti d
      left join progetti p on p.id = d.progetto_id
      left join preventivi v on v.id = d.preventivo_id
      left join clienti_ref c on c.id = d.cliente_ref_id
      where d.tipo = 'file' and d.deleted_at is null ${filtro}
      order by d.chiave, d.created_at asc
    ) f
    order by f.created_at desc
    limit ${limite}`);
  return [...righe].map((r) => ({
    id: r.id,
    nome: r.nome,
    dimensioneByte: Number(r.dimensione_byte),
    tipoMime: r.tipo_mime,
    createdAt: new Date(r.created_at),
    origine: r.progetto
      ? `Progetto ${r.progetto}${r.nome_progetto ? ` · ${r.nome_progetto}` : ""}`
      : r.preventivo || r.oggetto_preventivo
        ? `Preventivo ${r.preventivo ?? "in bozza"}${r.oggetto_preventivo ? ` · ${r.oggetto_preventivo}` : ""}`
        : `Cliente ${r.cliente ?? ""}`.trim(),
  }));
}

/** Gli allegati di un progetto, di un preventivo o di un cliente (o di un ticket), dal più recente. */
export async function allegatiDi(
  db: Database,
  proprietario: Proprietario,
  opzioni: { ticketId?: string } = {},
) {
  return db
    .select({ d: progettoDocumenti, caricatoDa: users.name })
    .from(progettoDocumenti)
    .leftJoin(users, eq(users.id, progettoDocumenti.caricatoDaId))
    .where(
      and(
        condizione(proprietario),
        isNull(progettoDocumenti.deletedAt),
        opzioni.ticketId ? eq(progettoDocumenti.ticketId, opzioni.ticketId) : undefined,
      ),
    )
    .orderBy(desc(progettoDocumenti.createdAt));
}

/** I documenti di un progetto (o di un suo ticket), dal più recente. */
export function documentiDelProgetto(
  db: Database,
  progettoId: string,
  opzioni: { ticketId?: string } = {},
) {
  return allegatiDi(db, { progettoId }, opzioni);
}

/**
 * Tutto ciò che riguarda un cliente: i suoi allegati diretti, quelli dei suoi progetti e quelli
 * dei suoi preventivi (con il progetto o il preventivo di provenienza).
 */
export async function allegatiDelCliente(db: Database, clienteRefId: string) {
  return db
    .select({
      d: progettoDocumenti,
      caricatoDa: users.name,
      progetto: { id: progetti.id, codice: progetti.codice, nome: progetti.nome },
      preventivo: {
        id: preventivi.id,
        numero: preventivi.numero,
        oggetto: preventivi.oggetto,
      },
    })
    .from(progettoDocumenti)
    .leftJoin(users, eq(users.id, progettoDocumenti.caricatoDaId))
    .leftJoin(progetti, eq(progetti.id, progettoDocumenti.progettoId))
    .leftJoin(preventivi, eq(preventivi.id, progettoDocumenti.preventivoId))
    .where(
      and(
        isNull(progettoDocumenti.deletedAt),
        or(
          eq(progettoDocumenti.clienteRefId, clienteRefId),
          and(eq(progetti.clienteRefId, clienteRefId), isNull(progetti.deletedAt)),
          and(eq(preventivi.clienteRefId, clienteRefId), isNull(preventivi.deletedAt)),
        ),
      ),
    )
    .orderBy(desc(progettoDocumenti.createdAt));
}

export async function documentoPerId(db: Database, id: string) {
  const [d] = await db
    .select()
    .from(progettoDocumenti)
    .where(and(eq(progettoDocumenti.id, id), isNull(progettoDocumenti.deletedAt)));
  return d ?? null;
}

/** La chiave resta da togliere dal bucket solo se nessun altro allegato vivo la usa. */
async function chiaviOrfane(tx: Tx, chiavi: string[]): Promise<string[]> {
  if (chiavi.length === 0) return [];
  const usate = await tx
    .select({ chiave: progettoDocumenti.chiave })
    .from(progettoDocumenti)
    .where(and(inArray(progettoDocumenti.chiave, chiavi), isNull(progettoDocumenti.deletedAt)));
  const vive = new Set(usate.map((u) => u.chiave));
  return chiavi.filter((c) => !vive.has(c));
}

/** Segna come eliminati tutti gli allegati di un preventivo; ritorna le chiavi da togliere dal bucket. */
export async function eliminaAllegatiPreventivo(tx: Tx, preventivoId: string): Promise<string[]> {
  const righe = await tx
    .update(progettoDocumenti)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(progettoDocumenti.preventivoId, preventivoId), isNull(progettoDocumenti.deletedAt)),
    )
    .returning({ chiave: progettoDocumenti.chiave });
  return chiaviOrfane(tx, [...new Set(righe.flatMap((r) => (r.chiave ? [r.chiave] : [])))]);
}

/**
 * Segna l'allegato come eliminato. `chiaveDaRimuovere` è l'oggetto da togliere dal bucket, se era
 * l'ultimo allegato a usarlo (altrimenti `null`: il file serve ancora altrove, o è un link).
 */
export async function eliminaDocumento(
  db: Database,
  id: string,
): Promise<{
  progettoId: string | null;
  preventivoId: string | null;
  clienteRefId: string | null;
  nome: string;
  tipo: "file" | "link";
  chiaveDaRimuovere: string | null;
}> {
  return db.transaction(async (tx) => {
    const [d] = await tx
      .select()
      .from(progettoDocumenti)
      .where(and(eq(progettoDocumenti.id, id), isNull(progettoDocumenti.deletedAt)))
      .for("update");
    if (!d) throw new Error("Documento non trovato");
    await tx
      .update(progettoDocumenti)
      .set({ deletedAt: new Date() })
      .where(eq(progettoDocumenti.id, id));
    await tocca(tx, d);
    const [chiaveDaRimuovere = null] = d.chiave ? await chiaviOrfane(tx, [d.chiave]) : [];
    return {
      progettoId: d.progettoId,
      preventivoId: d.preventivoId,
      clienteRefId: d.clienteRefId,
      nome: d.nome,
      tipo: d.tipo,
      chiaveDaRimuovere,
    };
  });
}

/** Cambia categoria, descrizione e ticket a cui è allegato (`null` lo stacca); il file non si tocca. */
export async function modificaDocumento(
  db: Database,
  id: string,
  input: { categoria?: string; descrizione?: string | null; ticketId?: string | null },
): Promise<{ progettoId: string | null }> {
  return db.transaction(async (tx) => {
    const [d] = await tx
      .select()
      .from(progettoDocumenti)
      .where(and(eq(progettoDocumenti.id, id), isNull(progettoDocumenti.deletedAt)))
      .for("update");
    if (!d) throw new Error("Documento non trovato");
    const parsed = documentoDatiSchema.parse({
      categoria: input.categoria ?? d.categoria,
      descrizione: input.descrizione === undefined ? d.descrizione : input.descrizione,
    });
    if (input.ticketId) {
      if (!d.progettoId) throw new Error("Un ticket si può indicare solo per un progetto");
      const [t] = await tx
        .select({ id: ticket.id })
        .from(ticket)
        .where(
          and(
            eq(ticket.id, input.ticketId),
            eq(ticket.progettoId, d.progettoId),
            isNull(ticket.deletedAt),
          ),
        );
      if (!t) throw new Error("Il ticket non appartiene a questo progetto");
    }
    await tx
      .update(progettoDocumenti)
      .set({
        categoria: parsed.categoria,
        descrizione: parsed.descrizione,
        ...(input.ticketId !== undefined && { ticketId: input.ticketId }),
      })
      .where(eq(progettoDocumenti.id, id));
    return { progettoId: d.progettoId };
  });
}

import { codiceTicket } from "@telaio/core";
import {
  abbonamenti,
  and,
  clientiRef,
  eq,
  fatture,
  getDb,
  ilike,
  isNull,
  listinoBasi,
  listinoModuli,
  or,
  preventivi,
  progetti,
  progettoDocumenti,
  ticket,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const PER_TIPO = 5;

/** I caratteri speciali di LIKE, cercati alla lettera. */
const comeLetterale = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Ricerca globale sui contenuti: clienti, preventivi, fatture, progetti, abbonamenti, listini. */
export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json([], { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const db = getDb();
  const like = `%${comeLetterale(q)}%`;
  const [clienti, prev, fatt, prog, abb, basi, moduli, tick, docs] = await Promise.all([
    twentyDaEnv()
      .elencaClienti({ testo: q, limite: PER_TIPO })
      .catch(() => []),
    db
      .select({ p: preventivi, cliente: clientiRef.nome })
      .from(preventivi)
      .leftJoin(clientiRef, eq(clientiRef.id, preventivi.clienteRefId))
      .where(
        and(
          isNull(preventivi.deletedAt),
          or(
            ilike(preventivi.oggetto, like),
            ilike(preventivi.numero, like),
            ilike(clientiRef.nome, like),
          ),
        ),
      )
      .limit(PER_TIPO),
    db
      .select({ f: fatture, cliente: clientiRef.nome })
      .from(fatture)
      .leftJoin(clientiRef, eq(clientiRef.id, fatture.clienteRefId))
      .where(
        and(
          isNull(fatture.deletedAt),
          or(ilike(fatture.numero, like), ilike(clientiRef.nome, like)),
        ),
      )
      .limit(PER_TIPO),
    db
      .select({ p: progetti, cliente: clientiRef.nome })
      .from(progetti)
      .leftJoin(clientiRef, eq(clientiRef.id, progetti.clienteRefId))
      .where(
        and(
          isNull(progetti.deletedAt),
          or(
            ilike(progetti.nome, like),
            ilike(progetti.codice, like),
            ilike(clientiRef.nome, like),
          ),
        ),
      )
      .limit(PER_TIPO),
    db
      .select({ a: abbonamenti, cliente: clientiRef.nome })
      .from(abbonamenti)
      .innerJoin(clientiRef, eq(clientiRef.id, abbonamenti.clienteRefId))
      .where(
        and(
          isNull(abbonamenti.deletedAt),
          or(ilike(abbonamenti.descrizione, like), ilike(clientiRef.nome, like)),
        ),
      )
      .limit(PER_TIPO),
    db
      .select({ nome: listinoBasi.nome })
      .from(listinoBasi)
      .where(and(isNull(listinoBasi.deletedAt), ilike(listinoBasi.nome, like)))
      .limit(PER_TIPO),
    db
      .select({ nome: listinoModuli.nome })
      .from(listinoModuli)
      .where(and(isNull(listinoModuli.deletedAt), ilike(listinoModuli.nome, like)))
      .limit(PER_TIPO),
    db
      .select({ t: ticket, codice: progetti.codice })
      .from(ticket)
      .innerJoin(progetti, eq(progetti.id, ticket.progettoId))
      .where(
        and(
          isNull(ticket.deletedAt),
          isNull(progetti.deletedAt),
          or(ilike(ticket.titolo, like), ilike(ticket.descrizione, like)),
        ),
      )
      .limit(PER_TIPO),
    db
      .select({ d: progettoDocumenti, codice: progetti.codice })
      .from(progettoDocumenti)
      .innerJoin(progetti, eq(progetti.id, progettoDocumenti.progettoId))
      .where(
        and(
          isNull(progettoDocumenti.deletedAt),
          or(ilike(progettoDocumenti.nome, like), ilike(progettoDocumenti.descrizione, like)),
        ),
      )
      .limit(PER_TIPO),
  ]);

  return NextResponse.json([
    ...clienti.map((c) => ({
      tipo: "cliente",
      titolo: c.nome,
      sottotitolo: c.citta ?? "Cliente",
      href: `/clienti/${c.id}`,
    })),
    ...prev.map(({ p, cliente }) => ({
      tipo: "preventivo",
      titolo: p.oggetto,
      sottotitolo: [p.numero ?? "Bozza", cliente].filter(Boolean).join(" · "),
      href: `/preventivi/${p.id}`,
    })),
    ...fatt.map(({ f, cliente }) => ({
      tipo: "fattura",
      titolo: f.numero ?? "Bozza",
      sottotitolo: cliente ?? "Fattura",
      href: `/fatture/${f.id}`,
    })),
    ...prog.map(({ p, cliente }) => ({
      tipo: "progetto",
      titolo: p.nome,
      sottotitolo: [p.codice, cliente].filter(Boolean).join(" · "),
      href: `/progetti/${p.id}`,
    })),
    ...abb.map(({ a, cliente }) => ({
      tipo: "abbonamento",
      titolo: a.descrizione,
      sottotitolo: cliente,
      href: `/abbonamenti/${a.id}`,
    })),
    ...tick.map(({ t, codice }) => ({
      tipo: "ticket",
      titolo: t.titolo,
      sottotitolo: codiceTicket(codice, t.numero),
      href: `/progetti/${t.progettoId}/ticket/${t.numero}`,
    })),
    ...docs.map(({ d, codice }) => ({
      tipo: "documento",
      titolo: d.nome,
      sottotitolo: `${codice} · Documento`,
      href: `/progetti/${d.progettoId}`,
    })),
    ...basi.map((b) => ({
      tipo: "listino",
      titolo: b.nome,
      sottotitolo: "Base di listino",
      href: "/listini",
    })),
    ...moduli.map((m) => ({
      tipo: "listino",
      titolo: m.nome,
      sottotitolo: "Modulo di listino",
      href: "/listini",
    })),
  ]);
}

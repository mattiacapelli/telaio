import { getDb, ilike, isNull, or, and, fatture, preventivi } from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json([], { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const db = getDb();
  const like = `%${q}%`;
  const [clienti, prev, fatt] = await Promise.all([
    twentyDaEnv().elencaClienti({ testo: q, limite: 5 }).catch(() => []),
    db.select().from(preventivi).where(and(isNull(preventivi.deletedAt), or(ilike(preventivi.oggetto, like), ilike(preventivi.numero, like)))).limit(5),
    db.select().from(fatture).where(and(isNull(fatture.deletedAt), ilike(fatture.numero, like))).limit(5),
  ]);

  return NextResponse.json([
    ...clienti.map((c) => ({ tipo: "cliente", titolo: c.nome, sottotitolo: "Cliente", href: `/clienti/${c.id}` })),
    ...prev.map((p) => ({ tipo: "preventivo", titolo: p.oggetto, sottotitolo: p.numero ?? "Bozza", href: `/preventivi/${p.id}` })),
    ...fatt.map((f) => ({ tipo: "fattura", titolo: f.numero ?? "Bozza", sottotitolo: "Fattura", href: `/fatture/${f.id}` })),
  ]);
}

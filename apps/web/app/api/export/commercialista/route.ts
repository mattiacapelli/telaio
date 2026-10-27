import {
  and,
  asc,
  clientiRef,
  conti,
  eq,
  fatture,
  getDb,
  gte,
  isNull,
  lt,
  movimenti,
  ragioniSociali,
} from "@telaio/db";
import { oggi } from "@/lib/date";
import { intervallo, valorePeriodo } from "@/lib/periodo";
import { requireSession } from "@/lib/session";

const euro = (cent: number) => (cent / 100).toFixed(2).replace(".", ",");
const campo = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const riga = (v: (string | number | null | undefined)[]) => v.map(campo).join(";");

/** CSV per il commercialista: fatture emesse o prima nota del periodo (`?tipo=fatture|prima-nota&p=mese|trimestre|anno`). */
export async function GET(req: Request) {
  await requireSession();
  const url = new URL(req.url);
  const { da, a, etichetta } = intervallo(
    valorePeriodo(url.searchParams.get("p") ?? undefined),
    oggi(),
  );
  const tipo = url.searchParams.get("tipo") === "prima-nota" ? "prima-nota" : "fatture";
  const db = getDb();
  const righe: string[] = [];

  if (tipo === "fatture") {
    righe.push(
      riga([
        "Numero",
        "Data",
        "Emittente",
        "Cliente",
        "Imponibile",
        "IVA",
        "Bollo",
        "Totale",
        "Stato",
      ]),
    );
    const dati = await db
      .select({ f: fatture, emittente: ragioniSociali.nome, cliente: clientiRef.nome })
      .from(fatture)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, fatture.ragioneSocialeId))
      .leftJoin(clientiRef, eq(clientiRef.id, fatture.clienteRefId))
      .where(
        and(
          isNull(fatture.deletedAt),
          gte(fatture.dataEmissione, da),
          lt(fatture.dataEmissione, a),
        ),
      )
      .orderBy(asc(fatture.dataEmissione));
    for (const { f, emittente, cliente } of dati) {
      if (f.stato === "bozza") continue;
      const nome = cliente ?? (f.snapshot.cliente as { nome?: string }).nome;
      righe.push(
        riga([
          f.numero,
          f.dataEmissione,
          emittente,
          nome,
          euro(f.imponibileCent),
          euro(f.ivaCent),
          euro(f.bolloCent),
          euro(f.totaleCent),
          f.stato,
        ]),
      );
    }
  } else {
    righe.push(riga(["Data", "Tipo", "Conto", "Categoria", "Descrizione", "Importo"]));
    const dati = await db
      .select({ m: movimenti, conto: conti.nome })
      .from(movimenti)
      .innerJoin(conti, eq(conti.id, movimenti.contoId))
      .where(and(isNull(movimenti.deletedAt), gte(movimenti.data, da), lt(movimenti.data, a)))
      .orderBy(asc(movimenti.data));
    for (const { m, conto } of dati)
      righe.push(riga([m.data, m.tipo, conto, m.categoria, m.descrizione, euro(m.importoCent)]));
  }

  return new Response(`﻿${righe.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${tipo}-${etichetta.toLowerCase().replace(/\s+/g, "-")}.csv"`,
    },
  });
}

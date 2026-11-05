import { and, asc, clientiRef, eq, getDb, isNull, preventivi, preventivoRighe } from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import { notFound, redirect } from "next/navigation";
import { PreventivoEditor } from "@/components/domain/preventivo-editor";
import { caricaEmittentiCfg } from "@/lib/emittenti-cfg";

export const metadata = { title: "Modifica bozza" };
export const dynamic = "force-dynamic";

const VALIDITA = [15, 30, 60, 90];
const centInTesto = (cent: number) => (cent / 100).toFixed(2).replace(".", ",");

export default async function ModificaPreventivoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [riga] = await db
    .select({
      p: preventivi,
      clienteTwentyId: clientiRef.twentyCompanyId,
      cliente: clientiRef.nome,
    })
    .from(preventivi)
    .leftJoin(clientiRef, eq(clientiRef.id, preventivi.clienteRefId))
    .where(and(eq(preventivi.id, id), isNull(preventivi.deletedAt)));
  if (!riga) notFound();
  const { p } = riga;
  // Dopo l'invio numero, emittente e totali sono congelati: si torna al dettaglio.
  if (p.stato !== "bozza") redirect(`/preventivi/${id}`);

  const [emittenti, clienti, righe] = await Promise.all([
    caricaEmittentiCfg(db),
    twentyDaEnv()
      .elencaClienti({ limite: 200 })
      .catch(() => []),
    db
      .select()
      .from(preventivoRighe)
      .where(eq(preventivoRighe.preventivoId, id))
      .orderBy(asc(preventivoRighe.posizione)),
  ]);

  const elencoClienti = clienti.map((c) => ({ id: c.id, nome: c.nome }));
  // Il cliente della bozza deve restare scelto anche se non è tra i primi 200 di Twenty.
  if (riga.clienteTwentyId && !elencoClienti.some((c) => c.id === riga.clienteTwentyId))
    elencoClienti.unshift({ id: riga.clienteTwentyId, nome: riga.cliente ?? "Cliente" });

  // La validità si ricava dalla distanza tra creazione e scadenza, sull'opzione più vicina.
  const giorni = p.validoFino
    ? Math.round(
        (new Date(`${p.validoFino}T00:00:00Z`).getTime() -
          new Date(`${p.createdAt.toISOString().slice(0, 10)}T00:00:00Z`).getTime()) /
          86_400_000,
      )
    : 30;
  const validitaGiorni = VALIDITA.reduce((a, b) =>
    Math.abs(b - giorni) < Math.abs(a - giorni) ? b : a,
  );

  return (
    <PreventivoEditor
      emittenti={emittenti}
      clienti={elencoClienti}
      clienteIniziale={riga.clienteTwentyId ?? undefined}
      bozza={{
        id,
        ragioneSocialeId: p.ragioneSocialeId,
        oggetto: p.oggetto,
        note: p.note ?? "",
        validitaGiorni,
        righe: righe.map((r) => ({
          descrizione: r.descrizione,
          tipo: r.tipo,
          quantita: String(r.quantita),
          prezzo: centInTesto(r.prezzoUnitarioCent),
          scontoPercento: r.scontoBp ? String(r.scontoBp / 100).replace(".", ",") : "",
          voceListinoId: r.voceListinoId ?? undefined,
          gruppo: r.gruppoAlternativaId,
        })),
      }}
    />
  );
}

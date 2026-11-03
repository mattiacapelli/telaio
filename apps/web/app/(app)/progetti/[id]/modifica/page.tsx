import { and, clientiRef, eq, getDb, isNull, progetti } from "@telaio/db";
import { notFound } from "next/navigation";
import { ProgettoForm } from "@/components/domain/progetto-form";
import { modificaProgettoAction } from "../../actions";
import { opzioniFormProgetto } from "../../dati-form";

export const metadata = { title: "Modifica progetto" };
export const dynamic = "force-dynamic";

export default async function ModificaProgettoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [riga] = await db
    .select({ p: progetti, clienteTwentyId: clientiRef.twentyCompanyId })
    .from(progetti)
    .leftJoin(clientiRef, eq(clientiRef.id, progetti.clienteRefId))
    .where(and(eq(progetti.id, id), isNull(progetti.deletedAt)));
  if (!riga) notFound();
  const { p } = riga;
  const opz = await opzioniFormProgetto(db, {
    clienteTwentyId: riga.clienteTwentyId,
    preventivoId: p.preventivoId,
  });
  // Il preventivo già collegato resta scelto anche se non è più tra quelli accettati.
  if (p.preventivoId && !opz.preventivi.some((x) => x.id === p.preventivoId))
    opz.preventivi.unshift({ id: p.preventivoId, etichetta: "Preventivo collegato" });
  return (
    <ProgettoForm
      azione={modificaProgettoAction}
      iniziale={{
        id: p.id,
        codice: p.codice,
        nome: p.nome,
        descrizione: p.descrizione ?? "",
        categoria: p.categoria,
        stato: p.stato,
        priorita: p.priorita,
        responsabileId: p.responsabileId ?? "",
        clienteTwentyId: riga.clienteTwentyId ?? "",
        preventivoId: p.preventivoId ?? "",
        dataInizioPrevista: p.dataInizioPrevista ?? "",
        dataFinePrevista: p.dataFinePrevista ?? "",
      }}
      clienti={opz.clienti}
      preventivi={opz.preventivi}
      utenti={opz.utenti}
      annullaHref={`/progetti/${p.id}`}
    />
  );
}

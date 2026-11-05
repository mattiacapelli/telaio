import { and, desc, eq, getDb, isNull, progetti, sql, ticket } from "@telaio/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { oggi } from "@/lib/date";
import { type RigaTicket, TicketTabella } from "./ticket-tabella";

export const metadata = { title: "Ticket" };
export const dynamic = "force-dynamic";

/** Tutti i ticket di tutti i progetti: gli aperti prima, poi i completati, dal più recente. */
export default async function TicketPage() {
  const tutti = await getDb()
    .select({
      t: ticket,
      progettoId: progetti.id,
      codiceProgetto: progetti.codice,
      nomeProgetto: progetti.nome,
    })
    .from(ticket)
    .innerJoin(progetti, eq(progetti.id, ticket.progettoId))
    .where(and(isNull(ticket.deletedAt), isNull(progetti.deletedAt)))
    .orderBy(sql`(${ticket.stato} = 'completato')`, desc(ticket.updatedAt))
    .limit(1000);

  const righe: RigaTicket[] = tutti.map(({ t, progettoId, codiceProgetto, nomeProgetto }) => ({
    id: t.id,
    numero: t.numero,
    titolo: t.titolo,
    tipo: t.tipo,
    stato: t.stato,
    priorita: t.priorita,
    scadenza: t.scadenza,
    aggiornato: t.updatedAt.toISOString(),
    progettoId,
    codiceProgetto,
    nomeProgetto,
  }));
  const dataOggi = oggi();
  const aperti = righe.filter((r) => r.stato !== "completato");
  const progettiPresenti = [
    ...new Map(righe.map((r) => [r.progettoId, `${r.codiceProgetto} · ${r.nomeProgetto}`])),
  ].map(([valore, etichetta]) => ({ valore, etichetta }));

  return (
    <>
      <PageHeader
        titolo="Ticket"
        descrizione="Le attività, i bug e le richieste di tutti i progetti. Per la lavagna e per crearne di nuovi apri il progetto."
      />
      <StatsRow
        dati={[
          { etichetta: "Aperti", valore: aperti.length },
          { etichetta: "In corso", valore: righe.filter((r) => r.stato === "in_corso").length },
          {
            etichetta: "In revisione",
            valore: righe.filter((r) => r.stato === "in_revisione").length,
          },
          {
            etichetta: "Scaduti",
            valore: aperti.filter((r) => r.scadenza && r.scadenza < dataOggi).length,
          },
        ]}
      />
      <TicketTabella righe={righe} progetti={progettiPresenti} oggi={dataOggi} />
    </>
  );
}

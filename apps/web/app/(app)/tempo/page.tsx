import { formattaOre } from "@telaio/core";
import { elencaTempo, getDb, minutiNelPeriodo, timerAttivo } from "@telaio/db";
import { EliminaTempo } from "@/components/domain/azioni-tempo";
import { TempoModal } from "@/components/domain/tempo-modal";
import { TimerCard } from "@/components/domain/timer-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { Table, Td, Th } from "@/components/ui/table";
import { formatData, oggi } from "@/lib/date";
import { opzioniTempo } from "@/lib/tempo-opzioni";

export const metadata = { title: "Tempo" };
export const dynamic = "force-dynamic";

function periodi(dataOggi: string) {
  const d = new Date(`${dataOggi}T00:00:00Z`);
  const lun = new Date(d);
  lun.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const fineMese = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return {
    settimana: lun.toISOString().slice(0, 10),
    mese: `${dataOggi.slice(0, 8)}01`,
    fineMese: fineMese.toISOString().slice(0, 10),
  };
}

export default async function TempoPage() {
  const db = getDb();
  const dataOggi = oggi();
  const p = periodi(dataOggi);
  const [voci, timer, opzioni, minOggi, minSettimana, minMese] = await Promise.all([
    elencaTempo(db, { limite: 200 }),
    timerAttivo(db),
    opzioniTempo(db, dataOggi),
    minutiNelPeriodo(db, dataOggi, dataOggi),
    minutiNelPeriodo(db, p.settimana, dataOggi),
    minutiNelPeriodo(db, p.mese, p.fineMese),
  ]);

  return (
    <>
      <PageHeader
        titolo="Tempo"
        descrizione="Registra le ore lavorate, con timer o a mano. Quelle di un contratto a ore scalano dal suo saldo."
        azioni={<TempoModal opzioni={opzioni} />}
      />

      <TimerCard
        attivo={
          timer
            ? {
                avviatoAt: (timer.v.avviatoAt as Date).toISOString(),
                cliente: timer.cliente,
                contratto: timer.contratto,
                descrizione: timer.v.descrizione,
              }
            : null
        }
        opzioni={opzioni}
      />

      <StatsRow
        dati={[
          { etichetta: "Oggi", valore: formattaOre(minOggi) },
          { etichetta: "Questa settimana", valore: formattaOre(minSettimana) },
          { etichetta: "Questo mese", valore: formattaOre(minMese) },
        ]}
      />

      {voci.length === 0 ? (
        <EmptyState title="Nessun tempo registrato">
          Avvia un timer o registra le ore di oggi.
        </EmptyState>
      ) : (
        <Table minLarghezza={760}>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Cliente</Th>
              <Th>Descrizione</Th>
              <Th destra>Durata</Th>
              <Th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {voci.map(({ v, cliente, contratto, progetto, ticketNumero }) => (
              <tr key={v.id} className="group">
                <Td className="tabular-nums">{formatData(v.data)}</Td>
                <Td>
                  <span className="font-medium">{cliente}</span>
                  {(contratto || progetto) && (
                    <span className="block text-xs text-fg-3">
                      {[
                        contratto,
                        progetto && `${progetto}${ticketNumero ? ` #${ticketNumero}` : ""}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </Td>
                <Td className="text-fg-2">
                  {v.descrizione ?? "—"}
                  {!v.fatturabile && (
                    <span className="ml-2">
                      <Badge>Non fatturabile</Badge>
                    </span>
                  )}
                </Td>
                <Td destra className="font-medium tabular-nums">
                  {formattaOre(v.minuti)}
                  {v.minuti !== v.minutiEffettivi && (
                    <span className="block text-xs font-normal text-fg-3">
                      lavorati {formattaOre(v.minutiEffettivi)}
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="flex justify-end gap-0.5">
                    <TempoModal
                      opzioni={opzioni}
                      trigger="Modifica"
                      voce={{
                        id: v.id,
                        clienteRefId: v.clienteRefId,
                        monteOreId: v.monteOreId,
                        ticketId: v.ticketId,
                        data: v.data,
                        minutiEffettivi: v.minutiEffettivi,
                        descrizione: v.descrizione,
                        fatturabile: v.fatturabile,
                      }}
                    />
                    <EliminaTempo
                      id={v.id}
                      descrizione={v.descrizione ?? `${cliente} ${formatData(v.data)}`}
                    />
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

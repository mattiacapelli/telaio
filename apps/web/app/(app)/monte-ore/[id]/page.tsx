import {
  ETICHETTE_STATO_MONTE_ORE,
  formatEuro,
  formattaOre,
  importoOreExtraCent,
} from "@telaio/core";
import { elencaTempo, getDb, riepilogoMonteOre } from "@telaio/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CambiaStatoMonteOre,
  EliminaMonteOre,
  EliminaTempo,
  FatturaOreExtra,
} from "@/components/domain/azioni-tempo";
import { BarraOre } from "@/components/domain/barra-ore";
import { MonteOreModal } from "@/components/domain/monte-ore-modal";
import { TempoModal } from "@/components/domain/tempo-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { Table, Td, Th } from "@/components/ui/table";
import { formatData, oggi } from "@/lib/date";
import { elencaEmittenti, opzioniTempo } from "@/lib/tempo-opzioni";

export const metadata = { title: "Monte ore" };
export const dynamic = "force-dynamic";

const comeOre = (min: number) => String(min / 60).replace(".", ",");
const comeEuro = (cent: number) => (cent ? (cent / 100).toFixed(2).replace(".", ",") : "");

export default async function MonteOreDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const dataOggi = oggi();
  const [riepilogo] = await riepilogoMonteOre(db, dataOggi, { id });
  if (!riepilogo) notFound();
  const { contratto: m, cliente, corrente, cicli } = riepilogo;
  const [voci, opzioni, emittenti] = await Promise.all([
    corrente
      ? elencaTempo(db, { monteOreId: id, da: corrente.inizio, a: corrente.fine })
      : Promise.resolve([]),
    opzioniTempo(db, dataOggi),
    elencaEmittenti(db),
  ]);
  const concluso = m.stato === "concluso";

  return (
    <>
      <PageHeader
        titolo={m.nome}
        descrizione={
          <>
            {cliente} · {formattaOre(m.minutiIncluse)} per periodo, dal giorno{" "}
            {Number(m.dataInizio.slice(8))} del mese · arrotondamento {m.arrotondamentoMinuti} min
          </>
        }
        stato={
          <Badge variant={concluso ? "neutral" : "ok"} dot>
            {ETICHETTE_STATO_MONTE_ORE[m.stato]}
          </Badge>
        }
        azioni={
          <>
            {!concluso && (
              <TempoModal opzioni={opzioni} contrattoId={id} trigger="Registra tempo" />
            )}
            <Button asChild variant="secondary">
              <a href={`/api/pdf/ore/${id}?inline=1`} target="_blank" rel="noopener noreferrer">
                Estratto PDF
              </a>
            </Button>
            <MonteOreModal
              emittenti={emittenti}
              contratto={{
                id,
                nome: m.nome,
                ragioneSocialeId: m.ragioneSocialeId,
                oreIncluse: comeOre(m.minutiIncluse),
                tariffaOraria: comeEuro(m.tariffaOrariaCent),
                tariffaExtra: comeEuro(m.tariffaExtraCent),
                arrotondamentoMinuti: m.arrotondamentoMinuti,
                dataInizio: m.dataInizio,
                dataFine: m.dataFine,
              }}
            />
            <CambiaStatoMonteOre id={id} concluso={concluso} />
            <EliminaMonteOre id={id} nome={m.nome} />
          </>
        }
      />

      {corrente ? (
        <>
          <StatsRow
            dati={[
              { etichetta: "Incluse nel periodo", valore: formattaOre(corrente.incluse) },
              { etichetta: "Usate", valore: formattaOre(corrente.usati) },
              corrente.extra > 0
                ? {
                    etichetta: "Ore extra",
                    valore: formattaOre(corrente.extra),
                    nota: m.tariffaExtraCent
                      ? `${formatEuro(Math.round((corrente.extra / 60) * m.tariffaExtraCent))} a ${formatEuro(m.tariffaExtraCent)}/h`
                      : undefined,
                    tono: "bad",
                  }
                : { etichetta: "Rimanenti", valore: formattaOre(corrente.rimanenti) },
              {
                etichetta: "Periodo",
                valore: `${formatData(corrente.inizio)} – ${formatData(corrente.fine)}`,
              },
            ]}
          />
          <Card>
            <BarraOre saldo={corrente} />
          </Card>
          {corrente.daFatturare > 0 && (
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  Ore extra da fatturare: {formattaOre(corrente.daFatturare)}
                </p>
                <p className="text-sm text-fg-2">
                  {m.tariffaExtraCent > 0
                    ? `${formatEuro(importoOreExtraCent(corrente.daFatturare, m.tariffaExtraCent))} a ${formatEuro(m.tariffaExtraCent)}/h`
                    : "Imposta la tariffa delle ore extra (Modifica) per poterle fatturare."}
                </p>
              </div>
              {m.tariffaExtraCent > 0 && (
                <FatturaOreExtra
                  id={id}
                  ciclo={corrente.n}
                  etichetta="Crea la fattura"
                  descrizione={`Crea la bozza di fattura per ${formattaOre(corrente.daFatturare)} di ore extra (${formatEuro(importoOreExtraCent(corrente.daFatturare, m.tariffaExtraCent))}). Si apre per la revisione prima di emetterla.`}
                />
              )}
            </Card>
          )}
        </>
      ) : (
        <Card>
          <p className="text-sm text-fg-2">Il contratto inizia il {formatData(m.dataInizio)}.</p>
        </Card>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Tempo del periodo</h2>
        {voci.length === 0 ? (
          <p className="text-sm text-fg-2">Nessun tempo registrato in questo periodo.</p>
        ) : (
          <Table minLarghezza={600}>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Descrizione</Th>
                <Th destra>Conta</Th>
                <Th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {voci.map(({ v }) => (
                <tr key={v.id} className="group">
                  <Td className="tabular-nums">{formatData(v.data)}</Td>
                  <Td className="text-fg-2">{v.descrizione ?? "—"}</Td>
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
                      <EliminaTempo id={v.id} descrizione={v.descrizione ?? formatData(v.data)} />
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      {cicli.length > 1 && (
        <Card>
          <CardHeader
            title="Periodi precedenti"
            description="Le ore non usate decadono: ogni periodo riparte dal monte pieno."
          />
          <Table minLarghezza={480}>
            <thead>
              <tr>
                <Th>Periodo</Th>
                <Th destra>Usate</Th>
                <Th destra>Incluse</Th>
                <Th destra>Esito</Th>
                <Th className="w-40" />
              </tr>
            </thead>
            <tbody>
              {[...cicli]
                .reverse()
                .slice(1)
                .map((c) => (
                  <tr key={c.n}>
                    <Td className="tabular-nums">
                      {formatData(c.inizio)} – {formatData(c.fine)}
                    </Td>
                    <Td destra className="tabular-nums">
                      {formattaOre(c.usati)}
                    </Td>
                    <Td destra className="tabular-nums">
                      {formattaOre(c.incluse)}
                    </Td>
                    <Td destra className="tabular-nums">
                      {c.extra > 0 ? (
                        <span className="text-bad">{formattaOre(c.extra)} extra</span>
                      ) : (
                        <span className="text-fg-2">{formattaOre(c.rimanenti)} non usate</span>
                      )}
                    </Td>
                    <Td>
                      <span className="flex items-center justify-end gap-2">
                        {c.daFatturare > 0 && m.tariffaExtraCent > 0 && (
                          <FatturaOreExtra
                            id={id}
                            ciclo={c.n}
                            etichetta="Fattura extra"
                            descrizione={`Crea la bozza di fattura per ${formattaOre(c.daFatturare)} di ore extra di questo periodo.`}
                          />
                        )}
                        <a
                          href={`/api/pdf/ore/${id}?ciclo=${c.n}&inline=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-fg-2 hover:underline"
                        >
                          Estratto
                        </a>
                      </span>
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </Card>
      )}
      <p className="text-xs text-fg-3">
        <Link href="/monte-ore" className="hover:underline">
          Tutti i contratti a ore
        </Link>
      </p>
    </>
  );
}

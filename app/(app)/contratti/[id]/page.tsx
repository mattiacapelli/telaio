import Link from "next/link";
import { notFound } from "next/navigation";
import { getContrattoCompleto } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Barra } from "@/components/ui-legacy";
import { Chip, coloreDa } from "@/components/chip";
import { SezioneCampi, CampoRecord, Schede } from "@/components/record/pannello";
import { DocumentiProgetto } from "@/components/documenti-progetto";
import { AzioniContratto } from "@/components/azioni-contratto";
import { eur, eurCent, ore, data, dataEstesa } from "@/lib/format";
import { TIPI, STATI, PERIODICITA } from "@/lib/contratti";
import {
  FileText, Building2, User, Euro, Clock, Calendar, Tag, Receipt,
  LifeBuoy, RefreshCw, AlertTriangle, FolderKanban,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContrattoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getContrattoCompleto(id);
  if (!c) notFound();

  const esaurito = c.consumo?.residue !== null && c.consumo?.residue !== undefined && c.consumo.residue < 0;
  const inScadenza = c.giorniAllaScadenza !== null && c.giorniAllaScadenza <= 60;

  return (
    <div className="tl-in flex flex-col overflow-hidden rounded border border-border md:h-[calc(100vh-96px)] md:flex-row">
      <aside className="flex w-full flex-none flex-col overflow-y-auto border-b border-border bg-surface md:w-[300px] md:border-b-0 md:border-r">
        <div className="flex flex-col items-center gap-2 px-3 py-5">
          <div
            className="grid h-12 w-12 place-items-center rounded-md text-md font-semibold"
            style={{ background: `${coloreDa(c.titolo)}26`, color: coloreDa(c.titolo) }}
          >
            {c.titolo.trim()[0]?.toUpperCase() ?? "C"}
          </div>
          <div className="text-center">
            <h1 className="text-md font-semibold">{c.titolo}</h1>
            <div className="mt-0.5 text-xs text-faint">
              {c.numero} · {c.cliente.ragioneSociale}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            <Badge tono={c.stato === "ATTIVO" ? "accento" : "neutro"}>{STATI[c.stato]}</Badge>
            {esaurito && <Badge tono="attenzione">monte esaurito</Badge>}
            {inScadenza && <Badge tono="attenzione">in scadenza</Badge>}
          </div>
          <div className="mt-2">
            <AzioniContratto
              contratto={{ id: c.id, stato: c.stato, tipo: c.tipo, numero: c.numero }}
            />
          </div>
        </div>

        <div className="px-3 pb-1 text-md font-medium">Campi</div>

        <SezioneCampi titolo="Generale">
          <CampoRecord icona={<Tag size={12} />} etichetta="Tipo">{TIPI[c.tipo]}</CampoRecord>
          <CampoRecord icona={<Building2 size={12} />} etichetta="Cliente">
            <Link href={`/clienti/${c.cliente.id}`} className="flex items-center gap-1.5 hover:underline">
              <Chip testo={c.cliente.ragioneSociale} />
              <span className="truncate">{c.cliente.ragioneSociale}</span>
            </Link>
          </CampoRecord>
          <CampoRecord icona={<User size={12} />} etichetta="Referente" vuoto="Nessuno">
            {c.cliente.referente}
          </CampoRecord>
          <CampoRecord icona={<FolderKanban size={12} />} etichetta="Progetto" vuoto="Nessuno">
            {c.progetto && (
              <Link href={`/progetti/${c.progetto.id}`} className="truncate hover:underline">
                {c.progetto.nome}
              </Link>
            )}
          </CampoRecord>
        </SezioneCampi>

        <SezioneCampi titolo="Economia">
          <CampoRecord icona={<Euro size={12} />} etichetta="Canone">{eur(c.canone)}</CampoRecord>
          <CampoRecord icona={<RefreshCw size={12} />} etichetta="Periodicità">
            {PERIODICITA[c.periodicita]}
          </CampoRecord>
          {c.monteOre !== null && (
            <CampoRecord icona={<Clock size={12} />} etichetta="Monte ore">
              {ore(c.monteOre)} per periodo
            </CampoRecord>
          )}
          <CampoRecord icona={<Euro size={12} />} etichetta="Ore extra" vuoto="Tariffa cliente">
            {c.tariffaExtra !== null && eurCent(c.tariffaExtra)}
          </CampoRecord>
        </SezioneCampi>

        <SezioneCampi titolo="Durata">
          <CampoRecord icona={<Calendar size={12} />} etichetta="Inizio">
            {dataEstesa(c.inizioIl)}
          </CampoRecord>
          <CampoRecord icona={<Calendar size={12} />} etichetta="Scadenza" vuoto="Senza scadenza">
            {c.scadeIl && dataEstesa(c.scadeIl)}
          </CampoRecord>
          <CampoRecord icona={<RefreshCw size={12} />} etichetta="Rinnovo">
            {c.rinnovoAutomatico ? "Automatico" : "Manuale"}
          </CampoRecord>
          <CampoRecord icona={<Clock size={12} />} etichetta="Preavviso">
            {c.preavvisoGiorni} giorni
          </CampoRecord>
        </SezioneCampi>

        {c.note && (
          <SezioneCampi titolo="Note" apertaDiDefault={false}>
            <div className="px-3 py-1 text-md text-muted whitespace-pre-wrap">{c.note}</div>
          </SezioneCampi>
        )}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
        <Schede
          schede={[
            {
              chiave: "consumo",
              etichetta: "Consumo",
              icona: <Clock size={13} />,
              contenuto: (
                <div className="flex flex-col gap-4 p-4">
                  {c.consumo && c.consumo.monteOre !== null ? (
                    <>
                      {esaurito && (
                        <div
                          className="flex items-center gap-1.5 rounded border px-2 py-1.5 text-md"
                          style={{ borderColor: "var(--neg)", background: "var(--neg-soft)", color: "var(--neg)" }}
                        >
                          <AlertTriangle size={12} />
                          Monte ore superato di {ore(c.consumo.eccedenza)} · da fatturare{" "}
                          {eur(c.consumo.eccedenza * c.consumo.tariffaExtra)}
                        </div>
                      )}
                      <div>
                        <div className="mb-2 flex items-baseline gap-2">
                          <span className="text-lg font-semibold">{ore(c.consumo.consumate)}</span>
                          <span className="text-md text-muted">su {ore(c.consumo.monteOre)}</span>
                          <div className="flex-1" />
                          <span className={`text-md ${esaurito ? "text-neg" : "text-muted"}`}>
                            {Math.round(c.consumo.percentuale)}%
                          </span>
                        </div>
                        <Barra valore={c.consumo.consumate} max={c.consumo.monteOre} />
                        <div className="mt-1.5 text-xs text-faint">
                          Periodo {data(c.consumo.inizio)} – {data(c.consumo.fine)}
                          {c.consumo.residue !== null && c.consumo.residue > 0 &&
                            ` · restano ${ore(c.consumo.residue)}`}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-md text-faint">
                      Questo contratto non prevede un monte ore.
                    </div>
                  )}

                  <div>
                    <div className="mb-1.5 text-md font-medium">Periodi</div>
                    <div className="rounded border border-border">
                      {c.periodi.length === 0 ? (
                        <div className="px-3 py-5 text-center text-md text-faint">
                          Nessun periodo fatturato
                        </div>
                      ) : (
                        c.periodi.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 border-b border-border px-2 py-1.5 text-md last:border-0">
                            <Receipt size={12} className="flex-none text-faint" />
                            <span className="min-w-0 flex-1">
                              {data(p.inizioIl)} – {data(p.fineIl)}
                            </span>
                            {p.monteOre !== null && (
                              <span className="text-xs text-faint">{ore(p.monteOre)} incluse</span>
                            )}
                            {p.fatturato ? <Badge>fatturato</Badge> : <Badge tono="accento">da fatturare</Badge>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              chiave: "ticket",
              etichetta: "Ticket coperti",
              icona: <LifeBuoy size={13} />,
              conteggio: c.ticket.length,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border">
                    {c.ticket.length === 0 ? (
                      <div className="px-3 py-6 text-center text-md text-faint">
                        Nessun ticket collegato a questo contratto
                      </div>
                    ) : (
                      c.ticket.map((t) => (
                        <Link
                          key={t.id}
                          href={`/ticket/${t.id}`}
                          className="flex items-center gap-2 border-b border-border px-2 py-1.5 text-md last:border-0 hover:bg-[var(--alpha-lighter)]"
                        >
                          <span className="flex-none text-faint">#{t.numero}</span>
                          <span className="min-w-0 flex-1 truncate">{t.titolo}</span>
                          <span className="text-xs text-faint">{data(t.apertoIl)}</span>
                          <span className="w-14 flex-none text-right font-medium">{ore(t.ore)}</span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ),
            },
            {
              chiave: "documenti",
              etichetta: "Documenti",
              icona: <FileText size={13} />,
              conteggio: c.documenti.length,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border">
                    <DocumentiProgetto progettoId={c.id} entita="contratti" documenti={c.documenti} />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

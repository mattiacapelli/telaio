import Link from "next/link";
import { notFound } from "next/navigation";
import { getTicketCompleto, getPredefinitiTrasferta } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Chip, coloreDa } from "@/components/chip";
import { eur, eurCent, ore, data, dataEstesa, daGiorni } from "@/lib/format";
import { AvviaTimer } from "@/components/avvia-timer";
import { SezioneCampi, CampoRecord, Schede } from "@/components/record/pannello";
import { NoteOperative } from "@/components/record/note-operative";
import { DocumentiProgetto } from "@/components/documenti-progetto";
import { RegistraCosto, EliminaCosto, TIPI_COSTO } from "@/components/registra-costo";
import { ModificaTicket, CambiaStatoRapido, STATI_TICKET } from "@/components/record/azioni-operative";
import { EliminaRecord } from "@/components/elimina-record";
import {
  Clock, Calendar, Tag, FolderKanban, Building2, MessageSquare,
  AlertCircle, User, Euro, ShieldCheck, FileText,
} from "lucide-react";

export const dynamic = "force-dynamic";

const STATI: Record<string, string> = {
  APERTO: "Aperto",
  IN_LAVORAZIONE: "In lavorazione",
  ATTESA_CLIENTE: "Attesa cliente",
  RISOLTO: "Risolto",
  CHIUSO: "Chiuso",
};

const PRIORITA_IT: Record<string, string> = {
  BASSA: "Bassa",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export default async function TicketDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t, predefinitiTrasferta] = await Promise.all([
    getTicketCompleto(id),
    getPredefinitiTrasferta(),
  ]);
  if (!t) notFound();

  const chiuso = t.stato === "RISOLTO" || t.stato === "CHIUSO";
  const urgente = t.priorita === "ALTA" || t.priorita === "URGENTE";
  const giorniAperto = daGiorni(t.apertoIl) ?? 0;

  return (
    <div className="tl-in flex flex-col overflow-hidden rounded border border-border md:h-[calc(100vh-96px)] md:flex-row">
      <aside className="flex w-full flex-none flex-col overflow-y-auto border-b border-border bg-surface md:w-[300px] md:border-b-0 md:border-r">
        <div className="flex flex-col items-center gap-2 px-3 py-5">
          <div
            className="grid h-12 w-12 place-items-center rounded-md text-md font-semibold"
            style={{ background: `${coloreDa(t.titolo)}26`, color: coloreDa(t.titolo) }}
          >
            #{t.numero}
          </div>
          <div className="text-center">
            <h1 className="text-md font-semibold">{t.titolo}</h1>
            <div className="mt-0.5 text-xs text-faint">{t.cliente.ragioneSociale}</div>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            <Badge tono={chiuso ? "neutro" : "accento"}>{STATI[t.stato]}</Badge>
            <Badge tono={urgente && !chiuso ? "attenzione" : "neutro"}>
              {PRIORITA_IT[t.priorita]}
            </Badge>
            {!t.conContratto && <Badge>fuori contratto</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <ModificaTicket
              ticket={{
                id: t.id,
                titolo: t.titolo,
                descrizione: t.descrizione ?? "",
                stato: t.stato,
                priorita: t.priorita,
                conContratto: t.conContratto,
              }}
            />
            {!chiuso && (
              <AvviaTimer ticketId={t.id} etichetta={`#${t.numero} ${t.titolo}`} />
            )}
            <EliminaRecord
              entita="ticket"
              id={t.id}
              nome={`#${t.numero} ${t.titolo}`}
              dopoRedirect="/ticket"
              size="sm"
            />
          </div>
        </div>

        <div className="px-3 pb-1 text-md font-medium">Campi</div>

        <SezioneCampi titolo="Generale">
          <CampoRecord icona={<Tag size={12} />} etichetta="Stato">
            <CambiaStatoRapido entita="ticket" id={t.id} stato={t.stato} stati={STATI_TICKET} />
          </CampoRecord>
          <CampoRecord icona={<AlertCircle size={12} />} etichetta="Priorità">
            {PRIORITA_IT[t.priorita]}
          </CampoRecord>
          <CampoRecord icona={<Building2 size={12} />} etichetta="Cliente">
            <Link href={`/clienti/${t.cliente.id}`} className="flex items-center gap-1.5 hover:underline">
              <Chip testo={t.cliente.ragioneSociale} />
              <span className="truncate">{t.cliente.ragioneSociale}</span>
            </Link>
          </CampoRecord>
          <CampoRecord icona={<User size={12} />} etichetta="Referente" vuoto="Nessuno">
            {t.cliente.referente}
          </CampoRecord>
          <CampoRecord icona={<FolderKanban size={12} />} etichetta="Progetto" vuoto="Nessuno">
            {t.progetto && (
              <Link href={`/progetti/${t.progetto.id}`} className="truncate hover:underline">
                {t.progetto.nome}
              </Link>
            )}
          </CampoRecord>
          <CampoRecord icona={<ShieldCheck size={12} />} etichetta="Contratto" vuoto="Fuori contratto">
            {t.contratto && (
              <Link href={`/contratti/${t.contratto.id}`} className="truncate hover:underline">
                {t.contratto.numero}
              </Link>
            )}
          </CampoRecord>
        </SezioneCampi>

        <SezioneCampi titolo="Tempi e costi">
          <CampoRecord icona={<Clock size={12} />} etichetta="Ore">
            {ore(t.oreFatte)}
          </CampoRecord>
          <CampoRecord icona={<Clock size={12} />} etichetta="Ore fatturabili">
            {ore(t.oreFatturabili)}
            {t.oreNonFatturabili > 0 && (
              <span className="text-faint"> · {ore(t.oreNonFatturabili)} non fatt.</span>
            )}
          </CampoRecord>
          <CampoRecord icona={<Clock size={12} />} etichetta="Da fatturare">
            {ore(t.oreDaFatturare)}
          </CampoRecord>
          <CampoRecord icona={<Euro size={12} />} etichetta="Costi" vuoto="Nessuno">
            {t.costiTotali > 0 && (
              <>
                {eur(t.costiTotali)}
                {t.costiRimborsabili > 0 && (
                  <span className="text-faint"> · {eur(t.costiRimborsabili)} rimb.</span>
                )}
              </>
            )}
          </CampoRecord>
          <CampoRecord icona={<Euro size={12} />} etichetta="Valore lavoro">
            {eur(t.valoreLavorato)}
          </CampoRecord>
          <CampoRecord icona={<Euro size={12} />} etichetta="Tariffa">
            {eurCent(t.cliente.tariffaOraria)}
          </CampoRecord>
        </SezioneCampi>

        <SezioneCampi titolo="Date">
          <CampoRecord icona={<Calendar size={12} />} etichetta="Aperto">
            {dataEstesa(t.apertoIl)}
          </CampoRecord>
          <CampoRecord icona={<Clock size={12} />} etichetta="Da">
            {giorniAperto} giorn{giorniAperto === 1 ? "o" : "i"}
          </CampoRecord>
          <CampoRecord icona={<Calendar size={12} />} etichetta="Risolto" vuoto="Non risolto">
            {t.risoltoIl && dataEstesa(t.risoltoIl)}
          </CampoRecord>
        </SezioneCampi>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
        <Schede
          schede={[
            {
              chiave: "dettaglio",
              etichetta: "Dettaglio",
              icona: <FileText size={13} />,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border p-3">
                    <div className="mb-1 text-md font-medium">Descrizione</div>
                    {t.descrizione ? (
                      <div className="whitespace-pre-wrap text-md text-muted">
                        {t.descrizione}
                      </div>
                    ) : (
                      <div className="text-md text-faint">
                        Nessuna descrizione. Aggiungila con «Modifica».
                      </div>
                    )}
                  </div>

                  {t.conContratto && t.oreDaFatturare > 0 && (
                    <div
                      className="mt-3 flex items-start gap-1.5 rounded border px-2 py-1.5 text-md"
                      style={{
                        borderColor: "var(--neg)",
                        background: "var(--neg-soft)",
                        color: "var(--neg)",
                      }}
                    >
                      <AlertCircle size={12} className="mt-0.5 flex-none" />
                      <span>
                        {ore(t.oreDaFatturare)} risultano fatturabili, ma il ticket è
                        coperto da contratto. Segna le ore come non fatturabili, oppure
                        togli la copertura.
                      </span>
                    </div>
                  )}

                  {!t.conContratto && t.oreDaFatturare > 0 && (
                    <div
                      className="mt-3 flex items-center gap-1.5 rounded border px-2 py-1.5 text-md"
                      style={{
                        borderColor: "var(--pos)",
                        background: "var(--pos-soft)",
                        color: "var(--pos)",
                      }}
                    >
                      <Euro size={12} />
                      {ore(t.oreDaFatturare)} da fatturare · {eur(t.daFatturare)}
                    </div>
                  )}
                </div>
              ),
            },
            {
              chiave: "ore",
              etichetta: "Ore",
              icona: <Clock size={13} />,
              conteggio: t.registrazioni.length,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border">
                    {t.registrazioni.length === 0 ? (
                      <div className="px-3 py-6 text-center text-md text-faint">
                        Nessuna ora registrata su questo ticket.
                      </div>
                    ) : (
                      t.registrazioni.map((r) => (
                        <div key={r.id}
                          className="flex items-center gap-2 border-b border-border px-2 py-1.5 text-md last:border-0">
                          <span className="w-12 flex-none text-faint">{data(r.data)}</span>
                          <span className="min-w-0 flex-1 truncate">{r.descrizione ?? "—"}</span>
                          {r.fatturata ? <Badge>fatturata</Badge> : <Badge tono="accento">da fatturare</Badge>}
                          <span className="w-12 flex-none text-right font-medium">
                            {r.ore.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ),
            },
            {
              chiave: "costi",
              etichetta: "Costi",
              icona: <Euro size={13} />,
              conteggio: t.costi.length,
              contenuto: (
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-md text-muted">
                      {eur(t.costiTotali)} totali
                      {t.costiRimborsabili > 0 && ` · ${eur(t.costiRimborsabili)} da rimborsare`}
                    </span>
                    <div className="flex-1" />
                    <RegistraCosto ticketId={t.id} predefiniti={predefinitiTrasferta} />
                  </div>
                  <div className="rounded border border-border">
                    {t.costi.length === 0 ? (
                      <div className="px-3 py-6 text-center text-md text-faint">
                        Nessun costo registrato. Trasferte, materiali e spese
                        sostenute per questo ticket compaiono qui.
                      </div>
                    ) : (
                      t.costi.map((c) => {
                        const Icona = TIPI_COSTO[c.tipo]?.icona ?? Euro;
                        return (
                          <div
                            key={c.id}
                            className="group flex items-center gap-2 border-b border-border px-2 py-1.5 text-md last:border-0"
                          >
                            <Icona size={12} className="flex-none text-faint" />
                            <span className="w-12 flex-none text-faint">{data(c.data)}</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate">{c.descrizione}</div>
                              {c.quantita !== null && c.tariffa !== null && (
                                <div className="text-xs text-faint">
                                  {c.quantita.toLocaleString("it-IT")} km ×{" "}
                                  {eurCent(c.tariffa)}
                                </div>
                              )}
                            </div>
                            {c.fatturato ? (
                              <Badge>fatturato</Badge>
                            ) : c.rimborsabile ? (
                              <Badge tono="accento">da rimborsare</Badge>
                            ) : (
                              <Badge>a carico studio</Badge>
                            )}
                            <span className="w-16 flex-none text-right font-medium">
                              {eur(c.importo)}
                            </span>
                            {!c.fatturato && <EliminaCosto id={c.id} />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ),
            },
            {
              chiave: "documenti",
              etichetta: "Documenti",
              icona: <FileText size={13} />,
              conteggio: t.documenti.length,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border">
                    <DocumentiProgetto progettoId={t.id} entita="ticket" documenti={t.documenti} />
                  </div>
                </div>
              ),
            },
            {
              chiave: "note",
              etichetta: "Note",
              icona: <MessageSquare size={13} />,
              conteggio: t.note.length,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border">
                    <NoteOperative entita="ticket" id={t.id} note={t.note} />
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

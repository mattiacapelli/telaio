import Link from "next/link";
import { notFound } from "next/navigation";
import { getTicketCompleto } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Chip, coloreDa } from "@/components/chip";
import { eur, eurCent, ore, data, dataEstesa, daGiorni } from "@/lib/format";
import { AvviaTimer } from "@/components/avvia-timer";
import { SezioneCampi, CampoRecord, Schede } from "@/components/record/pannello";
import { NoteOperative } from "@/components/record/note-operative";
import { DocumentiProgetto } from "@/components/documenti-progetto";
import { ModificaTicket, CambiaStatoRapido, STATI_TICKET } from "@/components/record/azioni-operative";
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
  const t = await getTicketCompleto(id);
  if (!t) notFound();

  const chiuso = t.stato === "RISOLTO" || t.stato === "CHIUSO";
  const urgente = t.priorita === "ALTA" || t.priorita === "URGENTE";
  const giorniAperto = daGiorni(t.apertoIl) ?? 0;

  return (
    <div className="tl-in flex h-[calc(100vh-96px)] overflow-hidden rounded border border-border">
      <aside className="flex w-[300px] flex-none flex-col overflow-y-auto border-r border-border bg-surface">
        <div className="flex flex-col items-center gap-2 px-3 py-5">
          <div
            className="grid h-12 w-12 place-items-center rounded-md text-xs font-semibold"
            style={{ background: `${coloreDa(t.titolo)}26`, color: coloreDa(t.titolo) }}
          >
            #{t.numero}
          </div>
          <div className="text-center">
            <h1 className="text-md font-semibold">{t.titolo}</h1>
            <div className="mt-0.5 text-xxs text-faint">{t.cliente.ragioneSociale}</div>
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
          </div>
        </div>

        <div className="px-3 pb-1 text-xs font-medium">Campi</div>

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
          <CampoRecord icona={<Clock size={12} />} etichetta="Da fatturare">
            {ore(t.oreDaFatturare)}
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

      <div className="flex min-w-0 flex-1 flex-col bg-bg">
        <Schede
          schede={[
            {
              chiave: "dettaglio",
              etichetta: "Dettaglio",
              icona: <FileText size={13} />,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border p-3">
                    <div className="mb-1 text-xs font-medium">Descrizione</div>
                    {t.descrizione ? (
                      <div className="whitespace-pre-wrap text-xs text-muted">
                        {t.descrizione}
                      </div>
                    ) : (
                      <div className="text-xs text-faint">
                        Nessuna descrizione. Aggiungila con «Modifica».
                      </div>
                    )}
                  </div>

                  {t.conContratto && t.oreDaFatturare > 0 && (
                    <div
                      className="mt-3 flex items-start gap-1.5 rounded border px-2 py-1.5 text-xs"
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
                      className="mt-3 flex items-center gap-1.5 rounded border px-2 py-1.5 text-xs"
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
                      <div className="px-3 py-6 text-center text-xs text-faint">
                        Nessuna ora registrata su questo ticket.
                      </div>
                    ) : (
                      t.registrazioni.map((r) => (
                        <div key={r.id}
                          className="flex items-center gap-2 border-b border-border px-2 py-1.5 text-xs last:border-0">
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

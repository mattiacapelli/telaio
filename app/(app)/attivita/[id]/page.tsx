import Link from "next/link";
import { notFound } from "next/navigation";
import { getAttivitaCompleta } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Barra } from "@/components/ui-legacy";
import { Chip, coloreDa } from "@/components/chip";
import { eur, ore, data, dataEstesa } from "@/lib/format";
import { AvviaTimer } from "@/components/avvia-timer";
import { SezioneCampi, CampoRecord, Schede } from "@/components/record/pannello";
import { NoteOperative } from "@/components/record/note-operative";
import { ModificaAttivita, CambiaStatoRapido, STATI_ATTIVITA } from "@/components/record/azioni-operative";
import {
  Clock, Calendar, Tag, FolderKanban, Building2, MessageSquare,
  TrendingUp, AlertTriangle, CircleCheck, Euro,
} from "lucide-react";

export const dynamic = "force-dynamic";

const STATI: Record<string, string> = {
  DA_FARE: "Da fare",
  IN_CORSO: "In corso",
  BLOCCATA: "Bloccata",
  FATTA: "Fatta",
};

export default async function AttivitaDettaglioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await getAttivitaCompleta(id);
  if (!a) notFound();

  const oltre = a.stimaOre > 0 && a.oreFatte > a.stimaOre;
  const iniziale = a.titolo.trim()[0]?.toUpperCase() ?? "A";

  return (
    <div className="tl-in flex h-[calc(100vh-96px)] overflow-hidden rounded border border-border">
      <aside className="flex w-[300px] flex-none flex-col overflow-y-auto border-r border-border bg-surface">
        <div className="flex flex-col items-center gap-2 px-3 py-5">
          <div
            className="grid h-12 w-12 place-items-center rounded-md text-md font-semibold"
            style={{ background: `${coloreDa(a.titolo)}26`, color: coloreDa(a.titolo) }}
          >
            {iniziale}
          </div>
          <div className="text-center">
            <h1 className="text-md font-semibold">{a.titolo}</h1>
            {a.progetto && (
              <div className="mt-0.5 text-xs text-faint">{a.progetto.nome}</div>
            )}
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            <Badge tono={a.stato === "IN_CORSO" ? "accento" : "neutro"}>
              {STATI[a.stato]}
            </Badge>
            {oltre && <Badge tono="attenzione">oltre la stima</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <ModificaAttivita
              attivita={{
                id: a.id,
                titolo: a.titolo,
                stato: a.stato,
                stimaOre: a.stimaOre,
                scadenzaIl: a.scadenzaIl ? new Date(a.scadenzaIl).toISOString().slice(0, 10) : "",
                bloccoNota: a.bloccoNota ?? "",
              }}
            />
            {a.stato !== "FATTA" && <AvviaTimer attivitaId={a.id} etichetta={a.titolo} />}
          </div>
        </div>

        <div className="px-3 pb-1 text-md font-medium">Campi</div>

        <SezioneCampi titolo="Generale">
          <CampoRecord icona={<Tag size={12} />} etichetta="Stato">
            <CambiaStatoRapido entita="attivita" id={a.id} stato={a.stato} stati={STATI_ATTIVITA} />
          </CampoRecord>
          <CampoRecord icona={<FolderKanban size={12} />} etichetta="Progetto" vuoto="Interna">
            {a.progetto && (
              <Link href={`/progetti/${a.progetto.id}`} className="truncate hover:underline">
                {a.progetto.nome}
              </Link>
            )}
          </CampoRecord>
          <CampoRecord icona={<Building2 size={12} />} etichetta="Cliente" vuoto="—">
            {a.progetto && (
              <Link href={`/clienti/${a.progetto.clienteId}`} className="flex items-center gap-1.5 hover:underline">
                <Chip testo={a.progetto.cliente} />
                <span className="truncate">{a.progetto.cliente}</span>
              </Link>
            )}
          </CampoRecord>
          {a.bloccoNota && (
            <CampoRecord icona={<AlertTriangle size={12} />} etichetta="Blocco">
              <span className="text-neg">{a.bloccoNota}</span>
            </CampoRecord>
          )}
        </SezioneCampi>

        <SezioneCampi titolo="Tempi">
          <CampoRecord icona={<Clock size={12} />} etichetta="Ore">
            <span className={oltre ? "text-neg" : undefined}>
              {ore(a.oreFatte)} / {ore(a.stimaOre)}
            </span>
          </CampoRecord>
          <CampoRecord icona={<Clock size={12} />} etichetta="Da fatturare">
            {ore(a.oreDaFatturare)}
          </CampoRecord>
          <CampoRecord icona={<Euro size={12} />} etichetta="Valore lavoro">
            {eur(a.valoreLavorato)}
          </CampoRecord>
          <CampoRecord icona={<Calendar size={12} />} etichetta="Scadenza" vuoto="Non definita">
            {a.scadenzaIl && data(a.scadenzaIl)}
          </CampoRecord>
          <CampoRecord icona={<CircleCheck size={12} />} etichetta="Completata" vuoto="In corso">
            {a.completataIl && dataEstesa(a.completataIl)}
          </CampoRecord>
        </SezioneCampi>

        <SezioneCampi titolo="Sistema" apertaDiDefault={false}>
          <CampoRecord icona={<Calendar size={12} />} etichetta="Creata">
            {dataEstesa(a.createdAt)}
          </CampoRecord>
        </SezioneCampi>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-bg">
        <Schede
          schede={[
            {
              chiave: "ore",
              etichetta: "Ore",
              icona: <Clock size={13} />,
              conteggio: a.registrazioni.length,
              contenuto: (
                <div className="p-4">
                  {a.stimaOre > 0 && (
                    <div className="mb-4">
                      <div className="mb-2 flex items-baseline gap-2">
                        <span className="text-lg font-semibold">{ore(a.oreFatte)}</span>
                        <span className="text-md text-muted">su {ore(a.stimaOre)}</span>
                        <div className="flex-1" />
                        <span className={`text-md ${oltre ? "text-neg" : "text-muted"}`}>
                          {Math.round((a.oreFatte / a.stimaOre) * 100)}%
                        </span>
                      </div>
                      <Barra valore={a.oreFatte} max={a.stimaOre} />
                    </div>
                  )}
                  <div className="rounded border border-border">
                    {a.registrazioni.length === 0 ? (
                      <div className="px-3 py-6 text-center text-md text-faint">
                        Nessuna ora registrata. Avvia il timer per iniziare.
                      </div>
                    ) : (
                      a.registrazioni.map((r) => (
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
              chiave: "note",
              etichetta: "Note",
              icona: <MessageSquare size={13} />,
              conteggio: a.note.length,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border">
                    <NoteOperative entita="attivita" id={a.id} note={a.note} />
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

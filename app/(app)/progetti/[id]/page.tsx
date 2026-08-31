import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgettoCompleto } from "@/lib/queries";
import { titoloPagina, nomeRecord } from "@/lib/titolo";
import { Badge } from "@/components/ui/badge";
import { Barra } from "@/components/ui-legacy";
import { Chip, coloreDa } from "@/components/chip";
import { eur, eurCent, ore, data } from "@/lib/format";
import { AvviaTimer } from "@/components/avvia-timer";
import { DocumentiProgetto, NoteProgetto } from "@/components/documenti-progetto";
import {
  ModificaProgetto, NuovaAttivita, NuovaMilestone,
  SpuntaAttivita, SpuntaMilestone, FatturaProgetto,
} from "@/components/azioni-progetto";
import { ProblemiProgetto } from "@/components/problemi-progetto";
import { TimelineProgetto } from "@/components/timeline-progetto";
import { GithubProgetto } from "@/components/github-progetto";
import { EliminaRecord } from "@/components/elimina-record";
import { SezioneCampi, CampoRecord, Schede } from "@/components/record/pannello";
import { attivitaRepo } from "@/lib/github";
import {
  Monitor, CircleCheck, FileText, MessageSquare, AlertTriangle, GitCommit,
  Building2, User, Euro, Clock, Calendar, Tag, Flag, LifeBuoy, Receipt,
  TrendingUp, Wallet, Hash,
} from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const nome = await nomeRecord("progetto", id);
  return { title: await titoloPagina(nome ?? "Progetto") };
}

const STATI: Record<string, string> = {
  DA_AVVIARE: "Da avviare",
  IN_CORSO: "In corso",
  IN_PAUSA: "In pausa",
  CONCLUSO: "Concluso",
};

const STATI_ATTIVITA: Record<string, string> = {
  DA_FARE: "Da fare",
  IN_CORSO: "In corso",
  BLOCCATA: "Bloccata",
  FATTA: "Fatta",
};

export default async function ProgettoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getProgettoCompleto(id);
  if (!p) notFound();

  const github = p.repoGithub ? await attivitaRepo(p.repoGithub, p.branchGithub) : null;

  const oltreBudget = p.oreFatte > p.budgetOre;
  const fatte = p.attivita.filter((a) => a.stato === "FATTA").length;
  const bloccate = p.attivita.filter((a) => a.stato === "BLOCCATA");
  const ticketAperti = p.ticket.filter((t) => t.stato !== "RISOLTO" && t.stato !== "CHIUSO");
  const maxOre = Math.max(...p.settimane.map((s) => s.ore), 1);
  const iniziale = p.nome.trim()[0]?.toUpperCase() ?? "P";

  return (
    <div className="tl-in flex flex-col overflow-hidden rounded border border-border md:h-[calc(100vh-96px)] md:flex-row md:gap-0">
      {/* ---------------------------------------------- colonna dei campi */}
      <aside className="flex w-full flex-none flex-col overflow-y-auto border-b border-border bg-surface md:w-[300px] md:border-b-0 md:border-r">
        <div className="flex flex-col items-center gap-2 px-3 py-5">
          <div
            className="grid h-12 w-12 place-items-center rounded-md text-md font-semibold"
            style={{
              background: `${coloreDa(p.nome)}26`,
              color: coloreDa(p.nome),
            }}
          >
            {iniziale}
          </div>
          <div className="text-center">
            <h1 className="text-md font-semibold">{p.nome}</h1>
            <div className="mt-0.5 text-xs text-faint">
              {p.cliente?.ragioneSociale ?? "Progetto interno"}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            <Badge tono={p.stato === "IN_CORSO" ? "accento" : "neutro"}>
              {STATI[p.stato]}
            </Badge>
            {!p.cliente && <Badge>interno</Badge>}
            {oltreBudget && <Badge tono="attenzione">budget superato</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <ModificaProgetto
              progetto={{
                id: p.id,
                nome: p.nome,
                valore: p.valore,
                budgetOre: p.budgetOre,
                inizioIl: p.inizioIl ? new Date(p.inizioIl).toISOString().slice(0, 10) : "",
                consegnaIl: p.consegnaIl ? new Date(p.consegnaIl).toISOString().slice(0, 10) : "",
                note: p.note ?? "",
                repoGithub: p.repoGithub ?? "",
                branchGithub: p.branchGithub ?? "",
              }}
            />
            <NuovaAttivita progettoId={p.id} />
            <EliminaRecord
              entita="progetto"
              id={p.id}
              nome={p.nome}
              dopoRedirect="/progetti"
              size="sm"
            />
          </div>
        </div>

        <div className="px-3 pb-1 text-md font-medium">Campi</div>

        <SezioneCampi titolo="Generale">
          <CampoRecord icona={<Building2 size={12} />} etichetta="Cliente" vuoto="Progetto interno">
            {p.cliente && (
              <Link href={`/clienti/${p.cliente.id}`} className="flex items-center gap-1.5 hover:underline">
                <Chip testo={p.cliente.ragioneSociale} />
                <span className="truncate">{p.cliente.ragioneSociale}</span>
              </Link>
            )}
          </CampoRecord>
          {p.cliente && (
            <CampoRecord icona={<User size={12} />} etichetta="Referente" vuoto="Nessun referente">
              {p.cliente.referente}
            </CampoRecord>
          )}
          <CampoRecord icona={<Tag size={12} />} etichetta="Stato">
            {STATI[p.stato]}
          </CampoRecord>
          <CampoRecord icona={<FileText size={12} />} etichetta="Preventivo" vuoto="Nessuno">
            {p.preventivo && (
              <Link href={`/preventivi/${p.preventivo.id}`} className="hover:underline">
                {p.preventivo.numero}
              </Link>
            )}
          </CampoRecord>
        </SezioneCampi>

        <SezioneCampi titolo="Economia">
          <CampoRecord icona={<Euro size={12} />} etichetta="Valore">
            {eur(p.valore)}
          </CampoRecord>
          <CampoRecord icona={<TrendingUp size={12} />} etichetta="Lavoro svolto">
            {eur(p.valoreLavorato)}
          </CampoRecord>
          <CampoRecord icona={<Wallet size={12} />} etichetta="Margine">
            <span className={p.margine < 0 ? "text-neg" : undefined}>
              {eur(p.margine)}
            </span>
          </CampoRecord>
          <CampoRecord icona={<Receipt size={12} />} etichetta="Da fatturare">
            {eur(p.daFatturare)}
          </CampoRecord>
          {p.cliente && (
            <CampoRecord icona={<Hash size={12} />} etichetta="Tariffa">
              {eurCent(p.cliente.tariffaOraria)}
            </CampoRecord>
          )}
        </SezioneCampi>

        <SezioneCampi titolo="Tempi">
          <CampoRecord icona={<Clock size={12} />} etichetta="Ore">
            <span className={oltreBudget ? "text-neg" : undefined}>
              {ore(p.oreFatte)} / {ore(p.budgetOre)}
            </span>
          </CampoRecord>
          <CampoRecord icona={<Clock size={12} />} etichetta="Fatturate">
            {ore(p.oreFatturate)}
          </CampoRecord>
          <CampoRecord icona={<Calendar size={12} />} etichetta="Inizio" vuoto="Non definito">
            {p.inizioIl && data(p.inizioIl)}
          </CampoRecord>
          <CampoRecord icona={<Calendar size={12} />} etichetta="Consegna" vuoto="Non definita">
            {p.consegnaIl && data(p.consegnaIl)}
          </CampoRecord>
        </SezioneCampi>

        <SezioneCampi titolo="Sistema" apertaDiDefault={false}>
          <CampoRecord icona={<GitCommit size={12} />} etichetta="Repository" vuoto="Non collegata">
            {p.repoGithub && (
              <a
                href={`https://github.com/${p.repoGithub}`}
                target="_blank"
                rel="noopener"
                className="truncate hover:underline"
              >
                {p.repoGithub}
              </a>
            )}
          </CampoRecord>
          <CampoRecord icona={<GitCommit size={12} />} etichetta="Branch" vuoto="Predefinito">
            {p.branchGithub}
          </CampoRecord>
          <CampoRecord icona={<MessageSquare size={12} />} etichetta="Note" vuoto="Nessuna nota">
            {p.note}
          </CampoRecord>
        </SezioneCampi>

        <div className="p-3">
          <FatturaProgetto progettoId={p.id} oreDaFatturare={p.oreDaFatturare} />
        </div>
      </aside>

      {/* ------------------------------------------------------- schede */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
        <Schede
          schede={[
            {
              chiave: "diario",
              etichetta: "Diario",
              icona: <Monitor size={13} />,
              contenuto: <TimelineProgetto eventi={p.eventi} />,
            },
            {
              chiave: "avanzamento",
              etichetta: "Avanzamento",
              icona: <TrendingUp size={13} />,
              contenuto: (
                <div className="flex flex-col gap-4 p-4">
                  {(oltreBudget || bloccate.length > 0 || p.problemiAperti > 0 || p.oreDaFatturare > 0) && (
                    <div className="flex flex-wrap gap-2">
                      {oltreBudget && (
                        <Segnale tono="neg" icona={<AlertTriangle size={12} />}
                          testo={`Budget superato di ${ore(p.oreFatte - p.budgetOre)}`} />
                      )}
                      {bloccate.length > 0 && (
                        <Segnale tono="neg" icona={<AlertTriangle size={12} />}
                          testo={`${bloccate.length} attività bloccat${bloccate.length === 1 ? "a" : "e"}`} />
                      )}
                      {p.problemiAperti > 0 && (
                        <Segnale tono="neg" icona={<AlertTriangle size={12} />}
                          testo={`${p.problemiAperti} criticità apert${p.problemiAperti === 1 ? "a" : "e"}`} />
                      )}
                      {p.oreDaFatturare > 0 && (
                        <Segnale tono="pos" icona={<TrendingUp size={12} />}
                          testo={`${ore(p.oreDaFatturare)} da fatturare · ${eur(p.daFatturare)}`} />
                      )}
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-baseline gap-2">
                      <span className="text-lg font-semibold">{ore(p.oreFatte)}</span>
                      <span className="text-md text-muted">su {ore(p.budgetOre)}</span>
                      <div className="flex-1" />
                      <span className={`text-md ${oltreBudget ? "text-neg" : "text-muted"}`}>
                        {Math.round(p.budgetOre > 0 ? (p.oreFatte / p.budgetOre) * 100 : 0)}%
                      </span>
                    </div>
                    <Barra valore={p.oreFatte} max={p.budgetOre} />
                  </div>

                  <div>
                    <div className="mb-2 text-md font-medium">Ore per settimana</div>
                    <div className="flex h-24 items-end gap-1.5">
                      {p.settimane.map((s, i) => (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          <div className="flex h-20 w-full items-end">
                            <div
                              title={`${s.etichetta}: ${ore(s.ore)}`}
                              className="w-full rounded-t bg-accent"
                              style={{
                                height: `${(s.ore / maxOre) * 100}%`,
                                minHeight: s.ore > 0 ? 3 : 0,
                                opacity: s.ore > 0 ? 1 : 0.15,
                              }}
                            />
                          </div>
                          <span className="text-xs text-faint">{s.etichetta}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 text-md font-medium">Ore registrate</div>
                    <div className="rounded border border-border">
                      {p.registrazioni.length === 0 ? (
                        <div className="px-3 py-5 text-center text-md text-faint">
                          Nessuna ora registrata
                        </div>
                      ) : (
                        p.registrazioni.map((r) => (
                          <div key={r.id}
                            className="flex items-center gap-2 border-b border-border px-2 py-1.5 text-md last:border-0">
                            <span className="w-12 flex-none text-faint">{data(r.data)}</span>
                            <span className="min-w-0 flex-1 truncate">{r.descrizione}</span>
                            {r.fatturata ? <Badge>fatturata</Badge> : <Badge tono="accento">da fatturare</Badge>}
                            <span className="w-12 flex-none text-right font-medium">
                              {r.ore.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              chiave: "attivita",
              etichetta: "Attività",
              icona: <CircleCheck size={13} />,
              conteggio: p.attivita.length,
              contenuto: (
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-md text-muted">{fatte}/{p.attivita.length} completate</span>
                    <div className="flex-1" />
                    <NuovaAttivita progettoId={p.id} />
                  </div>
                  <div className="rounded border border-border">
                    {p.attivita.length === 0 ? (
                      <div className="px-3 py-6 text-center text-md text-faint">Nessuna attività</div>
                    ) : (
                      p.attivita.map((a) => (
                        <div key={a.id}
                          className="flex items-center gap-2 border-b border-border px-2 py-1.5 last:border-0">
                          <SpuntaAttivita id={a.id} fatta={a.stato === "FATTA"} />
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/attivita/${a.id}`}
                              className={`block truncate text-md hover:underline ${a.stato === "FATTA" ? "text-muted line-through" : ""}`}
                            >
                              {a.titolo}
                            </Link>
                            <div className="text-xs text-faint">
                              {a.oreFatte.toLocaleString("it-IT", { maximumFractionDigits: 2 })}/
                              {a.stimaOre.toLocaleString("it-IT")} h
                              {a.scadenzaIl && ` · ${data(a.scadenzaIl)}`}
                              {a.bloccoNota && ` · ${a.bloccoNota}`}
                            </div>
                          </div>
                          {a.stimaOre > 0 && (
                            <div className="w-16 flex-none"><Barra valore={a.oreFatte} max={a.stimaOre} /></div>
                          )}
                          <Badge tono={a.stato === "IN_CORSO" ? "accento" : "neutro"}>
                            {STATI_ATTIVITA[a.stato]}
                          </Badge>
                          {a.stato !== "FATTA" && <AvviaTimer attivitaId={a.id} etichetta={a.titolo} />}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-4 mb-2 flex items-center gap-2">
                    <span className="text-md font-medium">Milestone</span>
                    <div className="flex-1" />
                    <NuovaMilestone progettoId={p.id} />
                  </div>
                  <div className="rounded border border-border">
                    {p.milestone.length === 0 ? (
                      <div className="px-3 py-5 text-center text-md text-faint">Nessuna milestone</div>
                    ) : (
                      p.milestone.map((m) => (
                        <div key={m.id}
                          className="flex items-center gap-2 border-b border-border px-2 py-1.5 last:border-0">
                          <SpuntaMilestone id={m.id} completata={m.completata} />
                          <Flag size={12} className="flex-none text-faint" />
                          <span className={`flex-1 text-md ${m.completata ? "text-muted line-through" : ""}`}>
                            {m.titolo}
                          </span>
                          <span className="text-xs text-faint">{data(m.scadenzaIl)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {ticketAperti.length > 0 && (
                    <>
                      <div className="mb-2 mt-4 text-md font-medium">Ticket aperti</div>
                      <div className="rounded border border-border">
                        {ticketAperti.map((t) => (
                          <div key={t.id}
                            className="flex items-center gap-2 border-b border-border px-2 py-1.5 text-md last:border-0">
                            <LifeBuoy size={12} className="flex-none text-faint" />
                            <span className="text-faint">#{t.numero}</span>
                            <Link href={`/ticket/${t.id}`} className="min-w-0 flex-1 truncate hover:underline">
                              {t.titolo}
                            </Link>
                            <span className="text-xs text-faint">{data(t.apertoIl)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ),
            },
            {
              chiave: "criticita",
              etichetta: "Criticità",
              icona: <AlertTriangle size={13} />,
              conteggio: p.problemiAperti,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border">
                    <ProblemiProgetto progettoId={p.id} problemi={p.problemi} />
                  </div>
                </div>
              ),
            },
            {
              chiave: "documenti",
              etichetta: "Documenti",
              icona: <FileText size={13} />,
              conteggio: p.documenti.length,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border">
                    <DocumentiProgetto progettoId={p.id} documenti={p.documenti} />
                  </div>
                </div>
              ),
            },
            {
              chiave: "note",
              etichetta: "Note",
              icona: <MessageSquare size={13} />,
              conteggio: p.noteProgetto.length,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border">
                    <NoteProgetto progettoId={p.id} note={p.noteProgetto} />
                  </div>
                </div>
              ),
            },
            ...(github && p.repoGithub
              ? [{
                  chiave: "github",
                  etichetta: "Codice",
                  icona: <GitCommit size={13} />,
                  contenuto: (
                    <div className="p-4">
                      <div className="rounded border border-border">
                        <GithubProgetto repo={p.repoGithub} attivita={github} />
                      </div>
                    </div>
                  ),
                }]
              : []),
          ]}
        />
      </div>
    </div>
  );
}

function Segnale({
  tono,
  icona,
  testo,
}: {
  tono: "neg" | "pos";
  icona: React.ReactNode;
  testo: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded border px-2 py-1 text-md"
      style={{
        borderColor: `var(--${tono})`,
        background: `var(--${tono}-soft)`,
        color: `var(--${tono})`,
      }}
    >
      {icona}
      {testo}
    </div>
  );
}

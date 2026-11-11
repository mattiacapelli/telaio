import {
  ETICHETTE_AMBIENTE,
  ETICHETTE_CATEGORIA,
  ETICHETTE_PRIORITA,
  ETICHETTE_STATO_PROGETTO,
  ETICHETTE_STATO_TICKET,
  ETICHETTE_TIPO_RISORSA,
  STATI_TICKET,
  type TipoRisorsa,
  urlRisorsaValido,
} from "@telaio/core";
import {
  and,
  asc,
  clientiRef,
  documentiDelProgetto,
  eq,
  getDb,
  isNull,
  preventivi,
  progetti,
  progettoRisorse,
  sql,
  ticket,
  users,
} from "@telaio/db";
import {
  Activity,
  BookText,
  ExternalLink,
  FlaskConical,
  GitBranch,
  Globe,
  Link2,
  type LucideIcon,
  Palette,
  Server,
  Star,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AllegaDocumenti } from "@/components/domain/allega-documenti";
import { ElencoDocumenti, rigaDocumento } from "@/components/domain/elenco-documenti";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { DefList } from "@/components/ui/def-list";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { leggiArchivio } from "@/lib/archivio/config";
import { formatData } from "@/lib/date";
import { PRIORITA_PROGETTO, STATO_PREVENTIVO, STATO_PROGETTO, STATO_TICKET } from "@/lib/stati";
import { AggiungiRisorsa, CambiaStato, EliminaRisorsa, ModificaRisorsa } from "./modali";

export const metadata = { title: "Progetto" };
export const dynamic = "force-dynamic";

const ICONE: Record<TipoRisorsa, LucideIcon> = {
  repository: GitBranch,
  design: Palette,
  production: Globe,
  staging: FlaskConical,
  documentation: BookText,
  infrastructure: Server,
  monitoring: Activity,
  other: Link2,
};

/** Indirizzo web di Twenty ricavato da TWENTY_API_URL (stesso dominio); assente se non configurato. */
function urlOpportunita(id: string): string | null {
  const base = process.env.TWENTY_API_URL;
  if (!base) return null;
  try {
    return `${new URL(base).origin}/object/opportunity/${encodeURIComponent(id)}`;
  } catch {
    return null;
  }
}

const dataOra = (d: Date) =>
  `${formatData(d.toISOString())} ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;

export default async function ProgettoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [riga] = await db
    .select({
      p: progetti,
      cliente: clientiRef.nome,
      clienteTwentyId: clientiRef.twentyCompanyId,
      responsabile: users.name,
    })
    .from(progetti)
    .leftJoin(clientiRef, eq(clientiRef.id, progetti.clienteRefId))
    .leftJoin(users, eq(users.id, progetti.responsabileId))
    .where(and(eq(progetti.id, id), isNull(progetti.deletedAt)));
  if (!riga) notFound();
  const { p } = riga;
  const [risorse, [prev], documenti, perStato, archivio] = await Promise.all([
    db
      .select()
      .from(progettoRisorse)
      .where(eq(progettoRisorse.progettoId, id))
      .orderBy(asc(progettoRisorse.ordine)),
    p.preventivoId
      ? db
          .select({
            id: preventivi.id,
            numero: preventivi.numero,
            oggetto: preventivi.oggetto,
            stato: preventivi.stato,
            opportunitaId: preventivi.twentyOpportunityId,
          })
          .from(preventivi)
          .where(eq(preventivi.id, p.preventivoId))
      : Promise.resolve([]),
    documentiDelProgetto(db, id),
    db
      .select({ stato: ticket.stato, n: sql<number>`count(*)::int` })
      .from(ticket)
      .where(and(eq(ticket.progettoId, id), isNull(ticket.deletedAt)))
      .groupBy(ticket.stato),
    leggiArchivio(db),
  ]);
  const nTicket = (s: string) => perStato.find((r) => r.stato === s)?.n ?? 0;
  const totaleTicket = perStato.reduce((somma, r) => somma + r.n, 0);
  const stato = STATO_PROGETTO[p.stato];
  const priorita = PRIORITA_PROGETTO[p.priorita];
  const principali = [...risorse].sort((a, b) => Number(b.principale) - Number(a.principale));
  const urlOpp = prev?.opportunitaId ? urlOpportunita(prev.opportunitaId) : null;
  const statoPrev = prev ? STATO_PREVENTIVO[prev.stato] : null;

  return (
    <>
      <PageHeader
        titolo={`${p.codice} · ${p.nome}`}
        descrizione={
          riga.cliente ? (
            riga.clienteTwentyId ? (
              <Link href={`/clienti/${riga.clienteTwentyId}`} className="hover:underline">
                {riga.cliente}
              </Link>
            ) : (
              riga.cliente
            )
          ) : (
            "Nessun cliente assegnato"
          )
        }
        stato={
          <span className="flex flex-wrap gap-1.5">
            <Badge variant={stato?.variante} dot>
              {stato?.label}
            </Badge>
            <Badge variant={priorita?.variante}>Priorità {priorita?.label.toLowerCase()}</Badge>
          </span>
        }
        azioni={
          <>
            <Button asChild variant="secondary">
              <Link href={`/progetti/${p.id}/ticket`}>Ticket</Link>
            </Button>
            <CambiaStato id={p.id} stato={p.stato} />
            <Button asChild>
              <Link href={`/progetti/${p.id}/modifica`}>Modifica</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader
              title="Risorse e collegamenti"
              description="Repository, design, ambienti, documentazione. Niente password o token."
              action={<AggiungiRisorsa progettoId={p.id} />}
            />
            {principali.length === 0 ? (
              <EmptyState title="Nessuna risorsa">
                Aggiungi il repository, il design o l'indirizzo degli ambienti per averli sempre a
                portata di mano.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {principali.map((r) => {
                  const Icona = ICONE[r.tipo];
                  const sicuro = urlRisorsaValido(r.url);
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-subtle text-fg-2">
                        <Icona className="size-4" aria-hidden />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                          {r.titolo}
                          {r.principale && (
                            <Badge variant="brand">
                              <Star className="size-3" aria-hidden /> Principale
                            </Badge>
                          )}
                          <Badge>{ETICHETTE_TIPO_RISORSA[r.tipo]}</Badge>
                          {r.ambiente && (
                            <Badge variant="warn">{ETICHETTE_AMBIENTE[r.ambiente]}</Badge>
                          )}
                        </span>
                        {r.descrizione && (
                          <span className="text-sm text-fg-2">{r.descrizione}</span>
                        )}
                        <span className="truncate text-xs text-fg-3">{r.url}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {sicuro && (
                          <Button asChild variant="ghost" size="icon">
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Apri ${r.titolo}`}
                            >
                              <ExternalLink />
                            </a>
                          </Button>
                        )}
                        <ModificaRisorsa
                          risorsa={{
                            id: r.id,
                            tipo: r.tipo,
                            titolo: r.titolo,
                            url: r.url,
                            descrizione: r.descrizione ?? "",
                            ambiente: r.ambiente ?? "",
                            principale: r.principale,
                          }}
                        />
                        <EliminaRisorsa id={r.id} titolo={r.titolo} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Ticket"
              description={
                totaleTicket
                  ? `${totaleTicket} in totale`
                  : "Attività, bug e richieste del progetto"
              }
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/progetti/${p.id}/ticket`}>Apri la lavagna</Link>
                </Button>
              }
            />
            {totaleTicket === 0 ? (
              <EmptyState title="Nessun ticket">
                Apri la lavagna per creare il primo e seguirne l&apos;avanzamento per colonne.
              </EmptyState>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {STATI_TICKET.map((s) => (
                  <li key={s}>
                    <Badge variant={STATO_TICKET[s]?.variante} dot>
                      {ETICHETTE_STATO_TICKET[s]} · {nTicket(s)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Documenti e link"
              description="Contratti, specifiche, consegne: i file stanno nel bucket S3 configurato in Impostazioni; puoi anche allegare link."
            />
            <div className="flex flex-col gap-4">
              {documenti.length > 0 ? (
                <ElencoDocumenti
                  documenti={documenti.map(({ d, caricatoDa }) => rigaDocumento(d, caricatoDa))}
                />
              ) : (
                <p className="text-sm text-fg-2">Nessun documento o link.</p>
              )}
              <AllegaDocumenti
                destinazione={{ progettoId: p.id }}
                configurato={!!archivio.config}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Descrizione" />
            {p.descrizione ? (
              <p className="text-sm whitespace-pre-line text-fg">{p.descrizione}</p>
            ) : (
              <p className="text-sm text-fg-2">Nessuna descrizione.</p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Panoramica" />
            <DefList
              voci={[
                { etichetta: "Categoria", valore: ETICHETTE_CATEGORIA[p.categoria] },
                { etichetta: "Responsabile", valore: riga.responsabile ?? "—" },
                { etichetta: "Stato", valore: ETICHETTE_STATO_PROGETTO[p.stato] },
                { etichetta: "Priorità", valore: ETICHETTE_PRIORITA[p.priorita] },
                {
                  etichetta: "Inizio previsto",
                  valore: formatData(p.dataInizioPrevista),
                  numerico: true,
                },
                {
                  etichetta: "Fine prevista",
                  valore: formatData(p.dataFinePrevista),
                  numerico: true,
                },
                {
                  etichetta: "Inizio effettivo",
                  valore: formatData(p.dataInizioEffettiva),
                  numerico: true,
                },
                {
                  etichetta: "Fine effettiva",
                  valore: formatData(p.dataFineEffettiva),
                  numerico: true,
                },
                { etichetta: "Creato il", valore: dataOra(p.createdAt), numerico: true },
                { etichetta: "Aggiornato il", valore: dataOra(p.updatedAt), numerico: true },
              ]}
            />
          </Card>

          <Card>
            <CardHeader
              title="Riferimenti commerciali"
              description="I dati economici restano nel preventivo"
            />
            <DefList
              voci={[
                {
                  etichetta: "Cliente",
                  valore: riga.cliente ? (
                    riga.clienteTwentyId ? (
                      <Link href={`/clienti/${riga.clienteTwentyId}`} className="hover:underline">
                        {riga.cliente}
                      </Link>
                    ) : (
                      riga.cliente
                    )
                  ) : (
                    "—"
                  ),
                },
                {
                  etichetta: "Preventivo",
                  valore: prev ? (
                    <span className="flex flex-col items-end gap-1">
                      <Link href={`/preventivi/${prev.id}`} className="hover:underline">
                        {prev.numero ?? "Bozza"} · {prev.oggetto}
                      </Link>
                      {statoPrev && <Tag tone={statoPrev.tone}>{statoPrev.label}</Tag>}
                    </span>
                  ) : (
                    "Nessuno"
                  ),
                },
                ...(prev?.opportunitaId
                  ? [
                      {
                        etichetta: "Opportunità Twenty",
                        valore: urlOpp ? (
                          <a
                            href={urlOpp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            Apri su Twenty <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        ) : (
                          <span className="font-mono text-xs">{prev.opportunitaId}</span>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

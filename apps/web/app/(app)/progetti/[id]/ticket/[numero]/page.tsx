import {
  codiceTicket,
  ETICHETTE_PRIORITA,
  ETICHETTE_STATO_TICKET,
  ETICHETTE_TIPO_TICKET,
} from "@telaio/core";
import {
  and,
  asc,
  documentiDelProgetto,
  eq,
  getDb,
  isNull,
  progetti,
  ticket,
  ticketCommenti,
  users,
} from "@telaio/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaricaDocumenti } from "@/components/domain/carica-documenti";
import { ElencoDocumenti } from "@/components/domain/elenco-documenti";
import {
  EliminaCommento,
  EliminaTicket,
  ModificaTicket,
  NuovoCommento,
} from "@/components/domain/ticket-modali";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { DefList } from "@/components/ui/def-list";
import { PageHeader } from "@/components/ui/page-header";
import { leggiArchivio } from "@/lib/archivio/config";
import { formatData } from "@/lib/date";
import { PRIORITA_PROGETTO, STATO_TICKET } from "@/lib/stati";

export const metadata = { title: "Ticket" };
export const dynamic = "force-dynamic";

const dataOra = (d: Date) =>
  `${formatData(d.toISOString())} ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string; numero: string }>;
}) {
  const { id, numero } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^\d{1,9}$/.test(numero)) notFound();
  const db = getDb();
  const [riga] = await db
    .select({ t: ticket, codice: progetti.codice, nomeProgetto: progetti.nome })
    .from(ticket)
    .innerJoin(progetti, eq(progetti.id, ticket.progettoId))
    .where(
      and(eq(ticket.progettoId, id), eq(ticket.numero, Number(numero)), isNull(ticket.deletedAt)),
    );
  if (!riga) notFound();
  const { t } = riga;
  const codice = codiceTicket(riga.codice, t.numero);
  const [commenti, documenti, utenti, archivio] = await Promise.all([
    db
      .select({ c: ticketCommenti, autore: users.name })
      .from(ticketCommenti)
      .leftJoin(users, eq(users.id, ticketCommenti.autoreId))
      .where(eq(ticketCommenti.ticketId, t.id))
      .orderBy(asc(ticketCommenti.createdAt)),
    documentiDelProgetto(db, id, { ticketId: t.id }),
    db.select({ id: users.id, nome: users.name }).from(users).orderBy(asc(users.name)),
    leggiArchivio(db),
  ]);
  const nome = (uid: string | null) => utenti.find((u) => u.id === uid)?.nome ?? null;
  const stato = STATO_TICKET[t.stato];
  const priorita = PRIORITA_PROGETTO[t.priorita];
  const scaduto =
    !!t.scadenza && t.stato !== "completato" && t.scadenza < new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        titolo={`${codice} · ${t.titolo}`}
        descrizione={
          <Link href={`/progetti/${id}/ticket`} className="hover:underline">
            Lavagna di {riga.nomeProgetto}
          </Link>
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
            <ModificaTicket
              utenti={utenti}
              ticket={{
                id: t.id,
                titolo: t.titolo,
                descrizione: t.descrizione ?? "",
                tipo: t.tipo,
                stato: t.stato,
                priorita: t.priorita,
                assegnatarioId: t.assegnatarioId ?? "",
                scadenza: t.scadenza ?? "",
              }}
            />
            <EliminaTicket id={t.id} codice={codice} />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader title="Descrizione" />
            {t.descrizione ? (
              <p className="text-sm whitespace-pre-line text-fg">{t.descrizione}</p>
            ) : (
              <p className="text-sm text-fg-2">Nessuna descrizione.</p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Documenti"
              description="File allegati a questo ticket; stanno anche nell'archivio del progetto."
            />
            <div className="flex flex-col gap-4">
              {documenti.length > 0 && (
                <ElencoDocumenti
                  documenti={documenti.map(({ d, caricatoDa }) => ({
                    id: d.id,
                    nome: d.nome,
                    dimensioneByte: d.dimensioneByte,
                    tipoMime: d.tipoMime,
                    categoria: d.categoria,
                    descrizione: d.descrizione,
                    caricatoDa,
                    createdAt: d.createdAt,
                  }))}
                />
              )}
              <CaricaDocumenti progettoId={id} ticketId={t.id} configurato={!!archivio.config} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Commenti"
              description={commenti.length ? `${commenti.length}` : undefined}
            />
            {commenti.length === 0 ? (
              <EmptyState title="Nessun commento">
                Scrivi qui aggiornamenti e note sul ticket.
              </EmptyState>
            ) : (
              <ul className="mb-4 flex flex-col gap-4">
                {commenti.map(({ c, autore }) => (
                  <li key={c.id} className="flex gap-3">
                    <Avatar name={autore ?? "?"} size="md" />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-sm">
                        <b className="font-medium">{autore ?? "Utente rimosso"}</b>
                        <span className="text-xs text-fg-3">{dataOra(c.createdAt)}</span>
                        <span className="ml-auto">
                          <EliminaCommento id={c.id} />
                        </span>
                      </span>
                      <p className="text-sm whitespace-pre-line text-fg">{c.testo}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <NuovoCommento ticketId={t.id} />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Dettagli" />
            <DefList
              voci={[
                { etichetta: "Stato", valore: ETICHETTE_STATO_TICKET[t.stato] },
                { etichetta: "Tipo", valore: ETICHETTE_TIPO_TICKET[t.tipo] },
                { etichetta: "Priorità", valore: ETICHETTE_PRIORITA[t.priorita] },
                { etichetta: "Assegnato a", valore: nome(t.assegnatarioId) ?? "Nessuno" },
                { etichetta: "Segnalato da", valore: nome(t.segnalatoreId) ?? "—" },
                {
                  etichetta: "Scadenza",
                  valore: (
                    <span className={scaduto ? "font-medium text-bad" : undefined}>
                      {formatData(t.scadenza)}
                    </span>
                  ),
                  numerico: true,
                },
                { etichetta: "Creato il", valore: dataOra(t.createdAt), numerico: true },
                { etichetta: "Aggiornato il", valore: dataOra(t.updatedAt), numerico: true },
                ...(t.completatoAt
                  ? [
                      {
                        etichetta: "Completato il",
                        valore: dataOra(t.completatoAt),
                        numerico: true,
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
          <Button asChild variant="secondary">
            <Link href={`/progetti/${id}/ticket`}>Torna alla lavagna</Link>
          </Button>
        </div>
      </div>
    </>
  );
}

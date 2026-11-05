import {
  and,
  asc,
  eq,
  getDb,
  inArray,
  isNull,
  progetti,
  ticketDelProgetto,
  users,
} from "@telaio/db";
import Link from "next/link";
import { LavagnaTicket } from "@/components/domain/lavagna-ticket";
import { NuovoTicket } from "@/components/domain/ticket-modali";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { oggi } from "@/lib/date";
import { requireSession } from "@/lib/session";
import { leggiTicketImpostazioni } from "@/lib/ticket-impostazioni";
import { cn } from "@/lib/utils";
import { type RigaTicket, TicketTabella } from "./ticket-tabella";

export const metadata = { title: "Ticket" };
export const dynamic = "force-dynamic";

const VISTE = [
  { id: "lavagna", etichetta: "Lavagna" },
  { id: "tabella", etichetta: "Tabella" },
] as const;

/** Tutti i ticket di tutti i progetti, in lavagna (di default) o in tabella. */
export default async function TicketPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const vista = (await searchParams).vista === "tabella" ? "tabella" : "lavagna";
  const { user } = await requireSession();
  const db = getDb();
  const [tutti, utenti, elencoProgetti, { autoAssegna }] = await Promise.all([
    ticketDelProgetto(db),
    db.select({ id: users.id, nome: users.name }).from(users).orderBy(asc(users.name)),
    db
      .select({ id: progetti.id, codice: progetti.codice, nome: progetti.nome })
      .from(progetti)
      .where(
        and(
          isNull(progetti.deletedAt),
          inArray(progetti.stato, ["pianificato", "in_corso", "in_attesa"]),
        ),
      )
      .orderBy(asc(progetti.nome)),
    leggiTicketImpostazioni(db),
  ]);

  const dataOggi = oggi();
  const aperti = tutti.filter((r) => r.t.stato !== "completato");
  const scelta = elencoProgetti.map((p) => ({ id: p.id, etichetta: `${p.codice} · ${p.nome}` }));
  // chi ha ticket in progetti già completati o annullati resta filtrabile
  const filtro = [
    ...new Map([
      ...scelta.map((p) => [p.id, p.etichetta] as const),
      ...tutti.map((r) => [r.t.progettoId, `${r.codiceProgetto} · ${r.nomeProgetto}`] as const),
    ]),
  ]
    .map(([id, etichetta]) => ({ id, etichetta }))
    .sort((a, b) => a.etichetta.localeCompare(b.etichetta, "it"));

  return (
    <>
      <PageHeader
        titolo="Ticket"
        descrizione="Le attività, i bug e le richieste di tutti i progetti."
        azioni={
          <>
            <nav
              aria-label="Vista"
              className="flex gap-0.5 rounded-md border border-line bg-subtle p-0.5"
            >
              {VISTE.map((v) => (
                <Link
                  key={v.id}
                  href={v.id === "lavagna" ? "/ticket" : `/ticket?vista=${v.id}`}
                  aria-current={v.id === vista ? "page" : undefined}
                  className={cn(
                    "flex h-7 items-center rounded-sm px-3 text-sm font-medium transition-colors duration-150",
                    v.id === vista ? "bg-surface text-fg shadow-xs" : "text-fg-2 hover:text-fg",
                  )}
                >
                  {v.etichetta}
                </Link>
              ))}
            </nav>
            {scelta.length > 0 && (
              <NuovoTicket
                progetti={scelta}
                utenti={utenti}
                assegnatarioPredefinito={autoAssegna ? user.id : undefined}
              />
            )}
          </>
        }
      />
      <StatsRow
        dati={[
          { etichetta: "Aperti", valore: aperti.length },
          { etichetta: "In corso", valore: tutti.filter((r) => r.t.stato === "in_corso").length },
          {
            etichetta: "In revisione",
            valore: tutti.filter((r) => r.t.stato === "in_revisione").length,
          },
          {
            etichetta: "Scaduti",
            valore: aperti.filter((r) => r.t.scadenza && r.t.scadenza < dataOggi).length,
          },
        ]}
      />
      {vista === "lavagna" ? (
        <LavagnaTicket
          progetti={filtro}
          utenteCorrenteId={user.id}
          utenti={utenti}
          ticket={tutti.map(
            ({ t, codiceProgetto, nomeProgetto, assegnatario, commenti, documenti }) => ({
              id: t.id,
              progettoId: t.progettoId,
              codiceProgetto,
              nomeProgetto,
              numero: t.numero,
              titolo: t.titolo,
              tipo: t.tipo,
              stato: t.stato,
              priorita: t.priorita,
              assegnatarioId: t.assegnatarioId,
              assegnatario,
              scadenza: t.scadenza,
              commenti,
              documenti,
            }),
          )}
        />
      ) : (
        <TicketTabella
          righe={[...tutti]
            .sort((a, b) => Number(a.t.stato === "completato") - Number(b.t.stato === "completato"))
            .map(
              ({ t, codiceProgetto, nomeProgetto }): RigaTicket => ({
                id: t.id,
                numero: t.numero,
                titolo: t.titolo,
                tipo: t.tipo,
                stato: t.stato,
                priorita: t.priorita,
                scadenza: t.scadenza,
                aggiornato: t.updatedAt.toISOString(),
                progettoId: t.progettoId,
                codiceProgetto,
                nomeProgetto,
              }),
            )}
          progetti={filtro.map((p) => ({ valore: p.id, etichetta: p.etichetta }))}
          oggi={dataOggi}
        />
      )}
    </>
  );
}

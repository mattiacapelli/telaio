import { and, asc, eq, getDb, isNull, progetti, ticketDelProgetto, users } from "@telaio/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LavagnaTicket } from "@/components/domain/lavagna-ticket";
import { NuovoTicket } from "@/components/domain/ticket-modali";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/session";
import { leggiTicketImpostazioni } from "@/lib/ticket-impostazioni";

export const metadata = { title: "Ticket" };
export const dynamic = "force-dynamic";

export default async function LavagnaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { user } = await requireSession();
  const db = getDb();
  const [p] = await db
    .select({ id: progetti.id, codice: progetti.codice, nome: progetti.nome })
    .from(progetti)
    .where(and(eq(progetti.id, id), isNull(progetti.deletedAt)));
  if (!p) notFound();
  const [righe, utenti, { autoAssegna }] = await Promise.all([
    ticketDelProgetto(db, id),
    db.select({ id: users.id, nome: users.name }).from(users).orderBy(asc(users.name)),
    leggiTicketImpostazioni(db),
  ]);

  return (
    <>
      <PageHeader
        titolo={`Ticket · ${p.nome}`}
        descrizione={
          <Link href={`/progetti/${p.id}`} className="hover:underline">
            {p.codice} · torna al progetto
          </Link>
        }
        azioni={
          <>
            <Button asChild variant="secondary">
              <Link href={`/progetti/${p.id}`}>Progetto</Link>
            </Button>
            <NuovoTicket
              progettoId={p.id}
              utenti={utenti}
              assegnatarioPredefinito={autoAssegna ? user.id : undefined}
            />
          </>
        }
      />
      <LavagnaTicket
        progettoId={p.id}
        utenteCorrenteId={user.id}
        utenti={utenti}
        ticket={righe.map(({ t, assegnatario, commenti, documenti }) => ({
          id: t.id,
          progettoId: p.id,
          codiceProgetto: p.codice,
          nomeProgetto: p.nome,
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
        }))}
      />
    </>
  );
}

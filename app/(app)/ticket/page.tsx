import Link from "next/link";
import { getTicket } from "@/lib/queries";
import { VistaDoppia } from "@/components/vista-doppia";
import { Badge } from "@/components/ui/badge";
import { Stat, Vuoto } from "@/components/ui-legacy";
import { Chip } from "@/components/chip";
import { eur, ore, data, daGiorni } from "@/lib/format";
import { LifeBuoy, Building2, Clock, Tag, AlertCircle } from "lucide-react";
import { AvviaTimer } from "@/components/avvia-timer";

export const dynamic = "force-dynamic";

const COLONNE = [
  { stato: "APERTO", titolo: "Aperto" },
  { stato: "IN_LAVORAZIONE", titolo: "In lavorazione" },
  { stato: "ATTESA_CLIENTE", titolo: "Attesa cliente" },
  { stato: "RISOLTO", titolo: "Risolto" },
  { stato: "CHIUSO", titolo: "Chiuso" },
];

const PRIORITA: Record<string, string> = {
  BASSA: "Bassa",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export default async function TicketPage() {
  const ticket = await getTicket();
  if (ticket.length === 0) {
    return <Vuoto titolo="Nessun ticket" nota="Qui arrivano le richieste di assistenza dei clienti." />;
  }

  const aperti = ticket.filter(
    (t) => t.stato === "APERTO" || t.stato === "IN_LAVORAZIONE",
  );
  const attesa = ticket.filter((t) => t.stato === "ATTESA_CLIENTE");
  const daFatturare = ticket.reduce((s, t) => s + t.daFatturare, 0);
  const clientiCoinvolti = new Set(
    ticket.filter((t) => t.daFatturare > 0).map((t) => t.cliente),
  ).size;

  const elementi = ticket.map((t) => ({
    id: t.id,
    stato: t.stato,
    etichetta: `#${t.numero} ${t.titolo}`,
    contenuto: (
      <>
        <div className="flex items-center gap-2">
          <span className="text-xxs text-faint">#{t.numero}</span>
          <Badge tono={t.priorita === "ALTA" ? "attenzione" : "neutro"}>
            {PRIORITA[t.priorita]}
          </Badge>
        </div>
        <Link href={`/ticket/${t.id}`} className="mt-1 block text-xs font-medium hover:underline">
          {t.titolo}
        </Link>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <Chip testo={t.cliente} />
          <span className="truncate">
            {t.cliente}
            {t.progetto && ` · ${t.progetto}`}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xxs text-faint">
          <span>{ore(t.ore)}</span>
          <span>· aperto {daGiorni(t.apertoIl)} gg</span>
          <div className="flex-1" />
          {t.stato !== "RISOLTO" && t.stato !== "CHIUSO" && (
            <AvviaTimer ticketId={t.id} etichetta={`#${t.numero} ${t.titolo}`} />
          )}
        </div>
        {!t.conContratto && (
          <div className="mt-1.5">
            <Badge>fuori contratto</Badge>
          </div>
        )}
      </>
    ),
  }));

  return (
    <div className="tl-in flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          etichetta="Ticket aperti"
          valore={String(aperti.length)}
          nota={`${ticket.filter((t) => t.stato === "IN_LAVORAZIONE").length} in lavorazione`}
        />
        <Stat
          etichetta="In attesa del cliente"
          valore={String(attesa.length)}
          nota={
            attesa.length
              ? `più vecchio: ${Math.max(...attesa.map((t) => daGiorni(t.apertoIl) ?? 0))} giorni`
              : "nessuno"
          }
        />
        <Stat
          etichetta="Senza contratto"
          valore={String(ticket.filter((t) => !t.conContratto).length)}
          nota="da fatturare a consuntivo"
        />
        <Stat
          etichetta="Ore su ticket da fatturare"
          valore={daFatturare.toLocaleString("it-IT", { maximumFractionDigits: 2 })}
          unita="h"
          nota={`≈ ${eur(daFatturare * 65)} · ${clientiCoinvolti} clienti`}
        />
      </div>
      <VistaDoppia
        chiave="ticket"
        entita="ticket"
        colonne={COLONNE}
        elementi={elementi}
        intestazione={
          <span className="text-xs text-muted">{ticket.length} ticket</span>
        }
        colonneTabella={[
          { intestazione: "N.", larghezza: "60px", icona: <LifeBuoy key="i1" size={13} /> },
          { intestazione: "Titolo", larghezza: "minmax(0, 1.8fr)" },
          { intestazione: "Cliente", icona: <Building2 key="i2" size={13} /> },
          { intestazione: "Priorità", larghezza: "90px", icona: <AlertCircle key="i3" size={13} /> },
          { intestazione: "Stato", larghezza: "120px", icona: <Tag key="i4" size={13} /> },
          { intestazione: "Ore", larghezza: "80px", allinea: "destra", icona: <Clock key="i5" size={13} /> },
        ]}
        righe={ticket.map((x) => ({
          id: x.id,
          href: `/ticket/${x.id}`,
          celle: [
            <span key="c1" className="text-faint">#{x.numero}</span>,
            <span key="c2" className="truncate font-medium">{x.titolo}</span>,
            <span key="c3" className="flex min-w-0 items-center gap-1.5 text-muted">
              <Chip testo={x.cliente} />
              <span className="truncate">{x.cliente}</span>
            </span>,
            <Badge key="c4" tono={x.priorita === "ALTA" ? "attenzione" : "neutro"}>
              {PRIORITA[x.priorita]}
            </Badge>,
            <Badge key="c5">
              {COLONNE.find((c) => c.stato === x.stato)?.titolo ?? x.stato}
            </Badge>,
            <span key="c6" className="text-muted">{ore(x.ore)}</span>,
          ],
        }))}
      />
    </div>
  );
}

"use client";

import {
  ETICHETTE_PRIORITA,
  ETICHETTE_STATO_TICKET,
  ETICHETTE_TIPO_TICKET,
  PRIORITA_TICKET,
  STATI_TICKET,
  TIPI_TICKET,
} from "@telaio/core";
import { ExternalLink, SquareKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { PRIORITA_PROGETTO, STATO_TICKET } from "@/lib/stati";
import { cn } from "@/lib/utils";

export interface RigaTicket {
  id: string;
  numero: number;
  titolo: string;
  tipo: string;
  stato: string;
  priorita: string;
  scadenza: string | null;
  aggiornato: string;
  progettoId: string;
  codiceProgetto: string;
  nomeProgetto: string;
}

const dataIt = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const href = (r: RigaTicket) => `/progetti/${r.progettoId}/ticket/${r.numero}`;

export function TicketTabella({
  righe,
  progetti,
  oggi,
}: {
  righe: RigaTicket[];
  progetti: { valore: string; etichetta: string }[];
  oggi: string;
}) {
  return (
    <DataTable
      etichetta="Ticket"
      dati={righe}
      idRiga={(r) => r.id}
      hrefRiga={href}
      testoRicerca={(r) => `${r.titolo} ${r.codiceProgetto}-${r.numero} ${r.nomeProgetto}`}
      segnapostoRicerca="Titolo, progetto, codice…"
      vuoto={{
        titolo: "Nessun ticket",
        descrizione: "Apri un progetto e crea il primo dalla sua lavagna.",
      }}
      filtri={[
        {
          id: "progetto",
          etichetta: "Progetto",
          valore: (r) => r.progettoId,
          opzioni: progetti,
        },
        {
          id: "stato",
          etichetta: "Stato",
          valore: (r) => r.stato,
          opzioni: STATI_TICKET.map((s) => ({ valore: s, etichetta: ETICHETTE_STATO_TICKET[s] })),
        },
        {
          id: "tipo",
          etichetta: "Tipo",
          valore: (r) => r.tipo,
          opzioni: TIPI_TICKET.map((t) => ({ valore: t, etichetta: ETICHETTE_TIPO_TICKET[t] })),
        },
        {
          id: "priorita",
          etichetta: "Priorità",
          valore: (r) => r.priorita,
          opzioni: PRIORITA_TICKET.map((p) => ({ valore: p, etichetta: ETICHETTE_PRIORITA[p] })),
        },
      ]}
      colonne={[
        {
          id: "ticket",
          intestazione: "Ticket",
          ordina: (r) => r.titolo,
          minLarghezza: 220,
          cella: (r) => (
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{r.titolo}</span>
              <span className="text-xs text-fg-3 tabular-nums">
                {r.codiceProgetto}-{r.numero}
              </span>
            </div>
          ),
        },
        {
          id: "progetto",
          intestazione: "Progetto",
          ordina: (r) => r.nomeProgetto,
          nascondiSotto: "md",
          cella: (r) => <span className="text-fg-2">{r.nomeProgetto}</span>,
        },
        {
          id: "tipo",
          intestazione: "Tipo",
          ordina: (r) => r.tipo,
          nascondiSotto: "lg",
          cella: (r) => (
            <span className="text-fg-2">
              {ETICHETTE_TIPO_TICKET[r.tipo as keyof typeof ETICHETTE_TIPO_TICKET] ?? r.tipo}
            </span>
          ),
        },
        {
          id: "stato",
          intestazione: "Stato",
          ordina: (r) => STATI_TICKET.indexOf(r.stato as (typeof STATI_TICKET)[number]),
          cella: (r) => (
            <Badge variant={STATO_TICKET[r.stato]?.variante} dot>
              {STATO_TICKET[r.stato]?.label ?? r.stato}
            </Badge>
          ),
        },
        {
          id: "priorita",
          intestazione: "Priorità",
          ordina: (r) => PRIORITA_TICKET.indexOf(r.priorita as (typeof PRIORITA_TICKET)[number]),
          cella: (r) => (
            <Badge variant={PRIORITA_PROGETTO[r.priorita]?.variante}>
              {PRIORITA_PROGETTO[r.priorita]?.label ?? r.priorita}
            </Badge>
          ),
        },
        {
          id: "scadenza",
          intestazione: "Scadenza",
          ordina: (r) => r.scadenza ?? "9999",
          nascondiSotto: "md",
          cella: (r) =>
            r.scadenza ? (
              <span
                className={cn(
                  "tabular-nums",
                  r.stato !== "completato" && r.scadenza < oggi
                    ? "font-medium text-bad"
                    : "text-fg-2",
                )}
              >
                {dataIt(r.scadenza)}
              </span>
            ) : (
              <span className="text-fg-3">—</span>
            ),
        },
        {
          id: "aggiornato",
          intestazione: "Aggiornato",
          ordina: (r) => r.aggiornato,
          nascondiSotto: "lg",
          cella: (r) => <span className="tabular-nums text-fg-2">{dataIt(r.aggiornato)}</span>,
        },
      ]}
      azioniRiga={(r) => [
        { etichetta: "Apri", href: href(r), icona: <ExternalLink /> },
        {
          etichetta: "Lavagna del progetto",
          href: `/progetti/${r.progettoId}/ticket`,
          icona: <SquareKanban />,
        },
      ]}
    />
  );
}

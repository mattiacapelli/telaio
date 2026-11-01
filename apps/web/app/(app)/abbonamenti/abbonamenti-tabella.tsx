"use client";

import { formatEuro } from "@telaio/core";
import { ExternalLink } from "lucide-react";
import { Badge, type VarianteBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

export interface RigaAbbonamento {
  id: string;
  cliente: string;
  descrizione: string;
  emittente: string;
  periodicita: string;
  importoCent: number;
  lordoCent: number | null;
  stato: string;
  prossima: string | null;
}

const PERIODI: Record<string, string> = {
  mensile: "Mensile",
  trimestrale: "Trimestrale",
  semestrale: "Semestrale",
  annuale: "Annuale",
};
const STATO: Record<string, { etichetta: string; variante: VarianteBadge }> = {
  attivo: { etichetta: "Attivo", variante: "ok" },
  sospeso: { etichetta: "Sospeso", variante: "warn" },
  cessato: { etichetta: "Cessato", variante: "neutral" },
};

export function AbbonamentiTabella({ righe }: { righe: RigaAbbonamento[] }) {
  return (
    <DataTable
      etichetta="Abbonamenti"
      dati={righe}
      idRiga={(r) => r.id}
      hrefRiga={(r) => `/abbonamenti/${r.id}`}
      testoRicerca={(r) => `${r.cliente} ${r.descrizione}`}
      segnapostoRicerca="Cliente o descrizione…"
      vuoto={{
        titolo: "Nessun abbonamento",
        descrizione: "Creane uno: le rate compaiono nello scadenzario.",
      }}
      filtri={[
        {
          id: "stato",
          etichetta: "Stato",
          valore: (r) => r.stato,
          opzioni: Object.entries(STATO).map(([valore, s]) => ({ valore, etichetta: s.etichetta })),
        },
        {
          id: "per",
          etichetta: "Periodicità",
          valore: (r) => r.periodicita,
          opzioni: Object.entries(PERIODI).map(([valore, etichetta]) => ({ valore, etichetta })),
        },
      ]}
      colonne={[
        {
          id: "cliente",
          intestazione: "Cliente",
          ordina: (r) => r.cliente,
          minLarghezza: 200,
          cella: (r) => (
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{r.cliente}</span>
              <span className="text-xs text-fg-3">{r.descrizione}</span>
            </div>
          ),
        },
        {
          id: "emittente",
          intestazione: "Emittente",
          nascondiSotto: "lg",
          ordina: (r) => r.emittente,
          cella: (r) => <span className="text-fg-2">{r.emittente}</span>,
        },
        {
          id: "per",
          intestazione: "Periodicità",
          ordina: (r) => r.periodicita,
          nascondiSotto: "md",
          cella: (r) => PERIODI[r.periodicita] ?? r.periodicita,
        },
        {
          id: "importo",
          intestazione: "Rata",
          allinea: "destra",
          ordina: (r) => r.importoCent,
          cella: (r) => (
            <div className="flex flex-col items-end leading-tight">
              <span className="font-medium">{formatEuro(r.importoCent)}</span>
              {r.lordoCent !== null && (
                <span className="text-xs text-fg-3">{formatEuro(r.lordoCent)} con IVA</span>
              )}
            </div>
          ),
        },
        {
          id: "stato",
          intestazione: "Stato",
          ordina: (r) => r.stato,
          cella: (r) => (
            <Badge variant={STATO[r.stato]?.variante ?? "neutral"} dot>
              {STATO[r.stato]?.etichetta ?? r.stato}
            </Badge>
          ),
        },
        {
          id: "pross",
          intestazione: "Prossima rata",
          ordina: (r) => r.prossima ?? "~",
          nascondiSotto: "sm",
          cella: (r) => (
            <span className="tabular-nums text-fg-2">
              {r.prossima ? r.prossima.split("-").reverse().join("/") : "—"}
            </span>
          ),
        },
      ]}
      azioniRiga={(r) => [
        { etichetta: "Apri", href: `/abbonamenti/${r.id}`, icona: <ExternalLink /> },
      ]}
    />
  );
}

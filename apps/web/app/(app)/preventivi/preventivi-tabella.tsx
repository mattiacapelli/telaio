"use client";

import { formatEuro } from "@telaio/core";
import { ExternalLink, Receipt } from "lucide-react";
import { Badge, type VarianteBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

export interface RigaPreventivo {
  id: string;
  numero: string | null;
  cliente: string | null;
  oggetto: string;
  emittente: string;
  unaTantumCent: number;
  unaTantumLordoCent: number | null;
  canoneCent: number;
  canoneLordoCent: number | null;
  /** stato mostrato: include «in_scadenza» */
  stato: string;
  etichettaStato: string;
  data: string;
}

const VARIANTE: Record<string, VarianteBadge> = {
  bozza: "neutral",
  inviato: "brand",
  in_revisione: "warn",
  in_scadenza: "warn",
  accettato: "ok",
  rifiutato: "neutral",
  scaduto: "bad",
};

const Importo = ({
  cent,
  lordo,
  suffisso = "",
}: {
  cent: number;
  lordo: number | null;
  suffisso?: string;
}) =>
  cent > 0 ? (
    <div className="flex flex-col items-end leading-tight">
      <span className="font-medium">
        {formatEuro(cent)}
        {suffisso}
      </span>
      {lordo !== null && <span className="text-xs text-fg-3">{formatEuro(lordo)} ivato</span>}
    </div>
  ) : (
    <span className="text-fg-3">—</span>
  );

export function PreventiviTabella({
  righe,
  emittenti,
}: {
  righe: RigaPreventivo[];
  emittenti: string[];
}) {
  return (
    <DataTable
      etichetta="Preventivi"
      dati={righe}
      idRiga={(r) => r.id}
      hrefRiga={(r) => `/preventivi/${r.id}`}
      testoRicerca={(r) => `${r.numero ?? ""} ${r.cliente ?? ""} ${r.oggetto} ${r.emittente}`}
      segnapostoRicerca="Numero, cliente, oggetto…"
      vuoto={{
        titolo: "Nessun preventivo",
        descrizione: "Creane uno dal listino o dal configuratore.",
      }}
      filtri={[
        {
          id: "stato",
          etichetta: "Stato",
          valore: (r) => r.stato,
          opzioni: [
            ["bozza", "Bozza"],
            ["inviato", "Inviato"],
            ["in_scadenza", "In scadenza"],
            ["in_revisione", "In revisione"],
            ["accettato", "Accettato"],
            ["rifiutato", "Rifiutato"],
            ["scaduto", "Scaduto"],
          ].map(([valore, etichetta]) => ({
            valore: valore as string,
            etichetta: etichetta as string,
          })),
        },
        {
          id: "emittente",
          etichetta: "Emittente",
          valore: (r) => r.emittente,
          opzioni: emittenti.map((e) => ({ valore: e, etichetta: e })),
        },
      ]}
      colonne={[
        {
          id: "numero",
          intestazione: "Numero",
          ordina: (r) => r.numero ?? "",
          cella: (r) => <span className="font-medium">{r.numero ?? "Bozza"}</span>,
        },
        {
          id: "cliente",
          intestazione: "Cliente",
          ordina: (r) => r.cliente ?? "",
          minLarghezza: 140,
          cella: (r) => r.cliente ?? <span className="text-fg-3">—</span>,
        },
        {
          id: "oggetto",
          intestazione: "Oggetto",
          nascondiSotto: "lg",
          cella: (r) => <span className="text-fg-2">{r.oggetto}</span>,
        },
        {
          id: "emittente",
          intestazione: "Emittente",
          nascondiSotto: "lg",
          ordina: (r) => r.emittente,
          cella: (r) => <span className="text-fg-2">{r.emittente}</span>,
        },
        {
          id: "ut",
          intestazione: "Una tantum netto",
          allinea: "destra",
          ordina: (r) => r.unaTantumCent,
          cella: (r) => <Importo cent={r.unaTantumCent} lordo={r.unaTantumLordoCent} />,
        },
        {
          id: "can",
          intestazione: "Canone netto",
          allinea: "destra",
          ordina: (r) => r.canoneCent,
          nascondiSotto: "md",
          cella: (r) => <Importo cent={r.canoneCent} lordo={r.canoneLordoCent} suffisso="/a" />,
        },
        {
          id: "stato",
          intestazione: "Stato",
          ordina: (r) => r.stato,
          cella: (r) => (
            <Badge variant={VARIANTE[r.stato] ?? "neutral"} dot>
              {r.etichettaStato}
            </Badge>
          ),
        },
        {
          id: "data",
          intestazione: "Data",
          ordina: (r) => r.data,
          nascondiSotto: "md",
          cella: (r) => (
            <span className="tabular-nums text-fg-2">{r.data.split("-").reverse().join("/")}</span>
          ),
        },
      ]}
      azioniRiga={(r) => [
        { etichetta: "Apri", href: `/preventivi/${r.id}`, icona: <ExternalLink /> },
        ...(r.stato === "accettato"
          ? [{ etichetta: "Crea fattura", href: `/preventivi/${r.id}`, icona: <Receipt /> }]
          : []),
      ]}
    />
  );
}

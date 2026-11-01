"use client";

import { formatEuro } from "@telaio/core";
import { Badge, type VarianteBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

export interface RigaMovimento {
  id: string;
  data: string;
  descrizione: string | null;
  categoria: string | null;
  emittente: string | null;
  conto: string;
  destinazione: string | null;
  tipo: "entrata" | "uscita" | "giroconto";
  importoCent: number;
}

const TIPO: Record<RigaMovimento["tipo"], { etichetta: string; variante: VarianteBadge }> = {
  entrata: { etichetta: "Entrata", variante: "ok" },
  uscita: { etichetta: "Uscita", variante: "bad" },
  giroconto: { etichetta: "Giroconto", variante: "brand" },
};

export function MovimentiTabella({ righe }: { righe: RigaMovimento[] }) {
  return (
    <DataTable
      etichetta="Movimenti di prima nota"
      dati={righe}
      idRiga={(r) => r.id}
      testoRicerca={(r) => `${r.descrizione ?? ""} ${r.categoria ?? ""} ${r.conto}`}
      segnapostoRicerca="Descrizione, categoria, conto…"
      vuoto={{
        titolo: "Nessun movimento",
        descrizione: "Gli incassi registrati compaiono qui come entrate.",
      }}
      filtri={[
        {
          id: "tipo",
          etichetta: "Tipo",
          valore: (r) => r.tipo,
          opzioni: Object.entries(TIPO).map(([valore, t]) => ({ valore, etichetta: t.etichetta })),
        },
        {
          id: "conto",
          etichetta: "Conto",
          valore: (r) => r.conto,
          opzioni: [...new Set(righe.map((r) => r.conto))].map((c) => ({
            valore: c,
            etichetta: c,
          })),
        },
      ]}
      colonne={[
        {
          id: "data",
          intestazione: "Data",
          ordina: (r) => r.data,
          cella: (r) => (
            <span className="tabular-nums">{r.data.split("-").reverse().join("/")}</span>
          ),
        },
        {
          id: "descr",
          intestazione: "Descrizione",
          minLarghezza: 200,
          cella: (r) => (
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{r.descrizione ?? "—"}</span>
              {r.categoria && <span className="text-xs text-fg-3">{r.categoria}</span>}
            </div>
          ),
        },
        {
          id: "em",
          intestazione: "Ragione sociale",
          nascondiSotto: "lg",
          cella: (r) => <span className="text-fg-2">{r.emittente ?? "—"}</span>,
        },
        {
          id: "conto",
          intestazione: "Conto",
          ordina: (r) => r.conto,
          nascondiSotto: "md",
          cella: (r) => (
            <span className="text-fg-2">
              {r.destinazione ? `${r.conto} → ${r.destinazione}` : r.conto}
            </span>
          ),
        },
        {
          id: "tipo",
          intestazione: "Tipo",
          ordina: (r) => r.tipo,
          cella: (r) => (
            <Badge variant={TIPO[r.tipo].variante} dot>
              {TIPO[r.tipo].etichetta}
            </Badge>
          ),
        },
        {
          id: "importo",
          intestazione: "Importo",
          allinea: "destra",
          ordina: (r) => (r.tipo === "uscita" ? -r.importoCent : r.importoCent),
          cella: (r) => (
            <span
              className={
                r.tipo === "uscita"
                  ? "font-medium"
                  : r.tipo === "entrata"
                    ? "font-medium text-ok"
                    : "font-medium"
              }
            >
              {r.tipo === "uscita" ? "− " : r.tipo === "entrata" ? "+ " : ""}
              {formatEuro(r.importoCent)}
            </span>
          ),
        },
      ]}
    />
  );
}

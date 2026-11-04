"use client";

import { formatEuro } from "@telaio/core";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { ModificaDataIncasso } from "@/components/domain/modifica-date";
import { Badge, type VarianteBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

export interface RigaIncasso {
  id: string;
  data: string;
  cliente: string | null;
  causale: string;
  emittente: string | null;
  fattura: string | null;
  conto: string;
  metodo: "bonifico" | "contante" | "carta";
  importoCent: number;
}

const METODO: Record<RigaIncasso["metodo"], { etichetta: string; variante: VarianteBadge }> = {
  bonifico: { etichetta: "Bonifico", variante: "brand" },
  contante: { etichetta: "Contante", variante: "neutral" },
  carta: { etichetta: "Carta", variante: "ok" },
};

export function IncassiTabella({ righe }: { righe: RigaIncasso[] }) {
  const [daModificare, setDaModificare] = useState<RigaIncasso | null>(null);
  return (
    <>
      {daModificare && (
        <ModificaDataIncasso
          key={daModificare.id}
          incasso={daModificare}
          open
          onOpenChange={(aperta) => !aperta && setDaModificare(null)}
        />
      )}
      <DataTable
        azioniRiga={(r) => [
          {
            etichetta: "Modifica data",
            icona: <CalendarDays />,
            alSelezionare: () => setDaModificare(r),
          },
        ]}
        etichetta="Incassi"
        dati={righe}
        idRiga={(r) => r.id}
        testoRicerca={(r) => `${r.cliente ?? ""} ${r.causale} ${r.fattura ?? ""} ${r.conto}`}
        segnapostoRicerca="Cliente, causale, fattura…"
        vuoto={{
          titolo: "Nessun incasso registrato",
          descrizione: "Registra il primo: aggiornerà scadenzario e prima nota.",
        }}
        filtri={[
          {
            id: "metodo",
            etichetta: "Metodo",
            valore: (r) => r.metodo,
            opzioni: Object.entries(METODO).map(([valore, m]) => ({
              valore,
              etichetta: m.etichetta,
            })),
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
            id: "cliente",
            intestazione: "Cliente · causale",
            ordina: (r) => r.cliente ?? "",
            minLarghezza: 200,
            cella: (r) => (
              <div className="flex flex-col leading-tight">
                <span className="font-medium">{r.cliente ?? "—"}</span>
                <span className="text-xs text-fg-3">{r.causale}</span>
              </div>
            ),
          },
          {
            id: "emittente",
            intestazione: "Emittente · fattura",
            nascondiSotto: "lg",
            cella: (r) => (
              <div className="flex flex-col leading-tight">
                <span className="text-fg-2">{r.emittente ?? "—"}</span>
                {r.fattura && <span className="text-xs text-fg-3">{r.fattura}</span>}
              </div>
            ),
          },
          {
            id: "conto",
            intestazione: "Conto",
            ordina: (r) => r.conto,
            nascondiSotto: "md",
            cella: (r) => <span className="text-fg-2">{r.conto}</span>,
          },
          {
            id: "metodo",
            intestazione: "Metodo",
            ordina: (r) => r.metodo,
            cella: (r) => (
              <Badge variant={METODO[r.metodo].variante} dot>
                {METODO[r.metodo].etichetta}
              </Badge>
            ),
          },
          {
            id: "importo",
            intestazione: "Importo",
            allinea: "destra",
            ordina: (r) => r.importoCent,
            cella: (r) => <span className="font-medium">{formatEuro(r.importoCent)}</span>,
          },
        ]}
      />
    </>
  );
}

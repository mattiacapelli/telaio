"use client";

import { formatEuro } from "@telaio/core";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

export interface RigaCliente {
  id: string;
  nome: string;
  citta: string | null;
  pa: boolean;
  piva: string | null;
  relazione: "cliente" | "prospect";
  opportunita: string | null;
  preventivi: number;
  daIncassareCent: number;
}

export function ClientiTabella({ righe }: { righe: RigaCliente[] }) {
  return (
    <DataTable
      etichetta="Clienti"
      dati={righe}
      idRiga={(r) => r.id}
      hrefRiga={(r) => `/clienti/${r.id}`}
      testoRicerca={(r) => `${r.nome} ${r.piva ?? ""} ${r.citta ?? ""}`}
      segnapostoRicerca="Nome, P.IVA, città…"
      vuoto={{ titolo: "Nessun cliente", descrizione: "I clienti arrivano da Twenty." }}
      filtri={[
        {
          id: "relazione",
          etichetta: "Stato",
          valore: (r) => r.relazione,
          opzioni: [
            { valore: "cliente", etichetta: "Cliente" },
            { valore: "prospect", etichetta: "Prospect" },
          ],
        },
      ]}
      colonne={[
        {
          id: "nome",
          intestazione: "Azienda",
          ordina: (r) => r.nome,
          minLarghezza: 220,
          cella: (r) => (
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{r.nome}</span>
              <span className="text-xs text-fg-3">
                {[r.citta, r.pa ? "Pubblica amministrazione" : null].filter(Boolean).join(" · ") ||
                  "—"}
              </span>
            </div>
          ),
        },
        {
          id: "piva",
          intestazione: "P.IVA",
          ordina: (r) => r.piva,
          nascondiSotto: "md",
          cella: (r) => <span className="tabular-nums text-fg-2">{r.piva ?? "—"}</span>,
        },
        {
          id: "stato",
          intestazione: "Stato",
          ordina: (r) => r.relazione,
          cella: (r) => (
            <Badge variant={r.relazione === "cliente" ? "ok" : "brand"} dot>
              {r.relazione === "cliente" ? "Cliente" : "Prospect"}
            </Badge>
          ),
        },
        {
          id: "opp",
          intestazione: "Opportunità aperta",
          nascondiSotto: "lg",
          cella: (r) => <span className="text-fg-2">{r.opportunita ?? "—"}</span>,
        },
        {
          id: "prev",
          intestazione: "Preventivi",
          allinea: "destra",
          ordina: (r) => r.preventivi,
          nascondiSotto: "sm",
          cella: (r) => r.preventivi,
        },
        {
          id: "inc",
          intestazione: "Da incassare",
          allinea: "destra",
          ordina: (r) => r.daIncassareCent,
          cella: (r) =>
            r.daIncassareCent > 0 ? (
              <span className="font-medium text-bad">{formatEuro(r.daIncassareCent)}</span>
            ) : (
              <span className="text-fg-3">—</span>
            ),
        },
      ]}
      azioniRiga={(r) => [
        { etichetta: "Apri scheda", href: `/clienti/${r.id}`, icona: <ExternalLink /> },
        { etichetta: "Nuovo preventivo", href: `/preventivi/nuovo?cliente=${r.id}` },
      ]}
    />
  );
}

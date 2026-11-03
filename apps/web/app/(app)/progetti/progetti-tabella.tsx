"use client";

import { ExternalLink, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { PRIORITA_PROGETTO, STATO_PROGETTO } from "@/lib/stati";

export interface RigaProgetto {
  id: string;
  codice: string;
  nome: string;
  cliente: string | null;
  categoria: string;
  etichettaCategoria: string;
  responsabile: string | null;
  stato: string;
  priorita: string;
  aggiornato: string;
}

const dataIt = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const ordinePriorita = ["bassa", "normale", "alta", "urgente"];

export function ProgettiTabella({
  righe,
  clienti,
  categorie,
}: {
  righe: RigaProgetto[];
  clienti: string[];
  categorie: { valore: string; etichetta: string }[];
}) {
  return (
    <DataTable
      etichetta="Progetti"
      dati={righe}
      idRiga={(r) => r.id}
      hrefRiga={(r) => `/progetti/${r.id}`}
      testoRicerca={(r) => `${r.codice} ${r.nome} ${r.cliente ?? ""}`}
      segnapostoRicerca="Nome o codice…"
      vuoto={{
        titolo: "Nessun progetto",
        descrizione: "Creane uno con «Nuovo progetto» o da un preventivo accettato.",
      }}
      filtri={[
        {
          id: "stato",
          etichetta: "Stato",
          valore: (r) => r.stato,
          opzioni: Object.entries(STATO_PROGETTO).map(([valore, v]) => ({
            valore,
            etichetta: v.label,
          })),
        },
        {
          id: "priorita",
          etichetta: "Priorità",
          valore: (r) => r.priorita,
          opzioni: Object.entries(PRIORITA_PROGETTO).map(([valore, v]) => ({
            valore,
            etichetta: v.label,
          })),
        },
        {
          id: "categoria",
          etichetta: "Categoria",
          valore: (r) => r.categoria,
          opzioni: categorie,
        },
        {
          id: "cliente",
          etichetta: "Cliente",
          valore: (r) => r.cliente ?? "",
          opzioni: clienti.map((c) => ({ valore: c, etichetta: c })),
        },
      ]}
      colonne={[
        {
          id: "codice",
          intestazione: "Codice",
          ordina: (r) => r.codice,
          cella: (r) => <span className="font-medium tabular-nums">{r.codice}</span>,
        },
        {
          id: "nome",
          intestazione: "Nome",
          ordina: (r) => r.nome,
          minLarghezza: 180,
          cella: (r) => r.nome,
        },
        {
          id: "cliente",
          intestazione: "Cliente",
          ordina: (r) => r.cliente ?? "",
          cella: (r) => r.cliente ?? <span className="text-fg-3">—</span>,
        },
        {
          id: "categoria",
          intestazione: "Categoria",
          nascondiSotto: "lg",
          ordina: (r) => r.etichettaCategoria,
          cella: (r) => <span className="text-fg-2">{r.etichettaCategoria}</span>,
        },
        {
          id: "responsabile",
          intestazione: "Responsabile",
          nascondiSotto: "lg",
          ordina: (r) => r.responsabile ?? "",
          cella: (r) => r.responsabile ?? <span className="text-fg-3">—</span>,
        },
        {
          id: "stato",
          intestazione: "Stato",
          ordina: (r) => r.stato,
          cella: (r) => (
            <Badge variant={STATO_PROGETTO[r.stato]?.variante} dot>
              {STATO_PROGETTO[r.stato]?.label ?? r.stato}
            </Badge>
          ),
        },
        {
          id: "priorita",
          intestazione: "Priorità",
          ordina: (r) => ordinePriorita.indexOf(r.priorita),
          cella: (r) => (
            <Badge variant={PRIORITA_PROGETTO[r.priorita]?.variante}>
              {PRIORITA_PROGETTO[r.priorita]?.label ?? r.priorita}
            </Badge>
          ),
        },
        {
          id: "aggiornato",
          intestazione: "Aggiornato",
          ordina: (r) => r.aggiornato,
          nascondiSotto: "md",
          cella: (r) => <span className="tabular-nums text-fg-2">{dataIt(r.aggiornato)}</span>,
        },
      ]}
      azioniRiga={(r) => [
        { etichetta: "Apri", href: `/progetti/${r.id}`, icona: <ExternalLink /> },
        { etichetta: "Modifica", href: `/progetti/${r.id}/modifica`, icona: <Pencil /> },
      ]}
    />
  );
}

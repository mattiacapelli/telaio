"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

export interface RigaListino {
  id: string;
  nome: string;
  tipo: "Base" | "Add-on";
  compatibili: string;
  unaTantum: [string, string | null];
  canoneAnno: [string, string | null];
  canoneMese: [string, string | null];
  descrizione: string | null;
}

const Prezzo = ({ p }: { p: [string, string | null] }) => (
  <div className="flex flex-col items-end leading-tight">
    <span className="font-medium">{p[0]}</span>
    {p[1] && <span className="text-xs text-fg-3">{p[1]} ivato</span>}
  </div>
);

export function ListiniTabella({ righe }: { righe: RigaListino[] }) {
  return (
    <DataTable
      etichetta="Voci del listino"
      dati={righe}
      idRiga={(r) => r.id}
      testoRicerca={(r) => `${r.nome} ${r.descrizione ?? ""}`}
      segnapostoRicerca="Cerca una voce…"
      vuoto={{
        titolo: "Listino vuoto",
        descrizione: "Aggiungi le voci da Impostazioni → Listini e moduli.",
      }}
      filtri={[
        {
          id: "tipo",
          etichetta: "Tipo",
          valore: (r) => r.tipo,
          opzioni: [
            { valore: "Base", etichetta: "Basi" },
            { valore: "Add-on", etichetta: "Add-on" },
          ],
        },
      ]}
      colonne={[
        {
          id: "nome",
          intestazione: "Voce",
          ordina: (r) => r.nome,
          minLarghezza: 220,
          cella: (r) => (
            <div className="flex flex-col leading-tight">
              <span className="flex items-center gap-2 font-medium">
                {r.nome} <Badge variant={r.tipo === "Base" ? "brand" : "neutral"}>{r.tipo}</Badge>
              </span>
              {r.compatibili && <span className="text-xs text-fg-3">per {r.compatibili}</span>}
            </div>
          ),
        },
        {
          id: "ut",
          intestazione: "Una tantum",
          allinea: "destra",
          cella: (r) => <Prezzo p={r.unaTantum} />,
        },
        {
          id: "anno",
          intestazione: "Canone anno",
          allinea: "destra",
          nascondiSotto: "md",
          cella: (r) => <Prezzo p={r.canoneAnno} />,
        },
        {
          id: "mese",
          intestazione: "Canone mese",
          allinea: "destra",
          nascondiSotto: "md",
          cella: (r) => <Prezzo p={r.canoneMese} />,
        },
        {
          id: "descr",
          intestazione: "Descrizione",
          nascondiSotto: "lg",
          cella: (r) => <span className="text-fg-2">{r.descrizione ?? "—"}</span>,
        },
      ]}
    />
  );
}

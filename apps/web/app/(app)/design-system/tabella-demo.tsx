"use client";

import { Copy, Download, Pencil, Trash2 } from "lucide-react";
import { Badge, type VarianteBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { toast } from "@/components/ui/toast";

interface Riga {
  id: string;
  numero: string;
  cliente: string;
  stato: "bozza" | "emessa" | "pagata" | "scaduta";
  importoCent: number;
}

const CLIENTI = [
  "Bar Centrale",
  "Ferramenta Locatelli",
  "Palestra Kinesis",
  "Studio Pellegrini",
  "Padel Club Le Torri",
];
const STATI: Riga["stato"][] = ["bozza", "emessa", "pagata", "scaduta"];
const VARIANTI: Record<Riga["stato"], VarianteBadge> = {
  bozza: "neutral",
  emessa: "brand",
  pagata: "ok",
  scaduta: "bad",
};
const RIGHE: Riga[] = Array.from({ length: 34 }, (_, i) => ({
  id: String(i + 1),
  numero: `F-2026-${String(i + 1).padStart(3, "0")}`,
  cliente: CLIENTI[i % CLIENTI.length] ?? "",
  stato: STATI[i % STATI.length] ?? "bozza",
  importoCent: 12000 + ((i * 7919) % 90000),
}));
const euro = (c: number) => `€ ${(c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;

/** Esempio d'uso della DataTable con dati finti. */
export function TabellaDemo() {
  return (
    <DataTable
      etichetta="Fatture di esempio"
      dati={RIGHE}
      idRiga={(r) => r.id}
      dimensionePagina={10}
      selezionabile
      testoRicerca={(r) => `${r.numero} ${r.cliente}`}
      segnapostoRicerca="Cerca fattura o cliente…"
      filtri={[
        {
          id: "stato",
          etichetta: "Stato",
          valore: (r) => r.stato,
          opzioni: STATI.map((s) => ({ valore: s, etichetta: s[0]?.toUpperCase() + s.slice(1) })),
        },
        {
          id: "cliente",
          etichetta: "Cliente",
          valore: (r) => r.cliente,
          opzioni: CLIENTI.map((c) => ({ valore: c, etichetta: c })),
        },
      ]}
      colonne={[
        {
          id: "numero",
          intestazione: "Numero",
          ordina: (r) => r.numero,
          cella: (r) => <span className="font-medium">{r.numero}</span>,
        },
        {
          id: "cliente",
          intestazione: "Cliente",
          ordina: (r) => r.cliente,
          cella: (r) => r.cliente,
        },
        {
          id: "stato",
          intestazione: "Stato",
          ordina: (r) => r.stato,
          cella: (r) => (
            <Badge variant={VARIANTI[r.stato]} dot>
              {r.stato}
            </Badge>
          ),
        },
        {
          id: "importo",
          intestazione: "Importo",
          allinea: "destra",
          ordina: (r) => r.importoCent,
          cella: (r) => euro(r.importoCent),
        },
      ]}
      azioniRiga={(r) => [
        {
          etichetta: "Modifica",
          icona: <Pencil />,
          alSelezionare: () => toast(`Modifica ${r.numero}`),
        },
        {
          etichetta: "Duplica",
          icona: <Copy />,
          alSelezionare: () => toast(`Duplicata ${r.numero}`),
        },
        {
          etichetta: "Elimina",
          icona: <Trash2 />,
          pericolosa: true,
          alSelezionare: () => toast.errore(`Eliminata ${r.numero}`),
        },
      ]}
      azioniDiGruppo={(sel) => (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast(`${sel.length} fatture esportate`)}
          >
            <Download /> Esporta
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.errore(`${sel.length} fatture eliminate`)}
          >
            <Trash2 /> Elimina
          </Button>
        </>
      )}
      strumenti={<Button size="sm">Nuova fattura</Button>}
    />
  );
}

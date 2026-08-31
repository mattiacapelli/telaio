"use client";

import type { ReactNode } from "react";
import { Board, type Colonna, type Elemento } from "@/components/board";
import {
  SelettoreVista,
  Tabella,
  useVista,
  type ColonnaTabella,
  type RigaTabella,
} from "@/components/vista";

/**
 * Kanban + tabella sullo stesso insieme di dati.
 *
 * Le due viste condividono gli stessi elementi: la board li dispone per stato,
 * la tabella li elenca. Lo spostamento fra colonne resta disponibile solo in
 * kanban, mentre la tabella è pensata per la lettura e il confronto.
 */
export function VistaDoppia({
  chiave,
  entita,
  colonne,
  elementi,
  colonneTabella,
  righe,
  azioni,
  intestazione,
}: {
  chiave: string;
  entita: string;
  colonne: Colonna[];
  elementi: Elemento[];
  colonneTabella: ColonnaTabella[];
  righe: RigaTabella[];
  azioni?: ReactNode;
  intestazione?: ReactNode;
}) {
  const [vista, setVista] = useVista(chiave);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SelettoreVista chiave={chiave} vista={vista} setVista={setVista} />
        {/* `intestazione` e `azioni` sono JSX creato dal server component
            chiamante e passato come prop: senza una key qui, React a volte
            confonde questo slot con una lista quando il contenuto del
            componente varia in forma (rami condizionali diversi tra le
            pagine), producendo un avviso "key" fuorviante che punta al
            chiamante invece che a questo div. */}
        <div key="intestazione">{intestazione}</div>
        <div className="flex-1" />
        <div key="azioni">{azioni}</div>
      </div>

      {vista === "kanban" ? (
        <Board entita={entita} colonne={colonne} elementi={elementi} />
      ) : (
        <Tabella righe={righe} colonne={colonneTabella} />
      )}
    </div>
  );
}

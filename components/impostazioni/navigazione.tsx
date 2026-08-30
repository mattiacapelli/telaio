"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { X, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type VoceImpostazioni = {
  chiave: string;
  etichetta: string;
  icona: ReactNode;
  gruppo: string;
  contenuto: ReactNode;
};

/**
 * Impostazioni con pannello di navigazione a sinistra, come in Twenty.
 *
 * Le voci sono raggruppate per ambito (Studio, Integrazioni, Sistema) invece
 * di essere una lista piatta: con una dozzina di sezioni servono i gruppi per
 * trovare quello che si cerca.
 */
export function NavigazioneImpostazioni({ voci }: { voci: VoceImpostazioni[] }) {
  const [attiva, setAttiva] = useState(voci[0]?.chiave ?? "");
  // Su mobile la lista e il contenuto occupano lo schermo a turno: senza una
  // scelta esplicita si parte dalla lista, così la prima cosa aperta non è
  // già una sezione a caso schiacciata in una colonna troppo stretta.
  const [mostraContenuto, setMostraContenuto] = useState(false);
  const corrente = voci.find((v) => v.chiave === attiva) ?? voci[0];

  function scegli(chiave: string) {
    setAttiva(chiave);
    setMostraContenuto(true);
  }

  // Mantiene l'ordine di dichiarazione dei gruppi.
  const gruppi: { nome: string; voci: VoceImpostazioni[] }[] = [];
  for (const v of voci) {
    const g = gruppi.find((x) => x.nome === v.gruppo);
    if (g) g.voci.push(v);
    else gruppi.push({ nome: v.gruppo, voci: [v] });
  }

  return (
    <div className="tl-in flex h-screen flex-col overflow-hidden md:flex-row">
      <aside
        className={cn(
          "flex w-full flex-none flex-col overflow-y-auto border-border bg-surface md:w-[260px] md:border-r",
          mostraContenuto ? "hidden md:flex" : "flex",
        )}
      >
        {/* La X riporta al lavoro: le impostazioni sono un contesto a parte. */}
        <div className="flex h-12 flex-none items-center gap-2 px-3">
          <Link
            href="/"
            title="Chiudi le impostazioni"
            className="grid h-6 w-6 place-items-center rounded text-faint transition-colors hover:bg-[var(--alpha-light)] hover:text-text"
          >
            <X size={15} />
          </Link>
          <span className="text-md font-medium">Impostazioni</span>
        </div>

        <div className="flex flex-1 flex-col px-2 pb-2">
        {gruppi.map((g) => (
          <div key={g.nome} className="mb-2">
            <div className="px-1 pb-1 pt-2 text-xs font-medium text-faint">
              {g.nome}
            </div>
            {g.voci.map((v) => (
              <button
                key={v.chiave}
                onClick={() => scegli(v.chiave)}
                className={cn(
                  "flex h-7 w-full items-center gap-2 rounded-md px-1 text-md transition-colors",
                  attiva === v.chiave
                    ? "bg-[var(--alpha-light)] text-text"
                    : "text-muted hover:bg-[var(--alpha-light)] hover:text-text",
                )}
              >
                <span className="flex-none text-faint">{v.icona}</span>
                <span className="truncate">{v.etichetta}</span>
              </button>
            ))}
          </div>
        ))}
        </div>
      </aside>

      <div
        className={cn(
          "min-w-0 flex-1 flex-col overflow-hidden bg-bg",
          mostraContenuto ? "flex" : "hidden md:flex",
        )}
      >
        {/* Percorso di navigazione, come nel riferimento; su mobile raddoppia da "indietro". */}
        <div className="flex h-12 flex-none items-center gap-1.5 border-b border-border px-4 text-md">
          <button
            onClick={() => setMostraContenuto(false)}
            className="-ml-1 mr-1 grid h-6 w-6 flex-none place-items-center rounded text-faint transition-colors hover:bg-[var(--alpha-light)] hover:text-text md:hidden"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="hidden text-faint sm:inline">{corrente?.gruppo}</span>
          <span className="hidden text-faint sm:inline">/</span>
          <span className="truncate">{corrente?.etichetta}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-[720px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
            {corrente?.contenuto}
          </div>
        </div>
      </div>
    </div>
  );
}

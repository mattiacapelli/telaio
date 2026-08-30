"use client";

import { useState, type ReactNode } from "react";
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
  const corrente = voci.find((v) => v.chiave === attiva) ?? voci[0];

  // Mantiene l'ordine di dichiarazione dei gruppi.
  const gruppi: { nome: string; voci: VoceImpostazioni[] }[] = [];
  for (const v of voci) {
    const g = gruppi.find((x) => x.nome === v.gruppo);
    if (g) g.voci.push(v);
    else gruppi.push({ nome: v.gruppo, voci: [v] });
  }

  return (
    <div className="tl-in flex h-[calc(100vh-96px)] overflow-hidden rounded border border-border">
      <aside className="flex w-[230px] flex-none flex-col overflow-y-auto border-r border-border bg-surface p-2">
        {gruppi.map((g) => (
          <div key={g.nome} className="mb-2">
            <div className="px-1 pb-1 pt-2 text-xs font-medium text-faint">
              {g.nome}
            </div>
            {g.voci.map((v) => (
              <button
                key={v.chiave}
                onClick={() => setAttiva(v.chiave)}
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
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto bg-bg">
        <div className="mx-auto flex max-w-[720px] flex-col gap-6 px-6 py-6">
          {corrente?.contenuto}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScorriVersoAttivo } from "./scorri-verso-attivo";

/** Filtri come collegamenti: l'indirizzo porta lo stato, quindi funzionano anche senza JavaScript. */
export function FilterLinks({
  voci,
  attiva,
  etichetta,
}: {
  voci: { id: string; label: string; href: string; conteggio?: number }[];
  attiva: string;
  etichetta: string;
}) {
  return (
    <ScorriVersoAttivo
      role="group"
      aria-label={etichetta}
      className="flex flex-wrap gap-1.5 max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4"
    >
      {voci.map((v) => (
        <Link
          key={v.id}
          href={v.href}
          aria-current={v.id === attiva ? "true" : undefined}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm whitespace-nowrap transition-colors duration-150 max-md:h-[38px] max-md:px-3",
            v.id === attiva
              ? "border-transparent bg-fg text-on-fg"
              : "border-line bg-surface text-fg-2 hover:bg-hover hover:text-fg",
          )}
        >
          {v.label}
          {v.conteggio !== undefined && (
            <span className={v.id === attiva ? "text-on-fg/70" : "text-fg-3"}>{v.conteggio}</span>
          )}
        </Link>
      ))}
    </ScorriVersoAttivo>
  );
}

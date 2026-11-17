"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const due = (n: number) => String(n).padStart(2, "0");
export const comeOrologio = (s: number) =>
  `${Math.floor(s / 3600)}:${due(Math.floor((s % 3600) / 60))}:${due(s % 60)}`;

/** Secondi trascorsi da `da` (ISO), aggiornati ogni secondo. */
export function useSecondi(da: string | null) {
  const [secondi, setSecondi] = useState(0);
  useEffect(() => {
    if (!da) return;
    const calcola = () =>
      setSecondi(Math.max(0, Math.floor((Date.now() - new Date(da).getTime()) / 1000)));
    calcola();
    const t = setInterval(calcola, 1000);
    return () => clearInterval(t);
  }, [da]);
  return secondi;
}

/** Il timer in corso, sempre visibile in intestazione: un tocco porta alla pagina per fermarlo. */
export function TimerIndicatore({
  avviatoAt,
  etichetta,
}: {
  avviatoAt: string;
  etichetta: string;
}) {
  const secondi = useSecondi(avviatoAt);
  return (
    <Link
      href="/timer"
      aria-label={`Timer in corso: ${etichetta}`}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-brand px-2.5 text-sm font-medium text-brand-fg tabular-nums max-md:h-[42px] max-md:px-3"
    >
      <Clock aria-hidden className="size-4 animate-pulse" />
      {comeOrologio(secondi)}
    </Link>
  );
}

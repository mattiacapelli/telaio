"use client";

import { formattaOre } from "@telaio/core";
import { Play, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { avviaTimerAction, fermaTimerAction, scartaTimerAction } from "@/app/(app)/tempo/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import type { OpzioniTempo } from "./tempo-modal";

export interface TimerAttivo {
  avviatoAt: string;
  cliente: string;
  contratto: string | null;
  descrizione: string | null;
}

const due = (n: number) => String(n).padStart(2, "0");
const come = (s: number) =>
  `${Math.floor(s / 3600)}:${due(Math.floor((s % 3600) / 60))}:${due(s % 60)}`;

/** Avvia, ferma o scarta il timer. Mostra il tempo che scorre; a fine corsa i minuti si arrotondano col contratto. */
export function TimerCard({
  attivo,
  opzioni,
}: {
  attivo: TimerAttivo | null;
  opzioni: OpzioniTempo;
}) {
  const router = useRouter();
  const [inCorso, avvia] = useTransition();
  const [errore, setErrore] = useState<string | null>(null);
  const [secondi, setSecondi] = useState(0);

  useEffect(() => {
    if (!attivo) return;
    const calcola = () =>
      setSecondi(
        Math.max(0, Math.floor((Date.now() - new Date(attivo.avviatoAt).getTime()) / 1000)),
      );
    calcola();
    const t = setInterval(calcola, 1000);
    return () => clearInterval(t);
  }, [attivo]);

  function esegui(azione: () => Promise<{ ok: boolean; message?: string }>) {
    setErrore(null);
    avvia(async () => {
      const esito = await azione();
      if (!esito.ok) {
        setErrore(esito.message ?? "Errore");
        return;
      }
      toast(esito.message ?? "Fatto");
      router.refresh();
    });
  }

  if (attivo)
    return (
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-fg-2">Timer in corso</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums" aria-live="off">
            {come(secondi)}
          </p>
          <p className="truncate text-sm text-fg-2">
            {attivo.cliente}
            {attivo.contratto ? ` · ${attivo.contratto}` : ""}
            {attivo.descrizione ? ` · ${attivo.descrizione}` : ""}
          </p>
          <p className="text-xs text-fg-3">
            Contati finora {formattaOre(Math.max(1, Math.round(secondi / 60)))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => esegui(fermaTimerAction)} disabled={inCorso}>
            <Square /> Ferma
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => esegui(scartaTimerAction)}
            disabled={inCorso}
          >
            <X /> Scarta
          </Button>
        </div>
        {errore && (
          <p role="alert" className="w-full text-sm text-bad">
            {errore}
          </p>
        )}
      </Card>
    );

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const dati = new FormData(e.currentTarget);
          esegui(() => avviaTimerAction({ ok: false }, dati));
        }}
        className="flex flex-col gap-3"
      >
        <p className="text-sm font-medium">Avvia un timer</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
          <Select name="monteOreId" aria-label="Contratto a ore" defaultValue="">
            <option value="">Nessun contratto</option>
            {opzioni.contratti.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <Select name="clienteRefId" aria-label="Cliente" defaultValue="">
            <option value="">Cliente (se senza contratto)</option>
            {opzioni.clienti.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <Input
            name="descrizione"
            aria-label="Descrizione"
            placeholder="Cosa stai facendo?"
            maxLength={500}
          />
          <Button type="submit" disabled={inCorso}>
            <Play /> Avvia
          </Button>
        </div>
        {errore && (
          <p role="alert" className="text-sm text-bad">
            {errore}
          </p>
        )}
      </form>
    </Card>
  );
}

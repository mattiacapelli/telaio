"use client";

import { formattaOre } from "@telaio/core";
import { Play, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  aggiornaDescrizioneTimerAction,
  avviaTimerAction,
  fermaTimerAction,
  scartaTimerAction,
} from "@/app/(app)/tempo/actions";
import { BarraOre } from "@/components/domain/barra-ore";
import { comeOrologio, useSecondi } from "@/components/shell/timer-indicatore";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface ContrattoRapido {
  id: string;
  nome: string;
  cliente: string;
  incluse: number;
  usati: number;
  rimanenti: number;
  extra: number;
  percentuale: number;
  n: number;
  inizio: string;
  fine: string;
}

export interface RecenteRapido {
  clienteRefId: string;
  cliente: string;
  monteOreId: string | null;
  contratto: string | null;
  descrizione: string | null;
}

export interface TimerInCorso {
  avviatoAt: string;
  cliente: string;
  contratto: string | null;
  descrizione: string | null;
  /** il saldo del contratto prima di questo timer, se è legato a un contratto */
  saldo: ContrattoRapido | null;
}

/**
 * Schermata essenziale del tempo, pensata per il telefono ma uguale sul desktop: un grosso
 * orologio con Ferma, oppure l'elenco di ciò che si può avviare con un tocco (contratti a ore e
 * ultimi lavori). La descrizione si scrive dopo l'avvio.
 */
export function TimerSemplice({
  attivo,
  contratti,
  recenti,
  clienti,
}: {
  attivo: TimerInCorso | null;
  contratti: ContrattoRapido[];
  recenti: RecenteRapido[];
  clienti: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [inCorso, avvia] = useTransition();
  const [errore, setErrore] = useState<string | null>(null);
  const [descrizione, setDescrizione] = useState(attivo?.descrizione ?? "");
  const [altroCliente, setAltroCliente] = useState("");
  const secondi = useSecondi(attivo?.avviatoAt ?? null);

  // l'orologio resta leggibile anche dalla scheda del browser
  useEffect(() => {
    if (!attivo) return;
    const prima = document.title;
    document.title = `${comeOrologio(secondi)} · Timer`;
    return () => {
      document.title = prima;
    };
  }, [attivo, secondi]);

  function esegui(azione: () => Promise<{ ok: boolean; message?: string }>) {
    setErrore(null);
    avvia(async () => {
      const esito = await azione();
      if (!esito.ok) {
        setErrore(esito.message ?? "Errore");
        return;
      }
      if (esito.message) toast(esito.message);
      router.refresh();
    });
  }

  const parti = (campi: Record<string, string | null | undefined>) => {
    const dati = new FormData();
    for (const [k, v] of Object.entries(campi)) if (v) dati.set(k, v);
    setDescrizione(campi.descrizione ?? "");
    esegui(() => avviaTimerAction({ ok: false }, dati));
  };

  if (attivo) {
    const minuti = Math.max(1, Math.round(secondi / 60));
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface px-4 py-8 text-center">
          <p className="text-sm font-medium text-fg-2">In corso</p>
          <p
            className="text-6xl font-semibold tracking-tight tabular-nums max-sm:text-5xl"
            aria-label="Tempo trascorso"
          >
            {comeOrologio(secondi)}
          </p>
          <p className="text-base font-medium">
            {attivo.cliente}
            {attivo.contratto ? ` · ${attivo.contratto}` : ""}
          </p>
          <p className="text-xs text-fg-3">Finora {formattaOre(minuti)}</p>
        </div>

        <Input
          aria-label="Cosa stai facendo"
          placeholder="Cosa stai facendo? (puoi scriverlo dopo)"
          maxLength={500}
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          onBlur={() => void aggiornaDescrizioneTimerAction(descrizione)}
          className="max-md:h-12"
        />

        {attivo.saldo && (
          <div className="rounded-lg border border-line bg-surface p-3">
            <p className="mb-2 text-xs text-fg-2">Saldo del contratto prima di questo timer</p>
            <BarraOre saldo={attivo.saldo} />
          </div>
        )}

        <Button
          type="button"
          onClick={() => esegui(fermaTimerAction)}
          disabled={inCorso}
          className="h-16 w-full text-lg max-md:h-16"
        >
          <Square className="size-5" /> Ferma
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => esegui(scartaTimerAction)}
          disabled={inCorso}
          className="w-full"
        >
          <X /> Scarta senza registrare
        </Button>
        {errore && (
          <p role="alert" className="text-center text-sm text-bad">
            {errore}
          </p>
        )}
      </div>
    );
  }

  const riga =
    "flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors duration-150 hover:border-line-strong active:bg-hover disabled:opacity-60";
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      {contratti.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="t-contratti">
          <h2 id="t-contratti" className="text-sm font-semibold text-fg-2">
            Contratti a ore
          </h2>
          {contratti.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={inCorso}
              onClick={() => parti({ monteOreId: c.id })}
              className={riga}
              aria-label={`Avvia il timer su ${c.cliente}, ${c.nome}`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-fg">
                <Play className="size-4" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-medium">{c.cliente}</span>
                <span className="truncate text-xs text-fg-3">{c.nome}</span>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    c.extra > 0 ? "font-medium text-bad" : "text-fg-2",
                  )}
                >
                  {c.extra > 0
                    ? `${formattaOre(c.extra)} oltre il monte`
                    : `${formattaOre(c.rimanenti)} rimanenti`}
                </span>
              </span>
            </button>
          ))}
        </section>
      )}

      {recenti.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="t-recenti">
          <h2 id="t-recenti" className="text-sm font-semibold text-fg-2">
            Ultimi lavori
          </h2>
          {recenti.map((r) => (
            <button
              key={`${r.clienteRefId}-${r.monteOreId}-${r.descrizione}`}
              type="button"
              disabled={inCorso}
              onClick={() =>
                parti({
                  clienteRefId: r.clienteRefId,
                  monteOreId: r.monteOreId,
                  descrizione: r.descrizione,
                })
              }
              className={riga}
              aria-label={`Avvia di nuovo: ${r.cliente}${r.descrizione ? `, ${r.descrizione}` : ""}`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-subtle text-fg-2">
                <Play className="size-4" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{r.descrizione ?? r.cliente}</span>
                <span className="truncate text-xs text-fg-3">
                  {[r.descrizione ? r.cliente : null, r.contratto].filter(Boolean).join(" · ") ||
                    "Senza contratto"}
                </span>
              </span>
            </button>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="t-altro">
        <h2 id="t-altro" className="text-sm font-semibold text-fg-2">
          Un altro cliente
        </h2>
        <div className="flex gap-2">
          <Select
            aria-label="Cliente"
            value={altroCliente}
            onChange={(e) => setAltroCliente(e.target.value)}
            className="flex-1 max-md:h-12"
          >
            <option value="">Scegli il cliente</option>
            {clienti.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            disabled={inCorso || !altroCliente}
            onClick={() => parti({ clienteRefId: altroCliente })}
            className="max-md:h-12"
          >
            <Play /> Avvia
          </Button>
        </div>
      </section>
      {errore && (
        <p role="alert" className="text-center text-sm text-bad">
          {errore}
        </p>
      )}
    </div>
  );
}

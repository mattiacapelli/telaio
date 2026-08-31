"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { RigaCestino } from "@/components/cestino";
import type { Entita } from "@/lib/eliminazione";

const ENTITA: { chiave: Entita; etichetta: string }[] = [
  { chiave: "cliente", etichetta: "Clienti" },
  { chiave: "preventivo", etichetta: "Preventivi" },
  { chiave: "progetto", etichetta: "Progetti" },
  { chiave: "attivita", etichetta: "Attività" },
  { chiave: "ticket", etichetta: "Ticket" },
  { chiave: "fattura", etichetta: "Fatture" },
  { chiave: "contratto", etichetta: "Contratti" },
  { chiave: "costo", etichetta: "Costi" },
  { chiave: "registrazioneOre", etichetta: "Ore" },
  { chiave: "documento", etichetta: "Documenti" },
  { chiave: "workflow", etichetta: "Workflow" },
  { chiave: "modelloPdf", etichetta: "Modelli PDF" },
  { chiave: "testoStandard", etichetta: "Testi standard" },
  { chiave: "webhook", etichetta: "Webhook" },
  { chiave: "contoIncasso", etichetta: "Conti incasso" },
  { chiave: "prodotto", etichetta: "Prodotti" },
  { chiave: "pianoProdotto", etichetta: "Piani prodotto" },
  { chiave: "licenzaProdotto", etichetta: "Licenze" },
];

type Riga = { id: string; nome: string; dettaglio?: string; eliminataIl: string };

/** Cestino: un'entità alla volta, caricata al momento della scelta. */
export function CestinoPannello() {
  const [attiva, setAttiva] = useState<Entita>("cliente");
  const [righe, setRighe] = useState<Riga[] | null>(null);
  const [caricando, setCaricando] = useState(false);

  async function carica(entita: Entita) {
    setAttiva(entita);
    setCaricando(true);
    setRighe(null);
    const r = await fetch(`/api/cestino/${entita}`, { cache: "no-store" }).catch(() => null);
    setCaricando(false);
    if (r?.ok) setRighe(await r.json());
  }

  useEffect(() => {
    carica("cliente");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {ENTITA.map((e) => (
          <button
            key={e.chiave}
            onClick={() => carica(e.chiave)}
            className={
              "rounded-md border px-2 py-1 text-xs transition-colors " +
              (attiva === e.chiave
                ? "border-accent-line bg-accent-soft text-[var(--accent-text)]"
                : "border-border text-muted hover:border-border2 hover:text-text")
            }
          >
            {e.etichetta}
          </button>
        ))}
      </div>

      <div className="rounded-md border border-border bg-surface">
        {caricando ? (
          <div className="flex items-center justify-center gap-2 px-3 py-8 text-xs text-faint">
            <Loader2 size={14} className="animate-spin" /> Carico…
          </div>
        ) : !righe || righe.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-faint">
            Il cestino {ENTITA.find((e) => e.chiave === attiva)?.etichetta.toLowerCase()} è vuoto.
          </div>
        ) : (
          righe.map((r) => (
            <RigaCestino
              key={r.id}
              entita={attiva}
              id={r.id}
              nome={r.nome}
              dettaglio={r.dettaglio}
            />
          ))
        )}
      </div>
    </div>
  );
}

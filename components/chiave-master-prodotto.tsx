"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Copy, Check, AlertTriangle, RefreshCw } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { dataEstesa } from "@/lib/format";

/**
 * Chiave master del prodotto: a differenza di un'API key non è "usa e
 * getta". La pubblica resta sempre visibile, perché va ricopiata ogni
 * volta che si compila una nuova versione del software del cliente. La
 * privata non è mai visibile: nemmeno appena generata, nemmeno cifrata.
 */
export function ChiaveMasterProdotto({
  prodottoId,
  chiavePubblicaMaster,
  chiaveMasterGenerataIl,
}: {
  prodottoId: string;
  chiavePubblicaMaster: string | null;
  chiaveMasterGenerataIl: string | null;
}) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [copiata, setCopiata] = useState(false);
  const [confermaAperta, setConfermaAperta] = useState(false);

  async function genera(conferma: boolean) {
    setErrore(null);
    setInCorso(true);
    const r = await fetch(`/api/prodotti/${prodottoId}/chiave-master`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conferma }),
    }).catch(() => null);
    setInCorso(false);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Generazione non riuscita");
      return;
    }
    setConfermaAperta(false);
    router.refresh();
  }

  async function copia() {
    if (!chiavePubblicaMaster) return;
    await navigator.clipboard.writeText(chiavePubblicaMaster).catch(() => {});
    setCopiata(true);
    setTimeout(() => setCopiata(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <KeyRound size={13} />
        Chiave master (verifica offline)
      </div>

      {chiavePubblicaMaster ? (
        <>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded border border-border bg-surface2 px-2 py-1.5 text-xs">
              {chiavePubblicaMaster}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={copia}>
              {copiata ? <Check /> : <Copy />} {copiata ? "Copiata" : "Copia"}
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-md border border-border bg-surface2 px-3 py-2 text-xs text-muted">
            <AlertTriangle size={14} className="mt-0.5 flex-none" />
            <span>
              Questa è pubblica: incorporala nel software del cliente, può essere distribuita
              liberamente. La privata non è mai visibile: resta solo qui, cifrata, e serve solo
              a certificare le licenze di questo prodotto.
            </span>
          </div>
          {chiaveMasterGenerataIl && (
            <div className="text-xs text-faint">Generata il {dataEstesa(chiaveMasterGenerataIl)}</div>
          )}
          <div className="flex items-center">
            <div className="flex-1" />
            <Dialog open={confermaAperta} onOpenChange={setConfermaAperta}>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline">
                  <RefreshCw /> Rigenera
                </Button>
              </DialogTrigger>
              <DialogContent titolo="Rigenerare la chiave master?">
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-start gap-2 rounded-md border border-[var(--neg)] bg-[var(--neg-soft)] px-3 py-2 text-xs text-neg">
                    <AlertTriangle size={14} className="mt-0.5 flex-none" />
                    <span>
                      Tutti i file di licenza offline già emessi per questo prodotto smetteranno
                      di essere verificabili dal software compilato con la vecchia chiave
                      pubblica. Andranno rigenerati e ridistribuiti ai clienti.
                    </span>
                  </div>
                  {errore && (
                    <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
                      {errore}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setConfermaAperta(false)}>
                      Annulla
                    </Button>
                    <Button type="button" size="sm" disabled={inCorso} onClick={() => genera(true)}>
                      {inCorso ? "Rigenero…" : "Rigenera comunque"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </>
      ) : (
        <>
          <div className="text-xs text-faint">
            Nessuna chiave master generata: senza, non si possono emettere file di licenza offline.
          </div>
          {errore && (
            <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
              {errore}
            </div>
          )}
          <div className="flex items-center">
            <div className="flex-1" />
            <Button type="button" size="sm" disabled={inCorso} onClick={() => genera(false)}>
              {inCorso ? "Genero…" : "Genera chiave master"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

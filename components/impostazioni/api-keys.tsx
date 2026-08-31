"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, KeyRound, Copy, Check, AlertTriangle } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Campo } from "@/components/ui/input";
import { dataEstesa } from "@/lib/format";

export type ApiKeyRiga = {
  id: string;
  nome: string;
  suffisso: string;
  scadeIl: string | null;
  ultimoUsoIl: string | null;
  revocataIl: string | null;
  createdAt: string;
};

/**
 * Elenco delle API key, come Twenty in Impostazioni → API & Webhooks.
 *
 * La chiave in chiaro si vede una volta sola, al momento della creazione:
 * da lì in poi anche Telaio ne conosce solo l'impronta, esattamente come
 * per le password.
 */
export function ElencoApiKey({ chiavi }: { chiavi: ApiKeyRiga[] }) {
  const router = useRouter();
  const [errore, setErrore] = useState<string | null>(null);

  async function revoca(id: string, nome: string) {
    if (!confirm(`Revocare la chiave «${nome}»? Chi la usa perderà l'accesso subito.`)) return;
    const r = await fetch(`/api/api-keys/${id}`, { method: "DELETE" }).catch(() => null);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Revoca non riuscita");
      return;
    }
    router.refresh();
  }

  const attive = chiavi.filter((k) => !k.revocataIl);
  const revocate = chiavi.filter((k) => k.revocataIl);

  return (
    <div className="flex flex-col gap-2">
      {errore && (
        <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
          {errore}
        </div>
      )}

      <div className="rounded-md border border-border">
        {attive.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-faint">
            Nessuna chiave attiva.
          </div>
        ) : (
          attive.map((k) => (
            <div key={k.id} className="group flex items-center gap-2 border-b border-border px-3 py-2 last:border-0">
              <KeyRound size={13} className="flex-none text-faint" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{k.nome}</div>
                <div className="truncate text-xs text-faint">
                  ···{k.suffisso}
                  {k.ultimoUsoIl ? ` · usata l'ultima volta il ${dataEstesa(k.ultimoUsoIl)}` : " · mai usata"}
                  {k.scadeIl ? ` · scade il ${dataEstesa(k.scadeIl)}` : ""}
                </div>
              </div>
              <button
                onClick={() => revoca(k.id, k.nome)}
                className="flex-none text-xs text-faint opacity-0 transition-opacity hover:text-neg group-hover:opacity-100"
              >
                revoca
              </button>
            </div>
          ))
        )}
      </div>

      {revocate.length > 0 && (
        <details className="text-xs text-faint">
          <summary className="cursor-pointer select-none">{revocate.length} revocate</summary>
          <div className="mt-1 rounded-md border border-border">
            {revocate.map((k) => (
              <div key={k.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-faint last:border-0">
                <KeyRound size={13} className="flex-none" />
                <div className="min-w-0 flex-1">
                  <div className="truncate line-through">{k.nome}</div>
                  <div className="truncate">···{k.suffisso} · revocata il {dataEstesa(k.revocataIl)}</div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="flex">
        <div className="flex-1" />
        <NuovaApiKey />
      </div>
    </div>
  );
}

function NuovaApiKey() {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [nome, setNome] = useState("");
  const [scadeIl, setScadeIl] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [chiaveCreata, setChiaveCreata] = useState<string | null>(null);
  const [copiata, setCopiata] = useState(false);

  async function crea(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    const r = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, scadeIl: scadeIl || null }),
    }).catch(() => null);
    setInCorso(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Creazione non riuscita");
      return;
    }
    const creata = await r.json();
    setChiaveCreata(creata.chiave);
  }

  function chiudi(v: boolean) {
    setAperto(v);
    if (!v) {
      setNome("");
      setScadeIl("");
      setErrore(null);
      setChiaveCreata(null);
      setCopiata(false);
      router.refresh();
    }
  }

  async function copia() {
    if (!chiaveCreata) return;
    await navigator.clipboard.writeText(chiaveCreata).catch(() => {});
    setCopiata(true);
  }

  return (
    <Dialog open={aperto} onOpenChange={chiudi}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Plus /> Nuova chiave</Button>
      </DialogTrigger>
      <DialogContent titolo="Nuova API key" descrizione="Usala per autenticare il server MCP o altre integrazioni.">
        {chiaveCreata ? (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-2 rounded-md border border-[var(--pos)] bg-[var(--pos-soft)] px-3 py-2 text-xs text-pos">
              <AlertTriangle size={14} className="mt-0.5 flex-none" />
              <span>Copiala adesso: non potrai più rivederla dopo aver chiuso questa finestra.</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded border border-border bg-surface2 px-2 py-1.5 text-xs">
                {chiaveCreata}
              </code>
              <Button type="button" size="sm" variant="outline" onClick={copia}>
                {copiata ? <Check /> : <Copy />} {copiata ? "Copiata" : "Copia"}
              </Button>
            </div>
            <div className="flex items-center justify-end">
              <Button type="button" size="sm" onClick={() => chiudi(false)}>Fatto</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={crea} className="flex flex-col">
            <div className="flex flex-col gap-3 p-4">
              <Campo etichetta="Nome" nota="Per riconoscerla nell'elenco, es. «Server MCP»">
                <Input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
              </Campo>
              <Campo etichetta="Scadenza" nota="Facoltativa">
                <Input type="date" value={scadeIl} onChange={(e) => setScadeIl(e.target.value)} />
              </Campo>
              {errore && (
                <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
                  {errore}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-border px-4 py-3">
              <div className="flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={() => chiudi(false)}>
                Annulla
              </Button>
              <Button type="submit" size="sm" disabled={inCorso || !nome.trim()}>
                {inCorso ? "Creo…" : "Crea"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

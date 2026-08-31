"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Webhook as WebhookIcon, Copy, Check, AlertTriangle, Send, Loader2, ChevronDown } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Campo } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { dataEstesa } from "@/lib/format";
import { EliminaRecord } from "@/components/elimina-record";

export type EventoCatalogo = { chiave: string; etichetta: string };

export type WebhookRiga = {
  id: string;
  nome: string;
  url: string;
  eventi: string[];
  attivo: boolean;
  createdAt: string;
  _count: { consegne: number };
};

/** Elenco dei webhook in uscita, come Twenty in Impostazioni → API & Webhooks. */
export function ElencoWebhook({ webhook, catalogo }: { webhook: WebhookRiga[]; catalogo: EventoCatalogo[] }) {
  const router = useRouter();
  const [errore, setErrore] = useState<string | null>(null);
  const [espanso, setEspanso] = useState<string | null>(null);

  async function alterna(id: string, attivo: boolean) {
    const r = await fetch(`/api/webhook/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attivo: !attivo }),
    }).catch(() => null);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Aggiornamento non riuscito");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {errore && (
        <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
          {errore}
        </div>
      )}

      <div className="rounded-md border border-border">
        {webhook.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-faint">
            Nessun webhook configurato.
          </div>
        ) : (
          webhook.map((w) => (
            <div key={w.id} className="border-b border-border last:border-0">
              <button
                onClick={() => setEspanso((v) => (v === w.id ? null : w.id))}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--alpha-lighter)]"
              >
                <WebhookIcon size={13} className={cn("flex-none", w.attivo ? "text-faint" : "text-faint opacity-40")} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{w.nome}</div>
                  <div className="truncate text-xs text-faint">{w.url}</div>
                </div>
                <span className="flex-none text-xs text-faint">
                  {w.eventi.includes("*") ? "tutti gli eventi" : `${w.eventi.length} eventi`}
                </span>
                <label
                  className="flex flex-none items-center gap-1.5 text-xs text-muted"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input type="checkbox" checked={w.attivo} onChange={() => alterna(w.id, w.attivo)} />
                  attivo
                </label>
                <ChevronDown size={13} className={cn("flex-none text-faint transition-transform", espanso === w.id && "rotate-180")} />
              </button>
              {espanso === w.id && <DettaglioWebhook webhook={w} catalogo={catalogo} />}
            </div>
          ))
        )}
      </div>

      <div className="flex">
        <div className="flex-1" />
        <NuovoWebhook catalogo={catalogo} />
      </div>
    </div>
  );
}

function DettaglioWebhook({ webhook, catalogo }: { webhook: WebhookRiga; catalogo: EventoCatalogo[] }) {
  const [testando, setTestando] = useState(false);
  const [esitoTest, setEsitoTest] = useState<string | null>(null);
  const [registro, setRegistro] = useState<any[] | null>(null);

  async function testa() {
    setTestando(true);
    setEsitoTest(null);
    const r = await fetch(`/api/webhook/${webhook.id}/test`, { method: "POST" }).catch(() => null);
    setTestando(false);
    const d = await r?.json().catch(() => null);
    if (!r) {
      setEsitoTest("richiesta non riuscita");
    } else if (d?.ok) {
      setEsitoTest(`consegnato (${d.statusHttp})`);
    } else {
      setEsitoTest(d?.errore ?? "consegna fallita");
    }
    caricaRegistro();
  }

  async function caricaRegistro() {
    const r = await fetch(`/api/webhook/${webhook.id}/registro`).catch(() => null);
    if (r?.ok) setRegistro(await r.json());
  }

  return (
    <div className="border-t border-border bg-surface2 px-3 py-2">
      <div className="mb-2 flex flex-wrap gap-1">
        {webhook.eventi.includes("*") ? (
          <span className="rounded bg-surface3 px-1.5 py-0.5 text-xs text-muted">tutti gli eventi</span>
        ) : (
          webhook.eventi.map((ev) => (
            <span key={ev} className="rounded bg-surface3 px-1.5 py-0.5 text-xs text-muted">
              {catalogo.find((c) => c.chiave === ev)?.etichetta ?? ev}
            </span>
          ))
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={testa} disabled={testando}>
          {testando ? <Loader2 className="animate-spin" /> : <Send />}
          {testando ? "Invio…" : "Invia una prova"}
        </Button>
        {esitoTest && <span className="text-xs text-muted">{esitoTest}</span>}
        <div className="flex-1" />
        <button onClick={caricaRegistro} className="text-xs text-faint hover:text-text">
          {webhook._count.consegne} consegne · aggiorna
        </button>
        <EliminaRecord entita="webhook" id={webhook.id} nome={webhook.nome} size="sm" />
      </div>
      {registro && (
        <div className="mt-2 flex flex-col gap-1">
          {registro.length === 0 ? (
            <div className="text-xs text-faint">Nessuna consegna ancora.</div>
          ) : (
            registro.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs">
                <span className={r.successo ? "text-pos" : "text-neg"}>{r.successo ? "✓" : "✕"}</span>
                <span className="text-muted">{r.evento}</span>
                <span className="text-faint">{r.statusHttp ?? r.errore}</span>
                <div className="flex-1" />
                <span className="text-faint">{dataEstesa(r.inviataIl)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NuovoWebhook({ catalogo }: { catalogo: EventoCatalogo[] }) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [eventi, setEventi] = useState<string[]>([]);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [secretCreato, setSecretCreato] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);

  function alterna(chiave: string) {
    setEventi((prec) => (prec.includes(chiave) ? prec.filter((e) => e !== chiave) : [...prec, chiave]));
  }

  async function crea(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    const r = await fetch("/api/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, url, eventi }),
    }).catch(() => null);
    setInCorso(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Creazione non riuscita");
      return;
    }
    const creato = await r.json();
    setSecretCreato(creato.secret);
  }

  function chiudi(v: boolean) {
    setAperto(v);
    if (!v) {
      setNome("");
      setUrl("");
      setEventi([]);
      setErrore(null);
      setSecretCreato(null);
      setCopiato(false);
      router.refresh();
    }
  }

  async function copia() {
    if (!secretCreato) return;
    await navigator.clipboard.writeText(secretCreato).catch(() => {});
    setCopiato(true);
  }

  return (
    <Dialog open={aperto} onOpenChange={chiudi}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Plus /> Nuovo webhook</Button>
      </DialogTrigger>
      <DialogContent titolo="Nuovo webhook" descrizione="Invia una POST firmata al tuo endpoint quando succede uno degli eventi scelti.">
        {secretCreato ? (
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-2 rounded-md border border-[var(--pos)] bg-[var(--pos-soft)] px-3 py-2 text-xs text-pos">
              <AlertTriangle size={14} className="mt-0.5 flex-none" />
              <span>Copia il secret adesso: usalo per verificare la firma nell'header X-Telaio-Signature. Non potrai più rivederlo.</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded border border-border bg-surface2 px-2 py-1.5 text-xs">
                {secretCreato}
              </code>
              <Button type="button" size="sm" variant="outline" onClick={copia}>
                {copiato ? <Check /> : <Copy />} {copiato ? "Copiato" : "Copia"}
              </Button>
            </div>
            <div className="flex items-center justify-end">
              <Button type="button" size="sm" onClick={() => chiudi(false)}>Fatto</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={crea} className="flex flex-col">
            <div className="flex flex-col gap-3 p-4">
              <Campo etichetta="Nome">
                <Input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
              </Campo>
              <Campo etichetta="URL" nota="Deve rispondere 2xx entro 8 secondi">
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…"
                  required
                />
              </Campo>
              <Campo etichetta="Eventi">
                <div className="flex flex-col gap-1 rounded-md border border-border p-2">
                  <label className="flex items-center gap-1.5 border-b border-border pb-1.5 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={eventi.includes("*")}
                      onChange={() => alterna("*")}
                    />
                    Tutti gli eventi
                  </label>
                  {!eventi.includes("*") &&
                    catalogo.map((ev) => (
                      <label key={ev.chiave} className="flex items-center gap-1.5 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={eventi.includes(ev.chiave)}
                          onChange={() => alterna(ev.chiave)}
                        />
                        {ev.etichetta}
                      </label>
                    ))}
                </div>
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
              <Button type="submit" size="sm" disabled={inCorso || !nome.trim() || !url.trim() || eventi.length === 0}>
                {inCorso ? "Creo…" : "Crea"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

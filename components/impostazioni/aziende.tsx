"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Star, Trash2, Building2, Image as ImageIcon, X } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Campo, Select } from "@/components/ui/input";

export type Azienda = {
  id: string;
  ragioneSociale: string;
  partitaIva: string | null;
  codiceFiscale: string | null;
  iban: string | null;
  regimeFiscale: string | null;
  regimeFiscaleId: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  provincia: string | null;
  telefono: string | null;
  email: string | null;
  pec: string | null;
  sitoWeb: string | null;
  logoChiave: string | null;
  predefinita: boolean;
};

export type RegimeFiscaleOpzione = { id: string; nome: string };

const CAMPI: { chiave: keyof Azienda; etichetta: string; nota?: string }[] = [
  { chiave: "ragioneSociale", etichetta: "Ragione sociale" },
  { chiave: "partitaIva", etichetta: "Partita IVA" },
  { chiave: "codiceFiscale", etichetta: "Codice fiscale", nota: "Se diverso dalla partita IVA" },
  { chiave: "regimeFiscale", etichetta: "Regime fiscale", nota: "Es. \"Regime forfettario, operazione senza applicazione dell'IVA\"" },
  { chiave: "indirizzo", etichetta: "Indirizzo" },
  { chiave: "citta", etichetta: "Città" },
  { chiave: "cap", etichetta: "CAP" },
  { chiave: "provincia", etichetta: "Provincia" },
  { chiave: "telefono", etichetta: "Telefono" },
  { chiave: "email", etichetta: "Email" },
  { chiave: "pec", etichetta: "PEC" },
  { chiave: "sitoWeb", etichetta: "Sito web" },
  { chiave: "iban", etichetta: "IBAN" },
];

/**
 * Elenco delle ragioni sociali configurate.
 *
 * Un campo lasciato vuoto qui non appare nei PDF: non c'è bisogno di
 * compilare tutto subito, solo quello che serve stampare.
 */
export function ElencoAziende({ aziende, regimi }: { aziende: Azienda[]; regimi: RegimeFiscaleOpzione[] }) {
  const router = useRouter();
  const [errore, setErrore] = useState<string | null>(null);
  const [modificaId, setModificaId] = useState<string | null>(null);

  async function rendiPredefinita(id: string) {
    await fetch(`/api/aziende/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predefinita: true }),
    }).catch(() => null);
    router.refresh();
  }

  async function elimina(id: string, nome: string) {
    if (!confirm(`Eliminare «${nome}»?`)) return;
    const r = await fetch(`/api/aziende/${id}`, { method: "DELETE" }).catch(() => null);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Eliminazione non riuscita");
      return;
    }
    router.refresh();
  }

  const azienda = aziende.find((a) => a.id === modificaId) ?? null;

  return (
    <div className="flex flex-col gap-2">
      {errore && (
        <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
          {errore}
        </div>
      )}

      <div className="rounded-md border border-border">
        {aziende.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-faint">
            Nessuna ragione sociale configurata: i documenti si stampano senza dati dell&apos;emittente.
          </div>
        ) : (
          aziende.map((a) => (
            <button
              key={a.id}
              onClick={() => setModificaId(a.id)}
              className="group flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-[var(--alpha-lighter)]"
            >
              <Building2 size={13} className="flex-none text-faint" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{a.ragioneSociale}</div>
                <div className="truncate text-xs text-faint">
                  {[a.partitaIva, a.citta].filter(Boolean).join(" · ") || "nessun altro dato"}
                </div>
              </div>
              {a.predefinita ? (
                <span className="flex flex-none items-center gap-1 text-xs text-accent">
                  <Star size={11} /> predefinita
                </span>
              ) : (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); rendiPredefinita(a.id); }}
                  className="flex-none text-xs text-faint opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
                >
                  rendi predefinita
                </span>
              )}
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); elimina(a.id, a.ragioneSociale); }}
                title="Elimina"
                className="grid h-6 w-6 flex-none place-items-center rounded text-faint opacity-0 transition-all hover:bg-surface2 hover:text-neg group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </span>
            </button>
          ))
        )}
      </div>

      <div className="flex">
        <div className="flex-1" />
        <NuovaAzienda />
      </div>

      {azienda && (
        <ModificaAzienda azienda={azienda} regimi={regimi} onClose={() => setModificaId(null)} />
      )}
    </div>
  );
}

function NuovaAzienda() {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [nome, setNome] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function crea(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    const r = await fetch("/api/aziende", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ragioneSociale: nome }),
    }).catch(() => null);
    setInCorso(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Creazione non riuscita");
      return;
    }
    setAperto(false);
    setNome("");
    router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Plus /> Nuova ragione sociale</Button>
      </DialogTrigger>
      <DialogContent
        titolo="Nuova ragione sociale"
        descrizione="Aggiungi gli altri dati e il logo dopo averla creata."
      >
        <form onSubmit={crea} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <Campo etichetta="Ragione sociale">
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
            </Campo>
            {errore && (
              <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
                {errore}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-border px-4 py-3">
            <div className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" size="sm" disabled={inCorso || !nome.trim()}>
              {inCorso ? "Creo…" : "Crea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModificaAzienda({
  azienda,
  regimi,
  onClose,
}: {
  azienda: Azienda;
  regimi: RegimeFiscaleOpzione[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [d, setD] = useState<Azienda>(azienda);
  const [inCorso, setInCorso] = useState(false);
  const [caricandoLogo, setCaricandoLogo] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    const { id, predefinita, logoChiave, ...campi } = d;
    const r = await fetch(`/api/aziende/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campi),
    }).catch(() => null);
    setInCorso(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Salvataggio non riuscito");
      return;
    }
    onClose();
    router.refresh();
  }

  async function caricaLogo(file: File) {
    setCaricandoLogo(true);
    setErrore(null);
    const form = new FormData();
    form.append("file", file);
    const r = await fetch(`/api/aziende/${d.id}/logo`, { method: "POST", body: form }).catch(() => null);
    setCaricandoLogo(false);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Caricamento del logo non riuscito");
      return;
    }
    router.refresh();
  }

  async function rimuoviLogo() {
    setCaricandoLogo(true);
    await fetch(`/api/aziende/${d.id}/logo`, { method: "DELETE" }).catch(() => null);
    setCaricandoLogo(false);
    setD({ ...d, logoChiave: null });
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent titolo={azienda.ragioneSociale} descrizione="Un campo vuoto non compare nei documenti stampati.">
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <Campo etichetta="Logo" nota="PNG o JPEG, fino a 2 MB. Compare nell'intestazione dei PDF.">
              <div className="flex items-center gap-2">
                {d.logoChiave ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <ImageIcon size={13} /> logo caricato
                  </span>
                ) : (
                  <span className="text-xs text-faint">nessun logo</span>
                )}
                <div className="flex-1" />
                <label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    disabled={caricandoLogo}
                    onChange={(e) => e.target.files?.[0] && caricaLogo(e.target.files[0])}
                  />
                  <span className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-border2 hover:text-text">
                    {caricandoLogo ? "…" : d.logoChiave ? "Sostituisci" : "Carica"}
                  </span>
                </label>
                {d.logoChiave && (
                  <button
                    type="button"
                    onClick={rimuoviLogo}
                    disabled={caricandoLogo}
                    title="Rimuovi il logo"
                    className="grid h-6 w-6 flex-none place-items-center rounded text-faint hover:bg-surface2 hover:text-neg"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </Campo>

            {CAMPI.map((c) => (
              <Campo key={c.chiave} etichetta={c.etichetta} nota={c.nota}>
                <Input
                  value={(d[c.chiave] as string) ?? ""}
                  onChange={(e) => setD({ ...d, [c.chiave]: e.target.value })}
                  required={c.chiave === "ragioneSociale"}
                />
              </Campo>
            ))}

            <Campo
              etichetta="Regime fiscale (per il calcolo tasse)"
              nota="Diverso dal campo testuale sopra: alimenta il calcolatore di Dashboard → Tasse, non la stampa del PDF."
            >
              <Select
                value={d.regimeFiscaleId ?? ""}
                onChange={(e) => setD({ ...d, regimeFiscaleId: e.target.value || null })}
              >
                <option value="">Nessuno (esclusa dal calcolo)</option>
                {regimi.map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </Select>
            </Campo>

            {errore && (
              <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
                {errore}
              </div>
            )}
          </div>
          <div className="flex flex-none items-center gap-2 border-t border-border px-4 py-3">
            <div className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Chiudi
            </Button>
            <Button type="submit" size="sm" disabled={inCorso}>
              {inCorso ? "Salvo…" : "Salva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

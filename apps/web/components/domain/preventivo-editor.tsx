"use client";

import {
  calcolaTotali,
  formatAliquota,
  formatEuro,
  importoRiga,
  parseEuro,
  prezzoVisualizzato,
} from "@telaio/core";
import { BookOpen, Check, Copy, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { creaPreventivoAction } from "@/app/(app)/configuratore/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { initialState } from "@/components/ui/form-modal";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "@/components/ui/toast";
import type { EmittenteCfg } from "@/lib/emittenti-cfg";
import type { VoceCfg } from "@/lib/listini-cfg";
import { cn } from "@/lib/utils";

const VALIDITA = [15, 30, 60, 90];

type Tipo = "una_tantum" | "canone_annuo" | "canone_mensile";

const TIPI: { valore: Tipo; etichetta: string }[] = [
  { valore: "una_tantum", etichetta: "Una tantum" },
  { valore: "canone_annuo", etichetta: "Canone annuo" },
  { valore: "canone_mensile", etichetta: "Canone mensile" },
];
const SUFFISSO: Record<Tipo, string> = {
  una_tantum: "",
  canone_annuo: " — canone annuo",
  canone_mensile: " — canone mensile",
};

/** Riga in modifica: prezzo e sconto restano testo finché l'utente scrive. */
interface RigaForm {
  chiave: string;
  descrizione: string;
  tipo: Tipo;
  quantita: string;
  prezzo: string;
  scontoPercento: string;
  voceListinoId?: string;
}

let contatore = 0;
const nuovaChiave = () => `r${++contatore}`;

const rigaVuota = (): RigaForm => ({
  chiave: nuovaChiave(),
  descrizione: "",
  tipo: "una_tantum",
  quantita: "1",
  prezzo: "",
  scontoPercento: "",
});

const centInTesto = (cent: number) => (cent / 100).toFixed(2).replace(".", ",");

/** Una voce di listino diventa una riga per ogni prezzo valorizzato (una tantum, annuo, mensile). */
function righeDaVoce(v: VoceCfg): RigaForm[] {
  const prezzi: [Tipo, number][] = [
    ["una_tantum", v.unaTantumCent],
    ["canone_annuo", v.canoneAnnuoCent],
    ["canone_mensile", v.canoneMensileCent],
  ];
  return prezzi
    .filter(([, cent]) => cent > 0)
    .map(([tipo, cent]) => ({
      chiave: nuovaChiave(),
      descrizione: `${v.nome}${SUFFISSO[tipo]}`,
      tipo,
      quantita: "1",
      prezzo: centInTesto(cent),
      scontoPercento: "",
      voceListinoId: v.id,
    }));
}

interface RigaCalcolata {
  chiave: string;
  valida: boolean;
  tipo: Tipo;
  descrizione: string;
  quantita: number;
  prezzoUnitarioCent: number;
  scontoBp: number;
  voceListinoId?: string;
}

function calcolaRiga(r: RigaForm): RigaCalcolata {
  const quantita = Number(r.quantita);
  const prezzo = parseEuro(r.prezzo);
  const sconto = r.scontoPercento.trim() === "" ? 0 : Number(r.scontoPercento.replace(",", "."));
  const valida =
    r.descrizione.trim().length > 0 &&
    Number.isInteger(quantita) &&
    quantita >= 1 &&
    prezzo !== null &&
    prezzo >= 0 &&
    Number.isFinite(sconto) &&
    sconto >= 0 &&
    sconto <= 100;
  return {
    chiave: r.chiave,
    valida,
    tipo: r.tipo,
    descrizione: r.descrizione.trim(),
    quantita: valida ? quantita : 0,
    prezzoUnitarioCent: valida ? (prezzo ?? 0) : 0,
    scontoBp: valida ? Math.round(sconto * 100) : 0,
    voceListinoId: r.voceListinoId,
  };
}

const Riga = ({ t, v, forte }: { t: string; v: string; forte?: boolean }) => (
  <div
    className={cn(
      "flex justify-between gap-4 py-1.5 text-sm",
      forte ? "font-semibold text-fg" : "text-fg-2",
    )}
  >
    <span>{t}</span>
    <span className="tabular-nums">{v}</span>
  </div>
);

/**
 * Editor del preventivo: emittente, cliente e righe. Le righe si scrivono a mano oppure si
 * prendono da un listino, che non è mai obbligatorio. Salva una bozza.
 */
export function PreventivoEditor({
  emittenti,
  clienti,
  clienteIniziale,
}: {
  emittenti: EmittenteCfg[];
  clienti: { id: string; nome: string }[];
  clienteIniziale?: string;
}) {
  const [stato, azione, pending] = useActionState(creaPreventivoAction, initialState);
  const [emittenteId, setEmittenteId] = useState(emittenti[0]?.id ?? "");
  const [righe, setRighe] = useState<RigaForm[]>(() => [rigaVuota()]);
  const [validita, setValidita] = useState(30);
  const [listinoAperto, setListinoAperto] = useState(false);
  const [listinoId, setListinoId] = useState("");
  const [ricerca, setRicerca] = useState("");

  const emittente = emittenti.find((e) => e.id === emittenteId);
  const regole = emittente?.regole;
  const listini = emittente?.listini ?? [];
  const listino = listini.find((l) => l.id === listinoId) ?? listini[0];

  const calcolate = righe.map(calcolaRiga);
  const valide = calcolate.filter((r) => r.valida);
  const tutteValide = righe.length > 0 && calcolate.every((r) => r.valida);
  const unaTantum = valide.filter((r) => r.tipo === "una_tantum");
  const doc = regole
    ? calcolaTotali(
        unaTantum.map((r) => ({
          quantita: r.quantita,
          prezzoUnitarioCent: r.prezzoUnitarioCent,
          scontoBp: r.scontoBp,
        })),
        regole,
      )
    : null;
  const importoDi = (r: RigaCalcolata) =>
    importoRiga({
      quantita: r.quantita,
      prezzoUnitarioCent: r.prezzoUnitarioCent,
      scontoBp: r.scontoBp,
    });
  const canoneAnno = valide.reduce(
    (s, r) =>
      s +
      (r.tipo === "canone_annuo"
        ? importoDi(r)
        : r.tipo === "canone_mensile"
          ? importoDi(r) * 12
          : 0),
    0,
  );
  const canoneV = regole ? prezzoVisualizzato(canoneAnno, regole) : null;
  const iva = regole?.ivaAttiva ? `IVA ${formatAliquota(regole.aliquotaIvaBp)}` : "Senza IVA";
  const primoNetto = (doc?.imponibileCent ?? 0) + canoneAnno;
  const primoLordo = (doc?.totaleCent ?? 0) + (canoneV?.lordoCent ?? canoneAnno);

  const aggiorna = (chiave: string, patch: Partial<RigaForm>) =>
    setRighe((p) => p.map((r) => (r.chiave === chiave ? { ...r, ...patch } : r)));
  const rimuovi = (chiave: string) => setRighe((p) => p.filter((r) => r.chiave !== chiave));

  /** Aggiunge le righe di una voce; se la prima riga è ancora vuota la sostituisce. */
  function aggiungiVoce(v: VoceCfg) {
    const nuove = righeDaVoce(v);
    if (nuove.length === 0) {
      toast("Questa voce non ha un prezzo");
      return;
    }
    setRighe((p) => {
      const vuota = p.length === 1 && !p[0]?.descrizione && !p[0]?.prezzo;
      return [...(vuota ? [] : p), ...nuove];
    });
    toast(`Aggiunta: ${v.nome}`);
  }

  function cambiaEmittente(id: string) {
    setEmittenteId(id);
    setListinoId("");
    setRicerca("");
    // Le righe già scritte restano: perdono solo il legame con il listino del vecchio emittente.
    setRighe((p) => p.map(({ voceListinoId: _, ...r }) => r));
  }

  const copiaRiepilogo = async () => {
    const testo = [
      `Offerta · ${emittente?.nome ?? ""}`,
      ...valide.map((r) => `- ${r.descrizione}`),
      doc ? `Totale una tantum: ${formatEuro(doc.totaleCent)}` : "",
      canoneAnno ? `Canone annuo netto: ${formatEuro(canoneAnno)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard?.writeText(testo);
    toast("Riepilogo copiato");
  };

  if (emittenti.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Nessuna ragione sociale"
          description="Serve almeno una ragione sociale per emettere un preventivo."
        />
        <Button asChild className="w-fit">
          <Link href="/impostazioni/ragioni-sociali">Crea una ragione sociale</Link>
        </Button>
      </Card>
    );
  }

  const q = ricerca.trim().toLowerCase();
  const filtra = (v: VoceCfg) => !q || `${v.nome} ${v.descrizione ?? ""}`.toLowerCase().includes(q);
  const basi = listino?.basi.filter(filtra) ?? [];
  const moduli = listino?.moduli.filter(filtra) ?? [];

  const prezzoVoce = (v: VoceCfg) =>
    [
      v.unaTantumCent > 0 ? formatEuro(v.unaTantumCent) : "",
      v.canoneAnnuoCent > 0 ? `${formatEuro(v.canoneAnnuoCent)}/anno` : "",
      v.canoneMensileCent > 0 ? `${formatEuro(v.canoneMensileCent)}/mese` : "",
    ]
      .filter(Boolean)
      .join(" + ");

  const elencoVoci = (titolo: string, voci: VoceCfg[]) =>
    voci.length > 0 && (
      <div>
        <h4 className="mb-1 text-xs font-medium tracking-wide text-fg-3 uppercase">{titolo}</h4>
        <ul className="divide-y divide-line">
          {voci.map((v) => (
            <li key={v.id} className="flex items-center gap-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="text-sm font-medium">{v.nome}</span>
                <span className="text-xs text-fg-3 tabular-nums">
                  {v.descrizione ? `${v.descrizione} · ` : ""}
                  {prezzoVoce(v) || "Senza prezzo"}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                aria-label={`Aggiungi ${v.nome}`}
                onClick={() => aggiungiVoce(v)}
              >
                <Plus /> Aggiungi
              </Button>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <form action={azione} className="contents">
      <input type="hidden" name="ragioneSocialeId" value={emittenteId} />
      <input type="hidden" name="validitaGiorni" value={validita} />
      <input
        type="hidden"
        name="righe"
        value={JSON.stringify(
          valide.map(({ chiave: _c, valida: _v, ...r }) => ({
            ...r,
            voceListinoId: r.voceListinoId || undefined,
          })),
        )}
      />

      <PageHeader
        titolo="Nuovo preventivo"
        descrizione="L'emittente decide numerazione e IVA. Scrivi le righe a mano o prendile da un listino: il listino non è obbligatorio. Il numero arriva quando lo invii al cliente."
        stato={<Badge dot>Bozza</Badge>}
        azioni={
          <>
            <Button asChild variant="ghost">
              <Link href="/preventivi">Annulla</Link>
            </Button>
            <Button type="submit" disabled={!tutteValide || pending}>
              {pending ? "Creazione…" : "Salva bozza"}
            </Button>
          </>
        }
      />

      {stato.message && !stato.ok && (
        <p
          role="alert"
          className="rounded-md border border-bad/20 bg-bad-soft px-3 py-2 text-sm text-bad"
        >
          {stato.message}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-fg">Emittente</h2>
        <div
          role="radiogroup"
          aria-label="Ragione sociale emittente"
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
        >
          {emittenti.map((e) => {
            const on = e.id === emittenteId;
            return (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => cambiaEmittente(e.id)}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-left transition-colors duration-150",
                  on
                    ? "border-brand bg-brand-soft ring-1 ring-brand"
                    : "border-line bg-surface hover:bg-subtle",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{e.nome}</span>
                  {on && <Check className="size-4 text-brand" aria-hidden />}
                </span>
                <span>
                  <Badge variant={e.regole.ivaAttiva ? "neutral" : "warn"}>
                    {e.regole.ivaAttiva
                      ? `IVA ${formatAliquota(e.regole.aliquotaIvaBp)}`
                      : "Senza IVA"}
                  </Badge>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente (da Twenty)" hint="Puoi assegnarlo anche dopo">
              <Select name="clienteTwentyId" defaultValue={clienteIniziale ?? ""}>
                <option value="">Da assegnare</option>
                {clienti.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Validità">
              <Select value={validita} onChange={(e) => setValidita(Number(e.target.value))}>
                {VALIDITA.map((g) => (
                  <option key={g} value={g}>
                    {g} giorni
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Oggetto"
              hint="Se vuoto usa la descrizione della prima riga"
              className="sm:col-span-2"
            >
              <Input name="oggetto" />
            </Field>
          </Card>

          <Card>
            <CardHeader
              title="Righe"
              description="Descrizione, quantità e prezzo netto. I canoni non entrano nel totale una tantum."
              action={
                <div className="flex gap-2">
                  {listini.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant={listinoAperto ? "primary" : "secondary"}
                      aria-expanded={listinoAperto}
                      onClick={() => setListinoAperto((v) => !v)}
                    >
                      <BookOpen /> Dal listino
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setRighe((p) => [...p, rigaVuota()])}
                  >
                    <Plus /> Riga libera
                  </Button>
                </div>
              }
            />

            {listini.length > 0 && listinoAperto && listino && (
              <div className="mb-4 flex flex-col gap-3 rounded-lg border border-line bg-subtle p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {listini.length > 1 && (
                    <Select
                      aria-label="Listino"
                      className="w-auto"
                      value={listino.id}
                      onChange={(e) => setListinoId(e.target.value)}
                    >
                      {listini.map((l) => (
                        <option key={l.id} value={l.id}>
                          Listino {l.nome}
                        </option>
                      ))}
                    </Select>
                  )}
                  <Input
                    type="search"
                    aria-label="Cerca nel listino"
                    placeholder="Cerca nel listino…"
                    className="min-w-40 flex-1"
                    value={ricerca}
                    onChange={(e) => setRicerca(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Chiudi il listino"
                    onClick={() => setListinoAperto(false)}
                  >
                    <X />
                  </Button>
                </div>
                {basi.length + moduli.length === 0 ? (
                  <p className="text-sm text-fg-2">
                    {q ? "Nessuna voce corrisponde alla ricerca." : "Questo listino è vuoto."}
                  </p>
                ) : (
                  <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
                    {elencoVoci("Basi", basi)}
                    {elencoVoci("Moduli", moduli)}
                  </div>
                )}
              </div>
            )}

            {righe.length === 0 && (
              <p className="text-sm text-fg-2">Nessuna riga: aggiungine una per iniziare.</p>
            )}
            <ul className="flex flex-col gap-3">
              {righe.map((r, i) => {
                const c = calcolate[i];
                const importo = c?.valida ? importoDi(c) : null;
                return (
                  <li
                    key={r.chiave}
                    className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[1fr_150px]"
                  >
                    <div className="flex flex-col gap-1">
                      <Input
                        aria-label={`Descrizione riga ${i + 1}`}
                        placeholder="Descrizione"
                        value={r.descrizione}
                        onChange={(e) => aggiorna(r.chiave, { descrizione: e.target.value })}
                      />
                      {r.voceListinoId && <span className="text-xs text-fg-3">Dal listino</span>}
                    </div>
                    <Select
                      aria-label={`Tipo riga ${i + 1}`}
                      value={r.tipo}
                      onChange={(e) => aggiorna(r.chiave, { tipo: e.target.value as Tipo })}
                    >
                      {TIPI.map((t) => (
                        <option key={t.valore} value={t.valore}>
                          {t.etichetta}
                        </option>
                      ))}
                    </Select>
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                      <label className="flex items-center gap-1.5 text-xs text-fg-2">
                        Qtà
                        <Input
                          aria-label={`Quantità riga ${i + 1}`}
                          inputMode="numeric"
                          className="w-16"
                          value={r.quantita}
                          onChange={(e) => aggiorna(r.chiave, { quantita: e.target.value })}
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-fg-2">
                        Prezzo €
                        <Input
                          aria-label={`Prezzo riga ${i + 1}`}
                          inputMode="decimal"
                          placeholder="0,00"
                          className="w-28"
                          value={r.prezzo}
                          onChange={(e) => aggiorna(r.chiave, { prezzo: e.target.value })}
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-fg-2">
                        Sconto %
                        <Input
                          aria-label={`Sconto riga ${i + 1}`}
                          inputMode="decimal"
                          placeholder="0"
                          className="w-16"
                          value={r.scontoPercento}
                          onChange={(e) => aggiorna(r.chiave, { scontoPercento: e.target.value })}
                        />
                      </label>
                      <span className="ml-auto text-sm font-medium tabular-nums">
                        {importo !== null ? formatEuro(importo) : "—"}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Rimuovi riga ${i + 1}`}
                        onClick={() => rimuovi(r.chiave)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {!tutteValide && righe.length > 0 && (
              <p className="mt-3 text-xs text-fg-2">
                Ogni riga ha bisogno di una descrizione e di un prezzo valido (es. 1.250,00).
              </p>
            )}
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-4" aria-live="polite">
          <CardHeader title="Riepilogo" description={iva} />
          {valide.length === 0 ? (
            <p className="text-sm text-fg-2">Compila almeno una riga per vedere i totali.</p>
          ) : (
            <ul className="mb-2 divide-y divide-line border-y border-line text-sm">
              {valide.map((r) => (
                <li key={r.chiave} className="flex justify-between gap-3 py-1.5">
                  <span>{r.descrizione}</span>
                  <span className="text-fg-2 tabular-nums">{formatEuro(importoDi(r))}</span>
                </li>
              ))}
            </ul>
          )}
          <Riga t="Una tantum netto" v={formatEuro(doc?.imponibileCent ?? 0)} />
          {regole?.ivaAttiva && doc && <Riga t={iva} v={formatEuro(doc.ivaCent)} />}
          {doc && doc.bolloCent > 0 && <Riga t="Marca da bollo" v={formatEuro(doc.bolloCent)} />}
          <div className="my-1 border-t border-line" />
          <Riga t="Totale una tantum" v={formatEuro(doc?.totaleCent ?? 0)} forte />
          {canoneAnno > 0 && (
            <>
              <Riga t="Canone annuo netto" v={formatEuro(canoneAnno)} />
              {canoneV?.lordoCent != null && (
                <Riga t="Canone annuo IVA inclusa" v={formatEuro(canoneV.lordoCent)} />
              )}
            </>
          )}
          <div className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-fg-2">Primo anno netto</span>
              <b className="font-semibold tabular-nums">{formatEuro(primoNetto)}</b>
            </div>
            {regole?.ivaAttiva && (
              <div className="flex justify-between text-sm">
                <span className="text-fg-2">Primo anno IVA inclusa</span>
                <b className="font-semibold tabular-nums">{formatEuro(primoLordo)}</b>
              </div>
            )}
          </div>
          {regole && !regole.ivaAttiva && regole.diciturSenzaIva && (
            <p className="mt-3 text-xs text-fg-2">{regole.diciturSenzaIva}</p>
          )}
          <Button
            type="button"
            variant="secondary"
            className="mt-4 w-full"
            disabled={valide.length === 0}
            onClick={copiaRiepilogo}
          >
            <Copy /> Copia riepilogo
          </Button>
        </Card>
      </div>
    </form>
  );
}

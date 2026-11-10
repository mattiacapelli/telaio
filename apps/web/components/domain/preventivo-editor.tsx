"use client";

import {
  calcolaTotali,
  ETICHETTA_PERIODO,
  erroreGruppi,
  formatAliquota,
  formatEuro,
  importoRiga,
  nomeServizio,
  parseEuro,
  prezzoVisualizzato,
  valoreRicorrenteAnnuo,
} from "@telaio/core";
import { BookOpen, Check, Copy, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  aggiornaPreventivoBozzaAction,
  creaPreventivoAction,
} from "@/app/(app)/configuratore/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { initialState } from "@/components/ui/form-modal";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "@/components/ui/toast";
import { oggi } from "@/lib/date";
import type { EmittenteCfg } from "@/lib/emittenti-cfg";
import type { VoceCfg } from "@/lib/listini-cfg";
import { cn } from "@/lib/utils";

const VALIDITA = [15, 30, 60, 90];

type Tipo = "una_tantum" | "canone_annuo" | "canone_mensile";

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
  /** righe con lo stesso valore sono alternative dello stesso servizio (annuale oppure mensile) */
  gruppo: string | null;
}

let contatore = 0;
const nuovaChiave = () => `r${++contatore}`;

/** Una bozza già salvata, da riaprire nell'editor. */
export interface BozzaIniziale {
  id: string;
  ragioneSocialeId: string;
  oggetto: string;
  note: string;
  validitaGiorni: number;
  /** data del preventivo (AAAA-MM-GG) */
  data: string;
  righe: Omit<RigaForm, "chiave">[];
}

const rigaVuota = (tipo: Tipo = "una_tantum"): RigaForm => ({
  chiave: nuovaChiave(),
  descrizione: "",
  tipo,
  gruppo: null,
  quantita: "1",
  prezzo: "",
  scontoPercento: "",
});

const centInTesto = (cent: number) => (cent / 100).toFixed(2).replace(".", ",");

/**
 * Una voce di listino diventa una riga per ogni prezzo valorizzato. Se ha sia il canone annuo sia
 * quello mensile, le due righe sono alternative dello stesso servizio: il cliente ne sceglie una.
 */
function righeDaVoce(v: VoceCfg): RigaForm[] {
  const gruppo = v.canoneAnnuoCent > 0 && v.canoneMensileCent > 0 ? `g${++contatore}` : null;
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
      gruppo: tipo === "una_tantum" ? null : gruppo,
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
  gruppo: string | null;
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
    gruppo: r.gruppo,
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
  bozza,
}: {
  emittenti: EmittenteCfg[];
  clienti: { id: string; nome: string }[];
  clienteIniziale?: string;
  /** se c'è, l'editor modifica questa bozza invece di crearne una nuova */
  bozza?: BozzaIniziale;
}) {
  const [stato, azione, pending] = useActionState(
    bozza ? aggiornaPreventivoBozzaAction : creaPreventivoAction,
    initialState,
  );
  const [emittenteId, setEmittenteId] = useState(bozza?.ragioneSocialeId ?? emittenti[0]?.id ?? "");
  const [righe, setRighe] = useState<RigaForm[]>(() =>
    bozza && bozza.righe.length > 0
      ? bozza.righe.map((r) => ({ ...r, chiave: nuovaChiave() }))
      : [rigaVuota()],
  );
  const [validita, setValidita] = useState(bozza?.validitaGiorni ?? 30);
  const [listinoAperto, setListinoAperto] = useState(false);
  const [listinoId, setListinoId] = useState("");
  const [ricerca, setRicerca] = useState("");

  const emittente = emittenti.find((e) => e.id === emittenteId);
  const regole = emittente?.regole;
  const listini = emittente?.listini ?? [];
  const listino = listini.find((l) => l.id === listinoId) ?? listini[0];

  const calcolate = righe.map(calcolaRiga);
  const valide = calcolate.filter((r) => r.valida);
  const unaTantum = valide.filter((r) => r.tipo === "una_tantum");
  const abbonamenti = valide.filter((r) => r.tipo !== "una_tantum");
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
  const comeDecisione = (r: RigaCalcolata) => ({
    id: r.chiave,
    tipo: r.tipo,
    quantita: r.quantita,
    prezzoUnitarioCent: r.prezzoUnitarioCent,
    scontoBp: r.scontoBp,
    gruppoAlternativaId: r.gruppo,
  });
  const erroreAlternative = erroreGruppi(calcolate.map(comeDecisione));
  const tutteValide = righe.length > 0 && calcolate.every((r) => r.valida) && !erroreAlternative;
  // Un servizio ricorrente per riga indipendente o per gruppo: le alternative non si sommano mai.
  const servizi: { chiave: string; nome: string; opzioni: RigaCalcolata[] }[] = [];
  for (const r of abbonamenti) {
    const esistente = r.gruppo ? servizi.find((x) => x.chiave === r.gruppo) : undefined;
    if (esistente) esistente.opzioni.push(r);
    else
      servizi.push({
        chiave: r.gruppo ?? r.chiave,
        nome: nomeServizio(r.descrizione),
        opzioni: [r],
      });
  }
  const valoreAnnuo = valoreRicorrenteAnnuo(
    abbonamenti.map((r) => ({ ...comeDecisione(r), accettata: null })),
    false,
  );
  const iva = regole?.ivaAttiva ? `IVA ${formatAliquota(regole.aliquotaIvaBp)}` : "Senza IVA";

  const aggiorna = (chiave: string, patch: Partial<RigaForm>) =>
    setRighe((p) => p.map((r) => (r.chiave === chiave ? { ...r, ...patch } : r)));
  /** Toglie una riga dal suo gruppo; l'altra riga del gruppo, rimasta sola, torna indipendente. */
  const scioglie = (p: RigaForm[], chiave: string): RigaForm[] => {
    const g = p.find((r) => r.chiave === chiave)?.gruppo;
    if (!g) return p;
    return p.map((r) => (r.gruppo === g ? { ...r, gruppo: null } : r));
  };
  const rimuovi = (chiave: string) =>
    setRighe((p) => scioglie(p, chiave).filter((r) => r.chiave !== chiave));
  /** Rende una riga alternativa a un'altra (nuovo gruppo di due) oppure la separa. */
  function alternativaA(chiave: string, partner: string) {
    setRighe((p) => {
      const senza = scioglie(p, chiave);
      if (!partner) return senza;
      const g = `g${++contatore}`;
      return senza.map((r) =>
        r.chiave === chiave || r.chiave === partner ? { ...r, gruppo: g } : r,
      );
    });
  }
  /** Cambiando periodicità una riga lascia il gruppo: due alternative devono avere periodicità diverse. */
  const cambiaTipo = (chiave: string, tipo: Tipo) =>
    setRighe((p) => scioglie(p, chiave).map((r) => (r.chiave === chiave ? { ...r, tipo } : r)));

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
      ...unaTantum.map((r) => `- ${r.descrizione}`),
      doc ? `Totale una tantum: ${formatEuro(doc.totaleCent)}` : "",
      ...servizi.map(
        (s) =>
          `Abbonamento ${s.nome}: ${s.opzioni
            .map(
              (o) =>
                `${formatEuro(importoDi(o))}/${ETICHETTA_PERIODO[o.tipo as "canone_annuo" | "canone_mensile"]}`,
            )
            .join(" oppure ")}`,
      ),
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

  const righeUnaTantum = righe
    .map((r, i) => ({ r, c: calcolate[i] as RigaCalcolata }))
    .filter(({ r }) => r.tipo === "una_tantum");
  const righeAbbonamento = righe
    .map((r, i) => ({ r, c: calcolate[i] as RigaCalcolata }))
    .filter(({ r }) => r.tipo !== "una_tantum");

  /** Una riga di una delle due sezioni; negli abbonamenti ci sono periodicità e alternativa. */
  function renderRiga(r: RigaForm, c: RigaCalcolata, etichetta: string, abbonamento: boolean) {
    const importo = c.valida ? importoDi(c) : null;
    const partner = r.gruppo
      ? righe.find((x) => x.gruppo === r.gruppo && x.chiave !== r.chiave)
      : undefined;
    const candidati = righe.filter(
      (x) => x.chiave !== r.chiave && x.tipo !== "una_tantum" && x.tipo !== r.tipo && !x.gruppo,
    );
    return (
      <li
        key={r.chiave}
        data-gruppo={r.gruppo ?? undefined}
        className={cn(
          "grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_170px]",
          r.gruppo ? "border-brand/40 bg-brand-soft/40" : "border-line",
        )}
      >
        <div className="flex flex-col gap-1">
          <Input
            aria-label={`Descrizione ${etichetta}`}
            placeholder={abbonamento ? "Servizio (es. Manutenzione)" : "Descrizione"}
            value={r.descrizione}
            onChange={(e) => aggiorna(r.chiave, { descrizione: e.target.value })}
          />
          {r.voceListinoId && <span className="text-xs text-fg-3">Dal listino</span>}
        </div>
        {abbonamento ? (
          <Select
            aria-label={`Periodicità ${etichetta}`}
            value={r.tipo}
            onChange={(e) => cambiaTipo(r.chiave, e.target.value as Tipo)}
          >
            <option value="canone_mensile">Mensile</option>
            <option value="canone_annuo">Annuale</option>
          </Select>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <label className="flex items-center gap-1.5 text-xs text-fg-2">
            Qtà
            <Input
              aria-label={`Quantità ${etichetta}`}
              inputMode="numeric"
              className="w-16"
              value={r.quantita}
              onChange={(e) => aggiorna(r.chiave, { quantita: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-fg-2">
            {abbonamento ? "Importo per periodo €" : "Prezzo €"}
            <Input
              aria-label={`Prezzo ${etichetta}`}
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
              aria-label={`Sconto ${etichetta}`}
              inputMode="decimal"
              placeholder="0"
              className="w-16"
              value={r.scontoPercento}
              onChange={(e) => aggiorna(r.chiave, { scontoPercento: e.target.value })}
            />
          </label>
          <span className="ml-auto text-sm font-medium tabular-nums">
            {importo !== null ? formatEuro(importo) : "—"}
            {abbonamento && importo !== null && (
              <span className="text-xs font-normal text-fg-3">
                {" "}
                / {r.tipo === "canone_annuo" ? "anno" : "mese"}
              </span>
            )}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Rimuovi ${etichetta}`}
            onClick={() => rimuovi(r.chiave)}
          >
            <Trash2 />
          </Button>
        </div>
        {abbonamento && (
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <label className="flex items-center gap-1.5 text-xs text-fg-2">
              Alternativa a
              <Select
                aria-label={`Alternativa per ${etichetta}`}
                className="w-auto"
                value={partner?.chiave ?? ""}
                onChange={(e) => alternativaA(r.chiave, e.target.value)}
              >
                <option value="">Nessuna: servizio indipendente</option>
                {partner && (
                  <option value={partner.chiave}>
                    {partner.descrizione || "Altro abbonamento"} (
                    {partner.tipo === "canone_annuo" ? "annuale" : "mensile"})
                  </option>
                )}
                {candidati.map((x) => (
                  <option key={x.chiave} value={x.chiave}>
                    {x.descrizione || "Altro abbonamento"} (
                    {x.tipo === "canone_annuo" ? "annuale" : "mensile"})
                  </option>
                ))}
              </Select>
            </label>
            {r.gruppo && (
              <Badge variant="brand">Alternativa: il cliente sceglie una periodicità</Badge>
            )}
          </div>
        )}
      </li>
    );
  }

  return (
    <form action={azione} className="contents">
      {bozza && <input type="hidden" name="id" value={bozza.id} />}
      {bozza && <input type="hidden" name="note" value={bozza.note} />}
      <input type="hidden" name="ragioneSocialeId" value={emittenteId} />
      <input type="hidden" name="validitaGiorni" value={validita} />
      <input
        type="hidden"
        name="righe"
        value={JSON.stringify(
          valide.map(({ chiave: _c, valida: _v, gruppo, ...r }) => ({
            ...r,
            voceListinoId: r.voceListinoId || undefined,
            gruppoAlternativa: gruppo,
          })),
        )}
      />

      <PageHeader
        titolo={bozza ? "Modifica bozza" : "Nuovo preventivo"}
        descrizione={
          bozza
            ? "Finché è in bozza puoi cambiare tutto: emittente, cliente, righe e prezzi. Dopo l'invio numero e totali sono congelati."
            : "L'emittente decide numerazione e IVA. Scrivi le righe a mano o prendile da un listino: il listino non è obbligatorio. Il numero arriva quando lo invii al cliente."
        }
        stato={<Badge dot>Bozza</Badge>}
        azioni={
          <>
            <Button asChild variant="ghost">
              <Link href={bozza ? `/preventivi/${bozza.id}` : "/preventivi"}>Annulla</Link>
            </Button>
            <Button type="submit" disabled={!tutteValide || pending}>
              {pending
                ? bozza
                  ? "Salvataggio…"
                  : "Creazione…"
                : bozza
                  ? "Salva modifiche"
                  : "Salva bozza"}
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
            <Field
              label="Data del preventivo"
              hint="Oggi, oppure una data passata se il preventivo è già stato fatto. Il numero segue l'anno di questa data."
            >
              <Input name="data" type="date" required defaultValue={bozza?.data ?? oggi()} />
            </Field>
            <Field label="Validità" hint="Conta dalla data del preventivo">
              <Select value={validita} onChange={(e) => setValidita(Number(e.target.value))}>
                {[...new Set([...VALIDITA, validita])]
                  .sort((a, b) => a - b)
                  .map((g) => (
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
              <Input name="oggetto" defaultValue={bozza?.oggetto} />
            </Field>
          </Card>

          {listini.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-fg-2">
                  Scrivi le righe a mano o prendile da un listino: non è obbligatorio.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant={listinoAperto ? "primary" : "secondary"}
                  aria-expanded={listinoAperto}
                  onClick={() => setListinoAperto((v) => !v)}
                >
                  <BookOpen /> Dal listino
                </Button>
              </div>
              {listinoAperto && listino && (
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
            </div>
          )}

          <Card>
            <CardHeader
              title="Prestazioni una tantum"
              description="Pagamento non ricorrente: entrano nei totali del preventivo e nella fattura."
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setRighe((p) => [...p, rigaVuota("una_tantum")])}
                >
                  <Plus /> Aggiungi prestazione
                </Button>
              }
            />
            {righeUnaTantum.length === 0 && (
              <p className="text-sm text-fg-2">Nessuna prestazione una tantum.</p>
            )}
            <ul className="flex flex-col gap-3">
              {righeUnaTantum.map(({ r, c }, i) => renderRiga(r, c, `prestazione ${i + 1}`, false))}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Abbonamenti"
              description="Servizi ricorrenti, per periodo. Annuale e mensile dello stesso servizio sono alternative: il cliente ne sceglie una."
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setRighe((p) => [...p, rigaVuota("canone_mensile")])}
                >
                  <Plus /> Aggiungi abbonamento
                </Button>
              }
            />
            {righeAbbonamento.length === 0 && (
              <p className="text-sm text-fg-2">Nessun abbonamento.</p>
            )}
            <ul className="flex flex-col gap-3">
              {righeAbbonamento.map(({ r, c }, i) =>
                renderRiga(r, c, `abbonamento ${i + 1}`, true),
              )}
            </ul>
            {erroreAlternative && (
              <p role="alert" className="mt-3 text-xs text-bad">
                {erroreAlternative}
              </p>
            )}
          </Card>
          {!tutteValide && righe.length > 0 && (
            <p className="text-xs text-fg-2">
              Ogni riga ha bisogno di una descrizione e di un prezzo valido (es. 1.250,00).
            </p>
          )}
        </div>

        <Card className="h-fit lg:sticky lg:top-4" aria-live="polite">
          <CardHeader title="Riepilogo" description={iva} />
          <p className="mb-1 text-xs font-medium text-fg-2">Prestazioni una tantum</p>
          {unaTantum.length === 0 ? (
            <p className="mb-2 text-sm text-fg-3">Nessuna prestazione.</p>
          ) : (
            <ul className="mb-2 divide-y divide-line border-y border-line text-sm">
              {unaTantum.map((r) => (
                <li key={r.chiave} className="flex justify-between gap-3 py-1.5">
                  <span>{r.descrizione}</span>
                  <span className="text-fg-2 tabular-nums">{formatEuro(importoDi(r))}</span>
                </li>
              ))}
            </ul>
          )}
          <Riga t="Imponibile" v={formatEuro(doc?.imponibileCent ?? 0)} />
          {regole?.ivaAttiva && doc && <Riga t={iva} v={formatEuro(doc.ivaCent)} />}
          {doc && doc.bolloCent > 0 && <Riga t="Marca da bollo" v={formatEuro(doc.bolloCent)} />}
          <div className="my-1 border-t border-line" />
          <Riga t="Totale una tantum" v={formatEuro(doc?.totaleCent ?? 0)} forte />

          <p className="mt-4 mb-1 text-xs font-medium text-fg-2">
            Abbonamenti (per periodo, non sommati)
          </p>
          {servizi.length === 0 ? (
            <p className="text-sm text-fg-3">Nessun abbonamento.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line text-sm">
              {servizi.map((sv) => (
                <li key={sv.chiave} className="flex flex-col gap-0.5 py-1.5">
                  <span className="font-medium">{sv.nome}</span>
                  <span className="text-fg-2 tabular-nums">
                    {sv.opzioni.map((o, i) => {
                      const v = regole ? prezzoVisualizzato(importoDi(o), regole) : null;
                      return (
                        <span key={o.chiave}>
                          {i > 0 && <span className="text-fg-3"> oppure </span>}
                          {formatEuro(importoDi(o))} /{" "}
                          {ETICHETTA_PERIODO[o.tipo as "canone_annuo" | "canone_mensile"]}
                          {v?.lordoCent != null && (
                            <span className="text-fg-3"> ({formatEuro(v.lordoCent)} ivato)</span>
                          )}
                        </span>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {servizi.length > 0 && (
            <p className="mt-2 text-xs text-fg-3">
              Valore ricorrente annualizzato indicativo: {formatEuro(valoreAnnuo)}. Non entra nei
              totali.
            </p>
          )}
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

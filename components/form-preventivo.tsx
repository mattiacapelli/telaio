"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { eur, eurCent } from "@/lib/format";
import { calcolaPreventivo, totaleRiga, UNITA } from "@/lib/calcoli";

export type ClienteOpzione = {
  id: string;
  ragioneSociale: string;
  tariffaOraria: number;
  terminiPagamento?: number;
  referenti?: { id: string; nome: string; cognome: string; ruolo: string | null }[];
};

export type VoceForm = {
  descrizione: string;
  nota: string;
  quantita: string;
  unita: string;
  prezzo: string;
  sconto: string;
};

export type DatiPreventivo = {
  titolo: string;
  clienteId: string;
  referenteId: string;
  scadeIl: string;
  scontoPercento: string;
  aliquotaIva: string;
  probabilita: string;
  premessa: string;
  tempiConsegna: string;
  modalitaPagamento: string;
  validitaGiorni: string;
  note: string;
  voci: VoceForm[];
  aziendaId: string;
};

export function voceVuota(prezzo = ""): VoceForm {
  return { descrizione: "", nota: "", quantita: "", unita: "ORE", prezzo, sconto: "0" };
}

export function datiVuoti(tariffa: number): DatiPreventivo {
  return {
    titolo: "",
    clienteId: "",
    referenteId: "",
    scadeIl: "",
    scontoPercento: "0",
    aliquotaIva: "22",
    probabilita: "",
    premessa: "",
    tempiConsegna: "",
    modalitaPagamento: "Bonifico bancario a 30 giorni data fattura",
    validitaGiorni: "30",
    note: "",
    voci: [voceVuota(String(tariffa))],
    aziendaId: "",
  };
}

function Sezione({
  titolo,
  descrizione,
  children,
}: {
  titolo: string;
  descrizione?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border px-5 py-4 last:border-0">
      <div className="mb-3">
        <h3 className="text-md font-semibold uppercase tracking-wide text-muted">
          {titolo}
        </h3>
        {descrizione && (
          <p className="mt-0.5 text-md text-faint">{descrizione}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Corpo condiviso da creazione e modifica del preventivo.
 *
 * Il riepilogo usa lo stesso `calcolaPreventivo` del server: il totale che
 * vedi qui è quello che verrà salvato.
 */
export function CorpoPreventivo({
  dati,
  setDati,
  clienti,
  aziende = [],
  mostraMotivo,
  motivo,
  setMotivo,
}: {
  dati: DatiPreventivo;
  setDati: (d: DatiPreventivo) => void;
  clienti: ClienteOpzione[];
  aziende?: { id: string; ragioneSociale: string }[];
  mostraMotivo?: boolean;
  motivo?: string;
  setMotivo?: (m: string) => void;
}) {
  const cliente = clienti.find((c) => c.id === dati.clienteId);
  const referenti = cliente?.referenti ?? [];

  const riepilogo = useMemo(
    () =>
      calcolaPreventivo(
        dati.voci.map((v) => ({
          quantita: Number(v.quantita) || 0,
          prezzo: Number(v.prezzo) || 0,
          sconto: Number(v.sconto) || 0,
        })),
        Number(dati.scontoPercento) || 0,
        Number(dati.aliquotaIva) || 0,
      ),
    [dati.voci, dati.scontoPercento, dati.aliquotaIva],
  );

  const set = <K extends keyof DatiPreventivo>(k: K, v: DatiPreventivo[K]) =>
    setDati({ ...dati, [k]: v });

  function cambiaCliente(id: string) {
    const c = clienti.find((x) => x.id === id);
    setDati({
      ...dati,
      clienteId: id,
      // Il referente precedente appartiene a un altro cliente.
      referenteId: "",
      voci: c
        ? dati.voci.map((v) =>
            v.prezzo === "" ? { ...v, prezzo: String(c.tariffaOraria) } : v,
          )
        : dati.voci,
    });
  }

  function voce(i: number, campo: keyof VoceForm, valore: string) {
    set(
      "voci",
      dati.voci.map((v, j) => (j === i ? { ...v, [campo]: valore } : v)),
    );
  }

  return (
    <>
      <Sezione titolo="Dati del preventivo">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etichetta="Titolo">
            <Input
              value={dati.titolo}
              onChange={(e) => set("titolo", e.target.value)}
              placeholder="Es. Restyling area clienti"
              required
            />
          </Campo>
          <Campo etichetta="Cliente">
            <Select
              value={dati.clienteId}
              onChange={(e) => cambiaCliente(e.target.value)}
              required
            >
              <option value="">Scegli…</option>
              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ragioneSociale}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo
            etichetta="Referente"
            nota={
              dati.clienteId && referenti.length === 0
                ? "Nessun referente per questo cliente"
                : undefined
            }
          >
            <Select
              value={dati.referenteId}
              onChange={(e) => set("referenteId", e.target.value)}
              disabled={referenti.length === 0}
            >
              <option value="">—</option>
              {referenti.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome} {r.cognome}
                  {r.ruolo ? ` · ${r.ruolo}` : ""}
                </option>
              ))}
            </Select>
          </Campo>

          <Campo etichetta="Scadenza offerta">
            <Input
              type="date"
              value={dati.scadeIl}
              onChange={(e) => set("scadeIl", e.target.value)}
            />
          </Campo>

          <Campo etichetta="Validità" nota="Giorni di validità dell'offerta">
            <Input
              value={dati.validitaGiorni}
              onChange={(e) => set("validitaGiorni", e.target.value)}
              inputMode="numeric"
              placeholder="30"
            />
          </Campo>

          <Campo etichetta="Probabilità di chiusura" nota="Percentuale, facoltativa">
            <Input
              value={dati.probabilita}
              onChange={(e) => set("probabilita", e.target.value)}
              inputMode="numeric"
              placeholder="Es. 60"
            />
          </Campo>

          {aziende.length > 1 && (
            <Campo etichetta="Ragione sociale emittente" nota="Vuoto = quella predefinita">
              <Select value={dati.aziendaId} onChange={(e) => set("aziendaId", e.target.value)}>
                <option value="">Predefinita</option>
                {aziende.map((a) => (
                  <option key={a.id} value={a.id}>{a.ragioneSociale}</option>
                ))}
              </Select>
            </Campo>
          )}
        </div>

        {mostraMotivo && setMotivo && (
          <div className="mt-3">
            <Campo
              etichetta="Motivo della revisione"
              nota="Perché stai cambiando il preventivo: comparirà nello storico"
            >
              <Input
                value={motivo ?? ""}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Es. sconto concordato al telefono"
              />
            </Campo>
          </div>
        )}
      </Sezione>

      <Sezione titolo="Voci" descrizione="Quantità, unità di misura e sconto per riga.">
        <div className="flex flex-col gap-2">
          {dati.voci.map((v, i) => {
            const tot = totaleRiga({
              quantita: Number(v.quantita) || 0,
              prezzo: Number(v.prezzo) || 0,
              sconto: Number(v.sconto) || 0,
            });
            return (
              <div key={i} className="rounded-md border border-border bg-surface2 p-2">
                <div className="flex items-start gap-1.5">
                  <GripVertical size={14} className="mt-2 flex-none text-faint" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Input
                      value={v.descrizione}
                      onChange={(e) => voce(i, "descrizione", e.target.value)}
                      placeholder="Descrizione della voce"
                    />
                    <Input
                      value={v.nota}
                      onChange={(e) => voce(i, "nota", e.target.value)}
                      placeholder="Nota o dettaglio (facoltativo)"
                      className="text-md"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      set("voci", dati.voci.filter((_, j) => j !== i))
                    }
                    disabled={dati.voci.length === 1}
                    aria-label="Rimuovi voce"
                    className="grid h-8 w-8 flex-none place-items-center rounded-md text-faint transition-colors hover:bg-surface3 hover:text-neg disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 items-end gap-1.5 pl-[22px] sm:grid-cols-5">
                  <Campo etichetta="Quantità">
                    <Input
                      value={v.quantita}
                      onChange={(e) => voce(i, "quantita", e.target.value)}
                      inputMode="decimal"
                      className="text-right"
                    />
                  </Campo>
                  <Campo etichetta="Unità">
                    <Select value={v.unita} onChange={(e) => voce(i, "unita", e.target.value)}>
                      {Object.entries(UNITA).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Campo>
                  <Campo etichetta="Prezzo">
                    <Input
                      value={v.prezzo}
                      onChange={(e) => voce(i, "prezzo", e.target.value)}
                      inputMode="decimal"
                      className="text-right"
                    />
                  </Campo>
                  <Campo etichetta="Sconto %">
                    <Input
                      value={v.sconto}
                      onChange={(e) => voce(i, "sconto", e.target.value)}
                      inputMode="decimal"
                      className="text-right"
                    />
                  </Campo>
                  <div className="text-right">
                    <div className="text-xs text-faint">Totale riga</div>
                    <div className="mt-1 h-8 text-md font-semibold leading-8">
                      {eur(tot)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() =>
            set("voci", [
              ...dati.voci,
              voceVuota(cliente ? String(cliente.tariffaOraria) : ""),
            ])
          }
        >
          <Plus /> Aggiungi voce
        </Button>
      </Sezione>

      <Sezione titolo="Riepilogo">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etichetta="Sconto sul totale %">
            <Input
              value={dati.scontoPercento}
              onChange={(e) => set("scontoPercento", e.target.value)}
              inputMode="decimal"
              className="text-right"
            />
          </Campo>
          <Campo etichetta="Aliquota IVA %">
            <Input
              value={dati.aliquotaIva}
              onChange={(e) => set("aliquotaIva", e.target.value)}
              inputMode="decimal"
              className="text-right"
            />
          </Campo>
        </div>

        <div className="mt-3 rounded-md border border-border bg-surface2 px-3 py-2 text-md">
          <Riga etichetta="Somma voci" valore={eurCent(riepilogo.lordo)} />
          {riepilogo.scontiRiga > 0 && (
            <Riga
              etichetta="Sconti di riga"
              valore={`− ${eurCent(riepilogo.scontiRiga)}`}
              tenue
            />
          )}
          {riepilogo.scontoTotale > 0 && (
            <Riga
              etichetta={`Sconto ${dati.scontoPercento}%`}
              valore={`− ${eurCent(riepilogo.scontoTotale)}`}
              tenue
            />
          )}
          <Riga etichetta="Imponibile" valore={eurCent(riepilogo.imponibile)} />
          <Riga
            etichetta={`IVA ${dati.aliquotaIva}%`}
            valore={eurCent(riepilogo.iva)}
            tenue
          />
          <div className="mt-1.5 flex items-center border-t border-border pt-1.5">
            <span className="font-semibold">Totale documento</span>
            <div className="flex-1" />
            <span className="text-sm font-semibold">
              {eurCent(riepilogo.totale)}
            </span>
          </div>
        </div>
      </Sezione>

      <Sezione
        titolo="Testi del documento"
        descrizione="Compaiono sul preventivo inviato al cliente."
      >
        <div className="flex flex-col gap-3">
          <Campo etichetta="Premessa">
            <Textarea
              rows={3}
              value={dati.premessa}
              onChange={(e) => set("premessa", e.target.value)}
              placeholder="Breve introduzione all'offerta…"
            />
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etichetta="Tempi di consegna">
              <Input
                value={dati.tempiConsegna}
                onChange={(e) => set("tempiConsegna", e.target.value)}
                placeholder="Es. 6 settimane dall'accettazione"
              />
            </Campo>
            <Campo etichetta="Modalità di pagamento">
              <Input
                value={dati.modalitaPagamento}
                onChange={(e) => set("modalitaPagamento", e.target.value)}
              />
            </Campo>
          </div>
          <Campo etichetta="Note">
            <Textarea
              rows={2}
              value={dati.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Esclusioni, condizioni particolari…"
            />
          </Campo>
        </div>
      </Sezione>
    </>
  );
}

function Riga({
  etichetta,
  valore,
  tenue,
}: {
  etichetta: string;
  valore: string;
  tenue?: boolean;
}) {
  return (
    <div className={`flex items-center py-0.5 ${tenue ? "text-muted" : ""}`}>
      <span>{etichetta}</span>
      <div className="flex-1" />
      <span className="tabular-nums">{valore}</span>
    </div>
  );
}

/** Totale corrente, per il piè di pagina del dialog. */
export function useTotale(dati: DatiPreventivo) {
  return useMemo(
    () =>
      calcolaPreventivo(
        dati.voci.map((v) => ({
          quantita: Number(v.quantita) || 0,
          prezzo: Number(v.prezzo) || 0,
          sconto: Number(v.sconto) || 0,
        })),
        Number(dati.scontoPercento) || 0,
        Number(dati.aliquotaIva) || 0,
      ),
    [dati],
  );
}

/** Trasforma i dati del form nel corpo della richiesta. */
export function corpoRichiesta(dati: DatiPreventivo, motivo?: string) {
  return {
    titolo: dati.titolo,
    clienteId: dati.clienteId,
    referenteId: dati.referenteId || null,
    scadeIl: dati.scadeIl || null,
    scontoPercento: dati.scontoPercento || 0,
    aliquotaIva: dati.aliquotaIva || 0,
    probabilita: dati.probabilita === "" ? null : dati.probabilita,
    premessa: dati.premessa || null,
    tempiConsegna: dati.tempiConsegna || null,
    modalitaPagamento: dati.modalitaPagamento || null,
    validitaGiorni: dati.validitaGiorni === "" ? null : dati.validitaGiorni,
    note: dati.note || null,
    motivo: motivo || null,
    aziendaId: dati.aziendaId || null,
    voci: dati.voci
      .filter((v) => v.descrizione.trim())
      .map((v) => ({
        descrizione: v.descrizione,
        nota: v.nota || null,
        quantita: v.quantita || 0,
        unita: v.unita,
        prezzo: v.prezzo || 0,
        sconto: v.sconto || 0,
      })),
  };
}

export { useRouter };

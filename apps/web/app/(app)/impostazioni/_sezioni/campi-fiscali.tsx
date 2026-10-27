"use client";

import type { RegoleFiscali } from "@telaio/core";
import { useState } from "react";
import { AnteprimaIva } from "@/components/domain/anteprima-iva";
import { Field, Input, Select } from "@/components/ui/field";
import type { ActionState } from "@/components/ui/form-modal";

export interface ContoOpzione {
  id: string;
  nome: string;
}

function bpToText(bp: number | null | undefined) {
  return bp ? String(bp / 100).replace(".", ",") : "";
}
function textToBp(s: string) {
  const n = Number(s.replace(",", "."));
  return s.trim() && Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Campi delle regole fiscali con anteprima del calcolo che si aggiorna mentre scrivi. */
export function CampiFiscali({
  id,
  iniziale,
  contoPredefinitoId,
  conti,
  state,
}: {
  id: string;
  iniziale: RegoleFiscali;
  contoPredefinitoId: string | null;
  conti: ContoOpzione[];
  state: ActionState;
}) {
  const [ivaAttiva, setIvaAttiva] = useState(iniziale.ivaAttiva);
  const [aliquota, setAliquota] = useState(bpToText(iniziale.aliquotaIvaBp) || "22");
  const [natura, setNatura] = useState(iniziale.naturaSenzaIva ?? "N2.2");
  const [dicitura, setDicitura] = useState(iniziale.diciturSenzaIva ?? "");
  const [bollo, setBollo] = useState(iniziale.bolloAutomatico);
  const [ritenuta, setRitenuta] = useState(bpToText(iniziale.ritenutaBp));
  const [split, setSplit] = useState(iniziale.splitPayment);
  const e = state.errors ?? {};

  const anteprima: RegoleFiscali = {
    ivaAttiva,
    aliquotaIvaBp: ivaAttiva ? textToBp(aliquota) : 0,
    naturaSenzaIva: ivaAttiva ? null : natura,
    diciturSenzaIva: ivaAttiva ? null : dicitura,
    bolloAutomatico: !ivaAttiva && bollo,
    ritenutaBp: textToBp(ritenuta) || null,
    splitPayment: split,
  };

  return (
    <>
      <input type="hidden" name="id" value={id} />
      <SwitchControllato name="ivaAttiva" label="IVA attiva" description="Se disattivata si applicano natura e dicitura di legge." checked={ivaAttiva} onChange={setIvaAttiva} />
      {ivaAttiva ? (
        <Field label="Aliquota IVA (%)" error={e.aliquota}>
          <Input name="aliquota" inputMode="decimal" value={aliquota} onChange={(ev) => setAliquota(ev.target.value)} />
        </Field>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <Field label="Natura" error={e.naturaSenzaIva}>
              <Select name="naturaSenzaIva" value={natura} onChange={(ev) => setNatura(ev.target.value)}>
                {["N1", "N2.1", "N2.2", "N3.5", "N4"].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </Select>
            </Field>
            <Field label="Dicitura in fattura" error={e.diciturSenzaIva}>
              <Input name="diciturSenzaIva" value={dicitura} onChange={(ev) => setDicitura(ev.target.value)} placeholder="Operazione non soggetta a IVA ai sensi…" />
            </Field>
          </div>
          <SwitchControllato name="bolloAutomatico" label="Marca da bollo automatica" description="€ 2,00 sopra € 77,47 sui documenti senza IVA." checked={bollo} onChange={setBollo} />
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ritenuta d'acconto (%)" hint="Lascia vuoto se non applicabile" error={e.ritenuta}>
          <Input name="ritenuta" inputMode="decimal" value={ritenuta} onChange={(ev) => setRitenuta(ev.target.value)} />
        </Field>
        <Field label="Conto predefinito">
          <Select name="contoPredefinitoId" defaultValue={contoPredefinitoId ?? ""}>
            <option value="">Nessuno</option>
            {conti.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </Field>
      </div>
      <SwitchControllato name="splitPayment" label="Split payment (PA)" description="L'IVA la versa il cliente pubblico direttamente all'erario." checked={split} onChange={setSplit} />
      <AnteprimaIva regole={anteprima} />
    </>
  );
}

function SwitchControllato({ name, label, description, checked, onChange }: { name: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-grey-2 bg-white/50 px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors after:absolute after:-inset-2 after:content-[''] ${checked ? "bg-ink" : "bg-grey-2"}`}
      >
        <span className={`block size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
      <input type="hidden" name={name} value={checked ? "on" : ""} />
    </div>
  );
}


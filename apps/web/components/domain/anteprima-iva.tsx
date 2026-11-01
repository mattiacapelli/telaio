import { calcolaTotali, formatAliquota, formatEuro, type RegoleFiscali } from "@telaio/core";

/** Anteprima del calcolo su € 1.000 con le regole date. Pura: usabile in server e client. */
export function AnteprimaIva({
  regole,
  baseCent = 100000,
}: {
  regole: RegoleFiscali;
  baseCent?: number;
}) {
  const t = calcolaTotali([{ quantita: 1, prezzoUnitarioCent: baseCent }], regole);
  const righe: [string, number, boolean?][] = [
    ["Imponibile", t.imponibileCent],
    ...(regole.ivaAttiva
      ? ([[`IVA ${formatAliquota(regole.aliquotaIvaBp)}`, t.ivaCent]] as [string, number][])
      : []),
    ...(t.bolloCent > 0 ? ([["Marca da bollo", t.bolloCent]] as [string, number][]) : []),
    ["Totale documento", t.totaleCent, true],
    ...(t.ritenutaCent > 0
      ? ([["Ritenuta d'acconto", -t.ritenutaCent]] as [string, number][])
      : []),
    ...(t.ivaSplitCent > 0
      ? ([["IVA in split payment", -t.ivaSplitCent]] as [string, number][])
      : []),
  ];
  const daPagare = t.nettoDaPagareCent !== t.totaleCent;
  return (
    <div className="rounded-lg bg-fg text-white p-5" aria-live="polite">
      <p className="text-xs font-medium text-white/70">Anteprima su {formatEuro(baseCent)}</p>
      <dl className="mt-3 flex flex-col gap-1.5 text-sm tabular-nums">
        {righe.map(([k, v, forte]) => (
          <div
            key={k}
            className={`flex justify-between ${forte ? "mt-1 border-t border-white/20 pt-2 font-semibold" : ""}`}
          >
            <dt>{k}</dt>
            <dd>{formatEuro(v)}</dd>
          </div>
        ))}
        {daPagare && (
          <div className="mt-1 flex justify-between border-t border-white/20 pt-2 font-semibold">
            <dt>Netto da incassare</dt>
            <dd className="tabular-nums text-xl">{formatEuro(t.nettoDaPagareCent)}</dd>
          </div>
        )}
      </dl>
      {!regole.ivaAttiva && regole.diciturSenzaIva && (
        <p className="mt-3 text-xs text-white/70">
          {regole.naturaSenzaIva ? `${regole.naturaSenzaIva} · ` : ""}
          {regole.diciturSenzaIva}
        </p>
      )}
    </div>
  );
}

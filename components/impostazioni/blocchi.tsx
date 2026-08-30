import type { ReactNode } from "react";

/**
 * Blocchi della pagina impostazioni, nello stile di Twenty: ogni sezione ha
 * titolo, una riga che ne spiega lo scopo e sotto il controllo.
 *
 * La spiegazione non è decorativa: dice cosa cambia davvero, così non serve
 * indovinarlo dal nome dell'opzione.
 */
export function Sezione({
  titolo,
  descrizione,
  children,
}: {
  titolo: string;
  descrizione?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-md font-medium">{titolo}</h2>
        {descrizione && <p className="mt-0.5 text-xs text-muted">{descrizione}</p>}
      </div>
      {children}
    </section>
  );
}

export function Riquadro({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-md border border-border bg-surface ${className}`}>
      {children}
    </div>
  );
}

/** Riga di un elenco dentro un riquadro: icona, testo, stato e azione. */
export function Riga({
  icona,
  titolo,
  dettaglio,
  stato,
  azione,
}: {
  icona?: ReactNode;
  titolo: ReactNode;
  dettaglio?: ReactNode;
  stato?: ReactNode;
  azione?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5 last:border-0">
      {icona && <span className="flex-none text-faint">{icona}</span>}
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate text-md">{titolo}</span>
        {dettaglio && <span className="truncate text-xs text-faint">{dettaglio}</span>}
      </div>
      {stato}
      {azione}
    </div>
  );
}

export function Stato({
  testo,
  tono = "neutro",
}: {
  testo: string;
  tono?: "neutro" | "attivo" | "attenzione";
}) {
  const colori = {
    neutro: "text-muted",
    attivo: "text-pos",
    attenzione: "text-neg",
  };
  return (
    <span className={`flex flex-none items-center gap-1.5 text-xs ${colori[tono]}`}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background:
            tono === "attivo"
              ? "var(--pos)"
              : tono === "attenzione"
                ? "var(--neg)"
                : "var(--muted)",
        }}
      />
      {testo}
    </span>
  );
}

/** Coppia etichetta/valore per i dati anagrafici. */
export function Dato({
  etichetta,
  valore,
  vuoto,
}: {
  etichetta: string;
  valore?: ReactNode;
  vuoto?: string;
}) {
  const pieno = valore !== null && valore !== undefined && valore !== "";
  return (
    <div className="flex items-baseline gap-3 border-b border-border px-3 py-2 last:border-0">
      <span className="w-[180px] flex-none text-xs text-muted">{etichetta}</span>
      <span className={`min-w-0 flex-1 truncate text-md ${pieno ? "" : "text-faint"}`}>
        {pieno ? valore : (vuoto ?? "Non impostato")}
      </span>
    </div>
  );
}

/** Azioni irreversibili, separate visivamente dal resto. */
export function ZonaPericolosa({
  descrizione,
  children,
}: {
  descrizione: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-md font-medium text-neg">Zona pericolosa</h2>
        <p className="mt-0.5 text-xs text-muted">{descrizione}</p>
      </div>
      {children}
    </section>
  );
}

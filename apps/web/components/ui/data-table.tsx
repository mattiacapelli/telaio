"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Filter,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { Button, IconButton } from "./button";
import { EmptyState } from "./card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Checkbox, SearchInput, Select } from "./field";

export interface Colonna<T> {
  id: string;
  intestazione: string;
  /** cosa mostrare nella cella */
  cella: (riga: T) => React.ReactNode;
  /** valore con cui ordinare: se manca la colonna non è ordinabile */
  ordina?: (riga: T) => string | number | null;
  allinea?: "destra";
  /** larghezza minima in px */
  minLarghezza?: number;
  /** nasconde la colonna sotto la larghezza indicata */
  nascondiSotto?: "sm" | "md" | "lg";
}

export interface Filtro<T> {
  id: string;
  etichetta: string;
  opzioni: { valore: string; etichetta: string }[];
  /** valore della riga confrontato con quelli scelti */
  valore: (riga: T) => string;
}

export interface AzioneRiga {
  etichetta: string;
  icona?: React.ReactNode;
  /** esegue una funzione… */
  alSelezionare?: () => void;
  /** …oppure naviga */
  href?: string;
  pericolosa?: boolean;
}

export interface DataTableProps<T> {
  dati: T[];
  colonne: Colonna<T>[];
  idRiga: (riga: T) => string;
  /** abilita la ricerca testuale: testo su cui cercare */
  testoRicerca?: (riga: T) => string;
  segnapostoRicerca?: string;
  filtri?: Filtro<T>[];
  selezionabile?: boolean;
  /** azioni mostrate quando ci sono righe selezionate */
  azioniDiGruppo?: (selezionate: T[]) => React.ReactNode;
  /** menu della riga (anche con il clic destro) */
  azioniRiga?: (riga: T) => AzioneRiga[];
  /** apre questo indirizzo al clic sulla riga */
  hrefRiga?: (riga: T) => string;
  dimensionePagina?: number;
  vuoto?: { titolo: string; descrizione?: string; azione?: React.ReactNode };
  /** contenuto a destra della barra degli strumenti */
  strumenti?: React.ReactNode;
  etichetta: string;
}

type Ordine = { colonna: string; verso: "asc" | "desc" } | null;

const NASCONDI = { sm: "max-sm:hidden", md: "max-md:hidden", lg: "max-lg:hidden" } as const;
const DIMENSIONI = [10, 20, 50];

function confronta(a: string | number | null, b: string | number | null) {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "it", { numeric: true, sensitivity: "base" });
}

function VociMenu({
  azioni,
  Voce,
  Separatore,
}: {
  azioni: AzioneRiga[];
  Voce: typeof DropdownMenuItem | typeof ContextMenuItem;
  Separatore: typeof DropdownMenuSeparator | typeof ContextMenuSeparator;
}) {
  return (
    <>
      {azioni.map((a, i) => (
        <span key={a.etichetta}>
          {a.pericolosa && i > 0 && <Separatore />}
          {a.href ? (
            <Voce asChild danger={a.pericolosa}>
              <a href={a.href}>
                {a.icona} {a.etichetta}
              </a>
            </Voce>
          ) : (
            <Voce danger={a.pericolosa} onSelect={a.alSelezionare}>
              {a.icona} {a.etichetta}
            </Voce>
          )}
        </span>
      ))}
    </>
  );
}

/**
 * Tabella dati: ordinamento, ricerca, filtri, paginazione, selezione multipla con azioni di
 * gruppo e menu per riga. Lavora sui dati già caricati: per elenchi molto lunghi si pagina
 * lato server.
 */
export function DataTable<T>({
  dati,
  colonne,
  idRiga,
  testoRicerca,
  segnapostoRicerca = "Cerca…",
  filtri = [],
  selezionabile = false,
  azioniDiGruppo,
  azioniRiga,
  hrefRiga,
  dimensionePagina = 20,
  vuoto,
  strumenti,
  etichetta,
}: DataTableProps<T>) {
  const router = useRouter();
  const [ricerca, setRicerca] = useState("");
  const [scelti, setScelti] = useState<Record<string, string[]>>({});
  const [ordine, setOrdine] = useState<Ordine>(null);
  const [pagina, setPagina] = useState(0);
  const [perPagina, setPerPagina] = useState(dimensionePagina);
  const [selezione, setSelezione] = useState<Set<string>>(new Set());

  const visibili = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    let righe = dati.filter((r) => {
      if (q && testoRicerca && !testoRicerca(r).toLowerCase().includes(q)) return false;
      return filtri.every((f) => {
        const s = scelti[f.id];
        return !s || s.length === 0 || s.includes(f.valore(r));
      });
    });
    if (ordine) {
      const col = colonne.find((c) => c.id === ordine.colonna);
      if (col?.ordina) {
        const ord = col.ordina;
        const m = ordine.verso === "asc" ? 1 : -1;
        righe = [...righe].sort((a, b) => m * confronta(ord(a), ord(b)));
      }
    }
    return righe;
  }, [dati, ricerca, scelti, ordine, colonne, filtri, testoRicerca]);

  const pagine = Math.max(1, Math.ceil(visibili.length / perPagina));
  const paginaCorrente = Math.min(pagina, pagine - 1);
  const inPagina = visibili.slice(paginaCorrente * perPagina, (paginaCorrente + 1) * perPagina);
  const filtriAttivi = Object.values(scelti).reduce((n, v) => n + v.length, 0) + (ricerca ? 1 : 0);

  // La pagina torna alla prima quando cambiano ricerca o filtri.
  const primoRender = useRef(true);
  useEffect(() => {
    if (primoRender.current) {
      primoRender.current = false;
      return;
    }
    setPagina(0);
  }, [ricerca, scelti, perPagina]);

  const idInPagina = inPagina.map(idRiga);
  const tuttiSelezionati = idInPagina.length > 0 && idInPagina.every((id) => selezione.has(id));
  const alcuniSelezionati = idInPagina.some((id) => selezione.has(id));
  const righeSelezionate = dati.filter((r) => selezione.has(idRiga(r)));

  const alternaTutti = () =>
    setSelezione((s) => {
      const n = new Set(s);
      for (const id of idInPagina) tuttiSelezionati ? n.delete(id) : n.add(id);
      return n;
    });
  const alternaRiga = (id: string) =>
    setSelezione((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const alternaOrdine = (id: string) =>
    setOrdine((o) =>
      o?.colonna !== id
        ? { colonna: id, verso: "asc" }
        : o.verso === "asc"
          ? { colonna: id, verso: "desc" }
          : null,
    );
  const azzera = () => {
    setRicerca("");
    setScelti({});
  };

  const celleRiga = (r: T) =>
    colonne.map((c) => (
      <td
        key={c.id}
        className={cn(
          "px-3 py-2 align-middle text-sm text-fg",
          c.allinea === "destra" && "text-right tabular-nums",
          c.nascondiSotto && NASCONDI[c.nascondiSotto],
        )}
      >
        {c.cella(r)}
      </td>
    ));

  return (
    <div className="flex flex-col gap-3">
      {/* Barra degli strumenti */}
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        {righeSelezionate.length > 0 ? (
          <>
            <span className="text-sm font-medium text-fg">
              {righeSelezionate.length} selezionat{righeSelezionate.length === 1 ? "o" : "i"}
            </span>
            {azioniDiGruppo?.(righeSelezionate)}
            <Button variant="ghost" size="sm" onClick={() => setSelezione(new Set())}>
              <X /> Deseleziona
            </Button>
          </>
        ) : (
          <>
            {testoRicerca && (
              <SearchInput
                aria-label={`Cerca in ${etichetta}`}
                placeholder={segnapostoRicerca}
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                className="w-full sm:w-64"
              />
            )}
            {filtri.map((f) => {
              const n = scelti[f.id]?.length ?? 0;
              return (
                <DropdownMenu key={f.id}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="md">
                      <Filter /> {f.etichetta}
                      {n > 0 && <Badge variant="brand">{n}</Badge>}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>{f.etichetta}</DropdownMenuLabel>
                    {f.opzioni.map((o) => (
                      <DropdownMenuCheckboxItem
                        key={o.valore}
                        checked={scelti[f.id]?.includes(o.valore) ?? false}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(on) =>
                          setScelti((s) => ({
                            ...s,
                            [f.id]: on
                              ? [...(s[f.id] ?? []), o.valore]
                              : (s[f.id] ?? []).filter((v) => v !== o.valore),
                          }))
                        }
                      >
                        {o.etichetta}
                      </DropdownMenuCheckboxItem>
                    ))}
                    {n > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setScelti((s) => ({ ...s, [f.id]: [] }))}>
                          Azzera
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
            {filtriAttivi > 0 && (
              <Button variant="ghost" size="md" onClick={azzera}>
                <X /> Cancella filtri
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">{strumenti}</div>
          </>
        )}
      </div>

      {/* Tabella */}
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{etichetta}</caption>
          <thead>
            <tr className="border-b border-line bg-subtle">
              {selezionabile && (
                <th scope="col" className="w-10 px-3 py-2">
                  <Checkbox
                    aria-label="Seleziona tutte le righe della pagina"
                    checked={tuttiSelezionati}
                    ref={(el) => {
                      if (el) el.indeterminate = !tuttiSelezionati && alcuniSelezionati;
                    }}
                    onChange={alternaTutti}
                  />
                </th>
              )}
              {colonne.map((c) => {
                const attiva = ordine?.colonna === c.id;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={
                      attiva ? (ordine?.verso === "asc" ? "ascending" : "descending") : undefined
                    }
                    style={c.minLarghezza ? { minWidth: c.minLarghezza } : undefined}
                    className={cn(
                      "h-8 px-3 text-xs font-medium whitespace-nowrap text-fg-2",
                      c.allinea === "destra" && "text-right",
                      c.nascondiSotto && NASCONDI[c.nascondiSotto],
                    )}
                  >
                    {c.ordina ? (
                      <button
                        type="button"
                        onClick={() => alternaOrdine(c.id)}
                        className={cn(
                          "-mx-1 inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 transition-colors duration-150 hover:bg-hover hover:text-fg",
                          c.allinea === "destra" && "flex-row-reverse",
                        )}
                      >
                        {c.intestazione}
                        {attiva ? (
                          ordine?.verso === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3 text-fg-3" />
                        )}
                      </button>
                    ) : (
                      c.intestazione
                    )}
                  </th>
                );
              })}
              {azioniRiga && (
                <th scope="col" className="w-10 px-3">
                  <span className="sr-only">Azioni</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {inPagina.map((r) => {
              const id = idRiga(r);
              const selezionata = selezione.has(id);
              const azioni = azioniRiga?.(r);
              const riga = (
                <tr
                  key={id}
                  data-state={selezionata ? "selected" : undefined}
                  onClick={(e) => {
                    if (
                      !hrefRiga ||
                      (e.target as HTMLElement).closest("a,button,input,label,[role=menuitem]")
                    )
                      return;
                    router.push(hrefRiga(r));
                  }}
                  className={cn(
                    "border-b border-line transition-colors duration-100 last:border-b-0 hover:bg-subtle",
                    selezionata && "bg-selected hover:bg-selected",
                    hrefRiga && "cursor-pointer",
                  )}
                >
                  {selezionabile && (
                    <td className="w-10 px-3 py-2">
                      <Checkbox
                        aria-label="Seleziona la riga"
                        checked={selezionata}
                        onChange={() => alternaRiga(id)}
                      />
                    </td>
                  )}
                  {celleRiga(r)}
                  {azioni && (
                    <td className="w-10 px-2 py-1 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton label="Azioni della riga">
                            <MoreHorizontal />
                          </IconButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <VociMenu
                            azioni={azioni}
                            Voce={DropdownMenuItem}
                            Separatore={DropdownMenuSeparator}
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              );
              return azioni ? (
                <ContextMenu key={id}>
                  <ContextMenuTrigger asChild>{riga}</ContextMenuTrigger>
                  <ContextMenuContent>
                    <VociMenu
                      azioni={azioni}
                      Voce={ContextMenuItem}
                      Separatore={ContextMenuSeparator}
                    />
                  </ContextMenuContent>
                </ContextMenu>
              ) : (
                riga
              );
            })}
          </tbody>
        </table>

        {visibili.length === 0 && (
          <EmptyState
            title={filtriAttivi > 0 ? "Nessun risultato" : (vuoto?.titolo ?? "Niente da mostrare")}
            action={
              filtriAttivi > 0 ? (
                <Button variant="secondary" size="sm" onClick={azzera}>
                  Cancella filtri
                </Button>
              ) : (
                vuoto?.azione
              )
            }
          >
            {filtriAttivi > 0 ? "Prova a cambiare la ricerca o i filtri." : vuoto?.descrizione}
          </EmptyState>
        )}
      </div>

      {/* Paginazione */}
      {visibili.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-fg-2">
          <span>
            {paginaCorrente * perPagina + 1}–
            {Math.min((paginaCorrente + 1) * perPagina, visibili.length)} di {visibili.length}
          </span>
          <div className="flex items-center gap-2">
            {visibili.length > DIMENSIONI[0]! && (
              <Select
                aria-label="Righe per pagina"
                value={perPagina}
                onChange={(e) => setPerPagina(Number(e.target.value))}
                className="h-7 w-auto"
              >
                {DIMENSIONI.map((d) => (
                  <option key={d} value={d}>
                    {d} per pagina
                  </option>
                ))}
              </Select>
            )}
            <IconButton
              label="Pagina precedente"
              variant="secondary"
              disabled={paginaCorrente === 0}
              onClick={() => setPagina(paginaCorrente - 1)}
            >
              <ChevronLeft />
            </IconButton>
            <span className="tabular-nums">
              {paginaCorrente + 1} / {pagine}
            </span>
            <IconButton
              label="Pagina successiva"
              variant="secondary"
              disabled={paginaCorrente >= pagine - 1}
              onClick={() => setPagina(paginaCorrente + 1)}
            >
              <ChevronRight />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  );
}

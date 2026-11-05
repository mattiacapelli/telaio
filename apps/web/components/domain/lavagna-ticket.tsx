"use client";

import {
  codiceTicket,
  ETICHETTE_PRIORITA,
  ETICHETTE_STATO_TICKET,
  ETICHETTE_TIPO_TICKET,
  PRIORITA_TICKET,
  STATI_TICKET,
  type StatoTicket,
  type TipoTicket,
} from "@telaio/core";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bug,
  CheckSquare,
  ChevronsUp,
  FileText,
  LifeBuoy,
  type LucideIcon,
  MessageSquare,
  MessagesSquare,
  MoveRight,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { creaTicketRapidoAction, spostaTicketAction } from "@/app/(app)/progetti/ticket-actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { formatData, oggi } from "@/lib/date";
import { cn } from "@/lib/utils";

export interface TicketCard {
  id: string;
  progettoId: string;
  codiceProgetto: string;
  nomeProgetto: string;
  numero: number;
  titolo: string;
  tipo: TipoTicket;
  stato: StatoTicket;
  priorita: (typeof PRIORITA_TICKET)[number];
  assegnatarioId: string | null;
  assegnatario: string | null;
  scadenza: string | null;
  commenti: number;
  documenti: number;
}

const ICONA_TIPO: Record<TipoTicket, LucideIcon> = {
  attivita: CheckSquare,
  bug: Bug,
  richiesta: MessageSquare,
  assistenza: LifeBuoy,
};
const COLORE_TIPO: Record<TipoTicket, string> = {
  attivita: "text-brand",
  bug: "text-bad",
  richiesta: "text-ok",
  assistenza: "text-warn",
};
const ICONA_PRIORITA: Record<TicketCard["priorita"], { icona: LucideIcon; colore: string }> = {
  bassa: { icona: ArrowDown, colore: "text-fg-3" },
  normale: { icona: ArrowRight, colore: "text-brand" },
  alta: { icona: ArrowUp, colore: "text-warn" },
  urgente: { icona: ChevronsUp, colore: "text-bad" },
};
const PUNTO_COLONNA: Record<StatoTicket, string> = {
  backlog: "bg-fg-3",
  da_fare: "bg-brand",
  in_corso: "bg-warn",
  in_revisione: "bg-brand",
  completato: "bg-ok",
};

/** Sposta `id` nella colonna `stato`, davanti a `primaDi` (o in fondo), mantenendo l'ordine degli altri. */
export function riposiziona(
  elenco: TicketCard[],
  id: string,
  stato: StatoTicket,
  primaDi: string | null,
): TicketCard[] {
  const mosso = elenco.find((t) => t.id === id);
  if (!mosso) return elenco;
  const altri = elenco.filter((t) => t.id !== id);
  const arrivo = { ...mosso, stato };
  const i = primaDi ? altri.findIndex((t) => t.id === primaDi) : -1;
  if (i >= 0) return [...altri.slice(0, i), arrivo, ...altri.slice(i)];
  // in fondo alla colonna: dopo l'ultimo ticket di quello stato, altrimenti in fondo all'elenco
  const ultimo = altri.findLastIndex((t) => t.stato === stato);
  return ultimo >= 0
    ? [...altri.slice(0, ultimo + 1), arrivo, ...altri.slice(ultimo + 1)]
    : [...altri, arrivo];
}

function Scheda({
  t,
  mostraProgetto,
  trascinato,
  onDragStart,
  onDragEnd,
  onSposta,
}: {
  t: TicketCard;
  /** nella lavagna di tutti i progetti la scheda dice a quale appartiene */
  mostraProgetto: boolean;
  trascinato: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onSposta: (stato: StatoTicket) => void;
}) {
  const Tipo = ICONA_TIPO[t.tipo];
  const { icona: Priorita, colore } = ICONA_PRIORITA[t.priorita];
  const scaduto = !!t.scadenza && t.stato !== "completato" && t.scadenza < oggi();
  return (
    <div
      draggable
      data-ticket={t.id}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", t.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative flex cursor-grab flex-col gap-2 rounded-md border border-line bg-surface p-2.5 shadow-xs transition-colors duration-150 hover:border-line-strong active:cursor-grabbing",
        trascinato && "opacity-40",
      )}
    >
      {mostraProgetto && (
        <span className="truncate text-xs text-fg-3" title={t.codiceProgetto}>
          {t.nomeProgetto}
        </span>
      )}
      <Link
        href={`/progetti/${t.progettoId}/ticket/${t.numero}`}
        draggable={false}
        className="text-sm leading-snug font-medium text-fg after:absolute after:inset-0 hover:underline"
      >
        {t.titolo}
      </Link>
      <div className="relative z-10 flex items-center gap-1.5 text-xs text-fg-3">
        <Tipo
          className={cn("size-3.5", COLORE_TIPO[t.tipo])}
          aria-label={ETICHETTE_TIPO_TICKET[t.tipo]}
          role="img"
        />
        <span className="tabular-nums" title={codiceTicket(t.codiceProgetto, t.numero)}>
          #{t.numero}
        </span>
        <Priorita
          className={cn("size-3.5", colore)}
          aria-label={`Priorità ${ETICHETTE_PRIORITA[t.priorita].toLowerCase()}`}
          role="img"
        />
        {t.scadenza && (
          <span className={cn("tabular-nums", scaduto && "font-medium text-bad")}>
            {formatData(t.scadenza).slice(0, 5)}
          </span>
        )}
        {t.commenti > 0 && (
          <span className="inline-flex items-center gap-0.5" title="Commenti">
            <MessagesSquare className="size-3" aria-hidden />
            {t.commenti}
          </span>
        )}
        {t.documenti > 0 && (
          <span className="inline-flex items-center gap-0.5" title="Documenti">
            <FileText className="size-3" aria-hidden />
            {t.documenti}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {t.assegnatario && <Avatar name={t.assegnatario} size="sm" />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                label={`Sposta ${t.titolo}`}
                className="size-6 opacity-60 hover:opacity-100"
              >
                <MoveRight />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sposta in</DropdownMenuLabel>
              {STATI_TICKET.filter((s) => s !== t.stato).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => onSposta(s)}>
                  {ETICHETTE_STATO_TICKET[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
    </div>
  );
}

function AggiungiRapido({
  stato,
  progettoId,
  onCreato,
}: {
  stato: StatoTicket;
  progettoId: string;
  onCreato: () => void;
}) {
  const [aperto, setAperto] = useState(false);
  const [titolo, setTitolo] = useState("");
  const [pending, avvia] = useTransition();
  if (!aperto)
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm text-fg-3 transition-colors duration-150 hover:bg-hover hover:text-fg"
      >
        <Plus className="size-4" aria-hidden /> Crea ticket
      </button>
    );
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const t = titolo.trim();
        if (!t) return;
        avvia(async () => {
          const r = await creaTicketRapidoAction(progettoId, stato, t);
          if (r.ok) {
            setTitolo("");
            onCreato();
          } else toast.errore(r.message ?? "Creazione non riuscita");
        });
      }}
    >
      <Input
        autoFocus
        value={titolo}
        onChange={(e) => setTitolo(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setAperto(false)}
        onBlur={() => !titolo.trim() && setAperto(false)}
        placeholder="Titolo del ticket, poi Invio"
        aria-label={`Nuovo ticket in ${ETICHETTE_STATO_TICKET[stato]}`}
        maxLength={200}
        disabled={pending}
      />
    </form>
  );
}

/**
 * Lavagna kanban: colonne per stato, trascinamento, filtri e creazione rapida. Con `progettoId` è
 * quella di un progetto; senza, mostra i ticket di tutti i progetti (con `progetti` per filtrarli):
 * lì un ticket si sposta di colonna, e si riordina dentro la colonna solo con un progetto scelto.
 */
export function LavagnaTicket({
  progettoId,
  progetti,
  ticket: iniziali,
  utenti,
  utenteCorrenteId,
}: {
  progettoId?: string;
  progetti?: { id: string; etichetta: string }[];
  ticket: TicketCard[];
  utenti: { id: string; nome: string }[];
  utenteCorrenteId: string;
}) {
  const router = useRouter();
  const [ticket, setTicket] = useState(iniziali);
  const [trascinato, setTrascinato] = useState<string | null>(null);
  const [bersaglio, setBersaglio] = useState<{ stato: StatoTicket; primaDi: string | null } | null>(
    null,
  );
  const [cerca, setCerca] = useState("");
  const [assegnatario, setAssegnatario] = useState("");
  const [priorita, setPriorita] = useState("");
  const [progettoFiltro, setProgettoFiltro] = useState("");
  const progettoAttivo = progettoId ?? (progettoFiltro || undefined);
  const riordinabile = !!progettoAttivo;

  // Dopo ogni salvataggio il server rimanda i dati: la lavagna riparte da quelli.
  useEffect(() => setTicket(iniziali), [iniziali]);

  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return ticket.filter(
      (t) =>
        (!q ||
          `${t.titolo} ${t.numero} ${t.nomeProgetto} ${t.assegnatario ?? ""}`
            .toLowerCase()
            .includes(q)) &&
        (!assegnatario ||
          (assegnatario === "nessuno" ? !t.assegnatarioId : t.assegnatarioId === assegnatario)) &&
        (!priorita || t.priorita === priorita) &&
        (!progettoFiltro || t.progettoId === progettoFiltro),
    );
  }, [ticket, cerca, assegnatario, priorita, progettoFiltro]);
  const filtrato = !!cerca.trim() || !!assegnatario || !!priorita || !!progettoFiltro;

  async function sposta(id: string, stato: StatoTicket, primaDi: string | null) {
    const prima = ticket;
    setTicket(riposiziona(prima, id, stato, primaDi));
    const r = await spostaTicketAction(id, stato, primaDi);
    if (!r.ok) {
      setTicket(prima);
      toast.errore(r.message ?? "Spostamento non riuscito");
    } else router.refresh();
  }

  /** Davanti a quale scheda della colonna cade il puntatore (`null` = in fondo). */
  function primaDiSotto(colonna: HTMLElement, y: number): string | null {
    for (const el of colonna.querySelectorAll<HTMLElement>("[data-ticket]")) {
      if (el.dataset.ticket === trascinato) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) return el.dataset.ticket ?? null;
    }
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-fg-3"
          />
          <Input
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca nei ticket"
            aria-label="Cerca nei ticket"
            className="pl-8"
          />
        </div>
        {progetti && (
          <Select
            value={progettoFiltro}
            onChange={(e) => setProgettoFiltro(e.target.value)}
            aria-label="Progetto"
            className="w-auto max-w-56"
          >
            <option value="">Tutti i progetti</option>
            {progetti.map((p) => (
              <option key={p.id} value={p.id}>
                {p.etichetta}
              </option>
            ))}
          </Select>
        )}
        <Select
          value={assegnatario}
          onChange={(e) => setAssegnatario(e.target.value)}
          aria-label="Assegnatario"
          className="w-auto"
        >
          <option value="">Tutti</option>
          <option value={utenteCorrenteId}>Assegnati a me</option>
          <option value="nessuno">Non assegnati</option>
          {utenti
            .filter((u) => u.id !== utenteCorrenteId)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
        </Select>
        <Select
          value={priorita}
          onChange={(e) => setPriorita(e.target.value)}
          aria-label="Priorità"
          className="w-auto"
        >
          <option value="">Ogni priorità</option>
          {PRIORITA_TICKET.map((p) => (
            <option key={p} value={p}>
              {ETICHETTE_PRIORITA[p]}
            </option>
          ))}
        </Select>
      </div>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {STATI_TICKET.map((stato) => {
          const nella = visibili.filter((t) => t.stato === stato);
          const totale = ticket.filter((t) => t.stato === stato).length;
          const sopra = bersaglio?.stato === stato && trascinato !== null;
          return (
            <section
              key={stato}
              aria-label={ETICHETTE_STATO_TICKET[stato]}
              data-colonna={stato}
              onDragOver={(e) => {
                if (!trascinato) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const primaDi = riordinabile ? primaDiSotto(e.currentTarget, e.clientY) : null;
                if (bersaglio?.stato !== stato || bersaglio.primaDi !== primaDi)
                  setBersaglio({ stato, primaDi });
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setBersaglio(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = trascinato ?? e.dataTransfer.getData("text/plain");
                const dove = bersaglio?.stato === stato ? bersaglio : { stato, primaDi: null };
                setTrascinato(null);
                setBersaglio(null);
                if (id) void sposta(id, stato, dove.primaDi);
              }}
              className={cn(
                "flex w-[272px] shrink-0 snap-start flex-col gap-2 rounded-lg bg-subtle p-2 transition-colors duration-150 md:min-w-0 md:flex-1",
                sopra && "bg-brand/5 ring-1 ring-brand/30",
              )}
            >
              <header className="flex items-center gap-2 px-1 pt-0.5">
                <i aria-hidden className={cn("size-2 rounded-full", PUNTO_COLONNA[stato])} />
                <h3 className="text-sm font-medium">{ETICHETTE_STATO_TICKET[stato]}</h3>
                <Badge>{filtrato ? `${nella.length}/${totale}` : totale}</Badge>
              </header>
              <div className="flex min-h-12 flex-col gap-2">
                {nella.map((t) => (
                  <div key={t.id} className="flex flex-col gap-2">
                    {sopra &&
                      riordinabile &&
                      bersaglio?.primaDi === t.id &&
                      trascinato !== t.id && (
                        <div aria-hidden className="h-0.5 rounded-full bg-brand" />
                      )}
                    <Scheda
                      t={t}
                      mostraProgetto={!progettoId}
                      trascinato={trascinato === t.id}
                      onDragStart={() => setTrascinato(t.id)}
                      onDragEnd={() => {
                        setTrascinato(null);
                        setBersaglio(null);
                      }}
                      onSposta={(s) => void sposta(t.id, s, null)}
                    />
                  </div>
                ))}
                {sopra && riordinabile && bersaglio?.primaDi === null && (
                  <div aria-hidden className="h-0.5 rounded-full bg-brand" />
                )}
                {nella.length === 0 && !sopra && (
                  <p className="px-1 py-3 text-center text-xs text-fg-3">
                    {totale === 0 ? "Nessun ticket" : "Nessun ticket con questi filtri"}
                  </p>
                )}
              </div>
              {progettoAttivo && (
                <AggiungiRapido
                  key={progettoAttivo}
                  stato={stato}
                  progettoId={progettoAttivo}
                  onCreato={() => router.refresh()}
                />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

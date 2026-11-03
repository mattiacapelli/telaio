"use client";

import {
  ETICHETTA_PERIODO,
  formatEuro,
  formatEuroCompatto,
  type ServizioRicorrente,
} from "@telaio/core";
import { ExternalLink, Receipt } from "lucide-react";
import { Badge, type VarianteBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

export interface RigaPreventivo {
  id: string;
  numero: string | null;
  cliente: string | null;
  oggetto: string;
  emittente: string;
  unaTantumCent: number;
  unaTantumLordoCent: number | null;
  /** importo proposto, solo se diverso da quello accettato */
  unaTantumPropostaCent: number | null;
  servizi: ServizioRicorrente[];
  /** valore ricorrente annualizzato: solo per ordinare, non è un importo fatturabile */
  valoreAnnuoCent: number;
  /** stato mostrato: include «in_scadenza» */
  stato: string;
  etichettaStato: string;
  data: string;
}

const VARIANTE: Record<string, VarianteBadge> = {
  bozza: "neutral",
  inviato: "brand",
  in_revisione: "warn",
  in_scadenza: "warn",
  accettato: "ok",
  accettato_parzialmente: "warn",
  rifiutato: "neutral",
  scaduto: "bad",
};

const Importo = ({
  cent,
  lordo,
  proposta,
}: {
  cent: number;
  lordo: number | null;
  proposta?: number | null;
}) =>
  cent > 0 || proposta ? (
    <div className="flex flex-col items-end leading-tight">
      <span className="font-medium">{formatEuro(cent)}</span>
      {lordo !== null && cent > 0 && (
        <span className="text-xs text-fg-3">{formatEuro(lordo)} ivato</span>
      )}
      {proposta ? (
        <span className="text-xs text-fg-3">su {formatEuro(proposta)} proposti</span>
      ) : null}
    </div>
  ) : (
    <span className="text-fg-3">—</span>
  );

const periodo = (tipo: "canone_annuo" | "canone_mensile", cent: number) =>
  `${formatEuroCompatto(cent)}/${ETICHETTA_PERIODO[tipo]}`;

/**
 * Servizi ricorrenti, uno per riga: «Manutenzione · € 600/anno oppure € 60/mese» prima dell'accettazione,
 * solo la periodicità scelta dopo. Le alternative non si sommano mai.
 */
function Abbonamenti({ r }: { r: RigaPreventivo }) {
  const decisi = r.stato === "accettato" || r.stato === "accettato_parzialmente";
  const voci = r.servizi
    .map((s) => ({
      ...s,
      opzioni: decisi ? s.opzioni.filter((o) => o.accettata === true) : s.opzioni,
    }))
    .filter((s) => s.opzioni.length > 0);
  if (voci.length === 0) return <span className="text-fg-3">—</span>;
  return (
    <ul className="flex flex-col gap-0.5 text-sm leading-snug">
      {voci.map((s) => (
        <li key={s.chiave} className="text-fg-2">
          <span className="font-medium text-fg">{s.nome}</span> ·{" "}
          <span className="tabular-nums">
            {s.opzioni.map((o, i) => (
              <span key={o.rigaId}>
                {i > 0 && <span className="text-fg-3"> oppure </span>}
                {periodo(o.tipo, o.importoCent)}
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PreventiviTabella({
  righe,
  emittenti,
}: {
  righe: RigaPreventivo[];
  emittenti: string[];
}) {
  return (
    <DataTable
      etichetta="Preventivi"
      dati={righe}
      idRiga={(r) => r.id}
      hrefRiga={(r) => `/preventivi/${r.id}`}
      testoRicerca={(r) =>
        `${r.numero ?? ""} ${r.cliente ?? ""} ${r.oggetto} ${r.emittente} ${r.servizi.map((s) => s.nome).join(" ")}`
      }
      segnapostoRicerca="Numero, cliente, oggetto, servizio…"
      vuoto={{
        titolo: "Nessun preventivo",
        descrizione: "Creane uno dal listino o dal configuratore.",
      }}
      filtri={[
        {
          id: "stato",
          etichetta: "Stato",
          valore: (r) => r.stato,
          opzioni: [
            ["bozza", "Bozza"],
            ["inviato", "Inviato"],
            ["in_scadenza", "In scadenza"],
            ["in_revisione", "In revisione"],
            ["accettato", "Accettato"],
            ["accettato_parzialmente", "Accettato parzialmente"],
            ["rifiutato", "Rifiutato"],
            ["scaduto", "Scaduto"],
          ].map(([valore, etichetta]) => ({
            valore: valore as string,
            etichetta: etichetta as string,
          })),
        },
        {
          id: "emittente",
          etichetta: "Emittente",
          valore: (r) => r.emittente,
          opzioni: emittenti.map((e) => ({ valore: e, etichetta: e })),
        },
      ]}
      colonne={[
        {
          id: "numero",
          intestazione: "Numero",
          ordina: (r) => r.numero ?? "",
          cella: (r) => <span className="font-medium">{r.numero ?? "Bozza"}</span>,
        },
        {
          id: "cliente",
          intestazione: "Cliente",
          ordina: (r) => r.cliente ?? "",
          minLarghezza: 140,
          cella: (r) => r.cliente ?? <span className="text-fg-3">—</span>,
        },
        {
          id: "oggetto",
          intestazione: "Oggetto",
          nascondiSotto: "lg",
          cella: (r) => <span className="text-fg-2">{r.oggetto}</span>,
        },
        {
          id: "ut",
          intestazione: "Una tantum",
          allinea: "destra",
          ordina: (r) => r.unaTantumCent,
          cella: (r) => (
            <Importo
              cent={r.unaTantumCent}
              lordo={r.unaTantumLordoCent}
              proposta={r.unaTantumPropostaCent}
            />
          ),
        },
        {
          id: "abbonamenti",
          intestazione: "Abbonamenti",
          ordina: (r) => r.valoreAnnuoCent,
          minLarghezza: 200,
          cella: (r) => <Abbonamenti r={r} />,
        },
        {
          id: "stato",
          intestazione: "Stato",
          ordina: (r) => r.stato,
          cella: (r) => (
            <Badge variant={VARIANTE[r.stato] ?? "neutral"} dot>
              {r.etichettaStato}
            </Badge>
          ),
        },
        {
          id: "data",
          intestazione: "Data",
          ordina: (r) => r.data,
          nascondiSotto: "md",
          cella: (r) => (
            <span className="tabular-nums text-fg-2">{r.data.split("-").reverse().join("/")}</span>
          ),
        },
      ]}
      azioniRiga={(r) => [
        { etichetta: "Apri", href: `/preventivi/${r.id}`, icona: <ExternalLink /> },
        ...(r.stato === "accettato" || r.stato === "accettato_parzialmente"
          ? [{ etichetta: "Crea fattura", href: `/preventivi/${r.id}`, icona: <Receipt /> }]
          : []),
      ]}
    />
  );
}

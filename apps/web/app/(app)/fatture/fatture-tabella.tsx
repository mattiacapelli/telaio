"use client";

import { formatEuro } from "@telaio/core";
import { ExternalLink } from "lucide-react";
import { Badge, type VarianteBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

export interface RigaFattura {
  id: string;
  numero: string | null;
  data: string | null;
  cliente: string;
  causale: string | null;
  emittente: string;
  imponibileCent: number;
  ivaCent: number;
  bolloCent: number;
  totaleCent: number;
  sdi: string;
  etichettaSdi: string;
  pagamento: string;
  etichettaPagamento: string;
}

const SDI: Record<string, VarianteBadge> = {
  bozza: "neutral",
  emessa: "brand",
  inviata_sdi: "brand",
  consegnata: "ok",
  scartata: "bad",
};
const PAGAMENTO: Record<string, VarianteBadge> = {
  nessuno: "neutral",
  pagata: "ok",
  scaduta: "bad",
  parziale: "warn",
  da_incassare: "brand",
};
const formatData = (iso: string | null) =>
  iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";

export function FattureTabella({
  righe,
  emittenti,
}: {
  righe: RigaFattura[];
  emittenti: string[];
}) {
  return (
    <DataTable
      etichetta="Fatture"
      dati={righe}
      idRiga={(r) => r.id}
      hrefRiga={(r) => `/fatture/${r.id}`}
      testoRicerca={(r) => `${r.numero ?? ""} ${r.cliente} ${r.causale ?? ""}`}
      segnapostoRicerca="Numero, cliente, causale…"
      vuoto={{
        titolo: "Nessuna fattura",
        descrizione: "Accetta un preventivo e crea la fattura, oppure scrivine una libera.",
      }}
      filtri={[
        {
          id: "emittente",
          etichetta: "Emittente",
          valore: (r) => r.emittente,
          opzioni: emittenti.map((e) => ({ valore: e, etichetta: e })),
        },
        {
          id: "pagamento",
          etichetta: "Pagamento",
          valore: (r) => r.pagamento,
          opzioni: [
            { valore: "da_incassare", etichetta: "Da incassare" },
            { valore: "parziale", etichetta: "Parziale" },
            { valore: "scaduta", etichetta: "Scaduta" },
            { valore: "pagata", etichetta: "Pagata" },
          ],
        },
        {
          id: "sdi",
          etichetta: "SDI",
          valore: (r) => r.sdi,
          opzioni: [
            { valore: "bozza", etichetta: "Bozza" },
            { valore: "emessa", etichetta: "Emessa" },
            { valore: "consegnata", etichetta: "Consegnata" },
            { valore: "scartata", etichetta: "Scartata" },
          ],
        },
      ]}
      colonne={[
        {
          id: "numero",
          intestazione: "Numero",
          ordina: (r) => r.numero ?? "~",
          cella: (r) => (
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{r.numero ?? "Bozza"}</span>
              <span className="text-xs text-fg-3 tabular-nums">{formatData(r.data)}</span>
            </div>
          ),
        },
        {
          id: "cliente",
          intestazione: "Cliente",
          ordina: (r) => r.cliente,
          minLarghezza: 160,
          cella: (r) => (
            <div className="flex flex-col leading-tight">
              <span>{r.cliente}</span>
              {r.causale && (
                <span className="max-w-64 truncate text-xs text-fg-3">{r.causale}</span>
              )}
            </div>
          ),
        },
        {
          id: "emittente",
          intestazione: "Emittente",
          ordina: (r) => r.emittente,
          nascondiSotto: "lg",
          cella: (r) => <span className="text-fg-2">{r.emittente}</span>,
        },
        {
          id: "imp",
          intestazione: "Imponibile",
          allinea: "destra",
          ordina: (r) => r.imponibileCent,
          nascondiSotto: "md",
          cella: (r) => formatEuro(r.imponibileCent),
        },
        {
          id: "iva",
          intestazione: "IVA",
          allinea: "destra",
          ordina: (r) => r.ivaCent,
          nascondiSotto: "lg",
          cella: (r) => <span className="text-fg-2">{formatEuro(r.ivaCent)}</span>,
        },
        {
          id: "tot",
          intestazione: "Totale",
          allinea: "destra",
          ordina: (r) => r.totaleCent,
          cella: (r) => <span className="font-medium">{formatEuro(r.totaleCent)}</span>,
        },
        {
          id: "sdi",
          intestazione: "SDI",
          ordina: (r) => r.sdi,
          nascondiSotto: "md",
          cella: (r) => (
            <Badge variant={SDI[r.sdi] ?? "neutral"} dot>
              {r.etichettaSdi}
            </Badge>
          ),
        },
        {
          id: "pag",
          intestazione: "Pagamento",
          ordina: (r) => r.pagamento,
          cella: (r) =>
            r.pagamento === "nessuno" ? (
              <span className="text-fg-3">—</span>
            ) : (
              <Badge variant={PAGAMENTO[r.pagamento] ?? "neutral"} dot>
                {r.etichettaPagamento}
              </Badge>
            ),
        },
      ]}
      azioniRiga={(r) => [{ etichetta: "Apri", href: `/fatture/${r.id}`, icona: <ExternalLink /> }]}
    />
  );
}

"use client";

import { formatEuro } from "@telaio/core";
import { IncassoModal } from "@/components/domain/incasso-modal";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

export interface RigaRata {
  id: string;
  scadenza: string;
  stato: "scaduta" | "in_arrivo";
  giorniRitardo: number;
  parziale: boolean;
  cliente: string | null;
  descrizione: string;
  emittente: string;
  residuoCent: number;
  importoCent: number;
  solleciti: number;
  bozza: boolean;
}

const formatData = (iso: string) => iso.split("-").reverse().join("/");

export function RateTabella({
  righe,
  conti,
}: {
  righe: RigaRata[];
  conti: { id: string; nome: string }[];
}) {
  return (
    <DataTable
      etichetta="Rate e scadenze"
      dati={righe}
      idRiga={(r) => r.id}
      testoRicerca={(r) => `${r.cliente ?? ""} ${r.descrizione} ${r.emittente}`}
      segnapostoRicerca="Cliente o rata…"
      dimensionePagina={20}
      vuoto={{
        titolo: "Niente da incassare",
        descrizione: "Quando ci sono rate aperte le trovi qui.",
      }}
      filtri={[
        {
          id: "stato",
          etichetta: "Stato",
          valore: (r) => r.stato,
          opzioni: [
            { valore: "scaduta", etichetta: "Scadute" },
            { valore: "in_arrivo", etichetta: "In arrivo" },
          ],
        },
        {
          id: "em",
          etichetta: "Emittente",
          valore: (r) => r.emittente,
          opzioni: [...new Set(righe.map((r) => r.emittente))].map((e) => ({
            valore: e,
            etichetta: e,
          })),
        },
      ]}
      colonne={[
        {
          id: "scad",
          intestazione: "Scadenza",
          ordina: (r) => r.scadenza,
          cella: (r) => (
            <div className="flex flex-col leading-tight">
              <span
                className={
                  r.stato === "scaduta"
                    ? "font-medium text-bad tabular-nums"
                    : "font-medium tabular-nums"
                }
              >
                {formatData(r.scadenza)}
              </span>
              <span className="text-xs text-fg-3">
                {r.stato === "scaduta"
                  ? `scaduta da ${r.giorniRitardo} giorni`
                  : r.parziale
                    ? "pagata in parte"
                    : "da incassare"}
              </span>
            </div>
          ),
        },
        {
          id: "cliente",
          intestazione: "Cliente · rata",
          ordina: (r) => r.cliente ?? "",
          minLarghezza: 200,
          cella: (r) => (
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{r.cliente ?? "—"}</span>
              <span className="text-xs text-fg-3">{r.descrizione}</span>
            </div>
          ),
        },
        {
          id: "em",
          intestazione: "Emittente",
          nascondiSotto: "lg",
          ordina: (r) => r.emittente,
          cella: (r) => <span className="text-fg-2">{r.emittente}</span>,
        },
        {
          id: "importo",
          intestazione: "Importo",
          allinea: "destra",
          ordina: (r) => r.residuoCent,
          cella: (r) => (
            <div className="flex flex-col items-end leading-tight">
              <span className="font-medium">{formatEuro(r.residuoCent)}</span>
              {r.residuoCent !== r.importoCent && (
                <span className="text-xs text-fg-3">su {formatEuro(r.importoCent)}</span>
              )}
            </div>
          ),
        },
        {
          id: "soll",
          intestazione: "Solleciti",
          nascondiSotto: "md",
          ordina: (r) => r.solleciti,
          cella: (r) =>
            r.solleciti > 0 ? (
              <Badge variant="warn">
                {r.solleciti} inviat{r.solleciti === 1 ? "o" : "i"}
              </Badge>
            ) : (
              <span className="text-fg-3">—</span>
            ),
        },
        {
          id: "azione",
          intestazione: "Azione",
          cella: (r) =>
            r.bozza ? (
              <Badge variant="warn" dot>
                Bozza da confermare
              </Badge>
            ) : (
              <IncassoModal
                conti={conti}
                rataId={r.id}
                importoCent={r.residuoCent}
                descrizione={r.descrizione}
                trigger="Registra incasso"
                triggerVariant="secondary"
                triggerSize="sm"
              />
            ),
        },
      ]}
    />
  );
}

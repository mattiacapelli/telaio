import { getFatture } from "@/lib/queries";
import { titoloPagina } from "@/lib/titolo";
import { VistaDoppia } from "@/components/vista-doppia";
import { Badge } from "@/components/ui/badge";
import { GeneraDaOre, NuovaFattura } from "@/components/nuova-fattura";
import { Vuoto } from "@/components/ui-legacy";
import { Chip } from "@/components/chip";
import { EliminaRecord } from "@/components/elimina-record";
import { Receipt, Building2, Euro, Calendar, Tag } from "lucide-react";
import { eur, data, daGiorni } from "@/lib/format";
import { getClientiPerSelezione } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: await titoloPagina("Fatture") };
}

const COLONNE = [
  { stato: "DA_EMETTERE", titolo: "Da emettere" },
  { stato: "EMESSA", titolo: "Emessa" },
  { stato: "SCADUTA", titolo: "Scaduta" },
  { stato: "PAGATA", titolo: "Pagata" },
];

export default async function FatturePage() {
  const [fatture, clienti] = await Promise.all([
    getFatture(),
    getClientiPerSelezione(),
  ]);
  if (fatture.length === 0) {
    return (
      <div className="tl-in">
        <div className="mb-3 flex items-center justify-end gap-2">
          <GeneraDaOre />
          <NuovaFattura clienti={clienti} />
        </div>
        <Vuoto titolo="Nessuna fattura" nota="Genera la prima fattura dalle ore registrate." />
      </div>
    );
  }

  const emesso = fatture
    .filter((f) => f.stato !== "DA_EMETTERE")
    .reduce((s, f) => s + f.imponibile, 0);
  const incassato = fatture.reduce((s, f) => s + f.incassato, 0);

  const elementi = fatture.map((f) => {
    const ritardo = f.stato === "SCADUTA" && f.scadeIl ? daGiorni(f.scadeIl) : null;
    return {
      id: f.id,
      stato: f.stato,
      etichetta: f.numero,
      contenuto: (
        <>
          <div className="flex items-center gap-2">
            <span className="text-md font-medium">{f.numero}</span>
            <div className="flex-1" />
            <span className="text-md font-semibold">{eur(f.imponibile)}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-md text-muted">
            <Chip testo={f.cliente} />
            <span className="truncate">{f.cliente}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-faint">
            {ritardo !== null ? (
              <Badge tono="attenzione">+{ritardo} gg</Badge>
            ) : f.scadeIl ? (
              <span>scade {data(f.scadeIl)}</span>
            ) : (
              <span>da emettere</span>
            )}
            <div className="flex-1" />
            {f.incassato > 0 && f.incassato < f.imponibile && (
              <span>incassato {eur(f.incassato)}</span>
            )}
          </div>
          {f.stato === "DA_EMETTERE" && (
            <div className="mt-2 flex justify-end" onClick={(e) => e.stopPropagation()}>
              <EliminaRecord entita="fattura" id={f.id} nome={f.numero} />
            </div>
          )}
        </>
      ),
    };
  });

  return (
    <div className="tl-in flex flex-col gap-3">
      <VistaDoppia
        chiave="fatture"
        entita="fattura"
        colonne={COLONNE}
        elementi={elementi}
        intestazione={
          <span className="text-md text-muted">
            Emesso <strong className="text-text">{eur(emesso)}</strong> · incassato{" "}
            <strong className="text-text">{eur(incassato)}</strong> · da incassare{" "}
            <strong className="text-text">{eur(emesso - incassato)}</strong>
          </span>
        }
        azioni={
          <>
            <GeneraDaOre />
            <NuovaFattura clienti={clienti} />
          </>
        }
        colonneTabella={[
          { intestazione: "Numero", larghezza: "110px", icona: <Receipt key="i1" size={13} /> },
          { intestazione: "Cliente", larghezza: "minmax(0, 1.6fr)", icona: <Building2 key="i2" size={13} /> },
          { intestazione: "Stato", larghezza: "120px", icona: <Tag key="i3" size={13} /> },
          { intestazione: "Scadenza", larghezza: "100px", icona: <Calendar key="i4" size={13} /> },
          { intestazione: "Incassato", larghezza: "110px", allinea: "destra" },
          { intestazione: "Imponibile", larghezza: "110px", allinea: "destra", icona: <Euro key="i5" size={13} /> },
        ]}
        righe={fatture.map((x) => ({
          id: x.id,
          celle: [
            <span key="c1" className="font-medium">{x.numero}</span>,
            <span key="c2" className="flex min-w-0 items-center gap-1.5 text-muted">
              <Chip testo={x.cliente} />
              <span className="truncate">{x.cliente}</span>
            </span>,
            <Badge key="c3" tono={x.stato === "SCADUTA" ? "attenzione" : "neutro"}>
              {COLONNE.find((c) => c.stato === x.stato)?.titolo ?? x.stato}
            </Badge>,
            <span key="c4" className="text-muted">
              {x.scadeIl ? data(x.scadeIl) : "—"}
            </span>,
            <span key="c5" className="text-muted">
              {x.incassato > 0 ? eur(x.incassato) : "—"}
            </span>,
            <span key="c6" className="font-medium">{eur(x.imponibile)}</span>,
          ],
        }))}
      />
    </div>
  );
}

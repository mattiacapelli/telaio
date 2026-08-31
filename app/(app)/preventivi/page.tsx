import Link from "next/link";
import { getPreventivi, getClientiPerSelezione, getTariffaListino } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { VistaDoppia } from "@/components/vista-doppia";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/chip";
import { Vuoto } from "@/components/ui-legacy";
import { eur, data, daGiorni } from "@/lib/format";
import { NuovoPreventivo } from "@/components/nuovo-preventivo";
import { FileText, Building2, Euro, Calendar, Tag } from "lucide-react";

export const dynamic = "force-dynamic";

const COLONNE = [
  { stato: "BOZZA", titolo: "Bozza" },
  { stato: "INVIATO", titolo: "Inviato" },
  { stato: "ACCETTATO", titolo: "Accettato" },
  { stato: "RIFIUTATO", titolo: "Rifiutato" },
];

const STATI: Record<string, string> = {
  BOZZA: "Bozza",
  INVIATO: "Inviato",
  ACCETTATO: "Accettato",
  RIFIUTATO: "Rifiutato",
};

export default async function PreventiviPage() {
  const [preventivi, clienti, tariffaListino, aziende] = await Promise.all([
    getPreventivi(),
    getClientiPerSelezione(),
    getTariffaListino(),
    prisma.azienda.findMany({ select: { id: true, ragioneSociale: true }, orderBy: { ragioneSociale: "asc" } }),
  ]);

  if (preventivi.length === 0) {
    return <Vuoto titolo="Nessun preventivo" nota="Crea il primo preventivo per iniziare." />;
  }

  const inTrattativa = preventivi
    .filter((p) => p.stato === "BOZZA" || p.stato === "INVIATO")
    .reduce((s, p) => s + p.imponibile, 0);

  const elementi = preventivi.map((p) => {
    const giorni = p.scadeIl
      ? Math.ceil((new Date(p.scadeIl).getTime() - Date.now()) / 86400000)
      : null;
    const inviatoDa = daGiorni(p.inviatoIl);

    return {
      id: p.id,
      stato: p.stato,
      etichetta: p.titolo,
      contenuto: (
        <>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-faint">{p.numero}</span>
            {p.revisione && <Badge tono="accento">{p.revisione}</Badge>}
          </div>
          <Link
            href={`/preventivi/${p.id}`}
            className="mt-0.5 block text-md font-medium hover:underline"
          >
            {p.titolo}
          </Link>
          <div className="mt-1 flex items-center gap-1.5 text-md text-muted">
            <Chip testo={p.cliente} />
            <span className="truncate">{p.cliente}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-md font-semibold">{eur(p.imponibile)}</span>
            <div className="flex-1" />
            {giorni !== null && giorni >= 0 ? (
              <Badge tono={giorni <= 7 ? "attenzione" : "neutro"}>
                scade in {giorni} gg
              </Badge>
            ) : inviatoDa !== null ? (
              <Badge>
                {inviatoDa === 0 ? "inviato oggi" : `inviato ${inviatoDa} gg`}
              </Badge>
            ) : (
              <Badge>{p.voci} voci</Badge>
            )}
          </div>
        </>
      ),
    };
  });

  return (
    <div className="tl-in">
      <VistaDoppia
        chiave="preventivi"
        entita="preventivo"
        colonne={COLONNE}
        elementi={elementi}
        intestazione={
          <span className="text-md text-muted">
            {preventivi.length} preventivi ·{" "}
            <strong className="text-text">{eur(inTrattativa)}</strong> in trattativa
          </span>
        }
        azioni={
          <NuovoPreventivo clienti={clienti} tariffaListino={tariffaListino} aziende={aziende} />
        }
        colonneTabella={[
          { intestazione: "Numero", larghezza: "130px", icona: <FileText key="i1" size={13} /> },
          { intestazione: "Titolo", larghezza: "minmax(0, 1.6fr)" },
          { intestazione: "Cliente", icona: <Building2 key="i2" size={13} /> },
          { intestazione: "Stato", larghezza: "110px", icona: <Tag key="i3" size={13} /> },
          { intestazione: "Scadenza", larghezza: "100px", icona: <Calendar key="i4" size={13} /> },
          { intestazione: "Imponibile", larghezza: "110px", allinea: "destra", icona: <Euro key="i5" size={13} /> },
        ]}
        righe={preventivi.map((x) => ({
          id: x.id,
          href: `/preventivi/${x.id}`,
          celle: [
            <span key="c1" className="flex items-center gap-1.5">
              <span className="text-faint">{x.numero}</span>
              {x.revisione && <Badge tono="accento">{x.revisione}</Badge>}
            </span>,
            <span key="c2" className="truncate font-medium">
              {x.titolo}
            </span>,
            <span key="c3" className="flex min-w-0 items-center gap-1.5 text-muted">
              <Chip testo={x.cliente} />
              <span className="truncate">{x.cliente}</span>
            </span>,
            <Badge key="c4">{STATI[x.stato]}</Badge>,
            <span key="c5" className="text-muted">
              {x.scadeIl ? data(x.scadeIl) : "—"}
            </span>,
            <span key="c6" className="font-medium">
              {eur(x.imponibile)}
            </span>,
          ],
        }))}
      />
    </div>
  );
}

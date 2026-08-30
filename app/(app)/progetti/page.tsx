import Link from "next/link";
import { getProgetti } from "@/lib/queries";
import { VistaDoppia } from "@/components/vista-doppia";
import { Badge } from "@/components/ui/badge";
import { Barra, Vuoto } from "@/components/ui-legacy";
import { Chip } from "@/components/chip";
import { eur, ore, data } from "@/lib/format";
import { FolderKanban, Building2, Euro, Clock, Tag } from "lucide-react";

export const dynamic = "force-dynamic";

const COLONNE = [
  { stato: "DA_AVVIARE", titolo: "Da avviare" },
  { stato: "IN_CORSO", titolo: "In corso" },
  { stato: "IN_PAUSA", titolo: "In pausa" },
  { stato: "CONCLUSO", titolo: "Concluso" },
];

const STATI: Record<string, string> = {
  DA_AVVIARE: "Da avviare",
  IN_CORSO: "In corso",
  IN_PAUSA: "In pausa",
  CONCLUSO: "Concluso",
};

export default async function ProgettiPage() {
  const progetti = await getProgetti();
  if (progetti.length === 0) {
    return <Vuoto titolo="Nessun progetto" nota="I progetti nascono dai preventivi accettati." />;
  }

  const elementi = progetti.map((p) => ({
    id: p.id,
    stato: p.stato,
    etichetta: p.nome,
    contenuto: (
      <>
        <Link href={`/progetti/${p.id}`} className="text-xs font-medium hover:underline">
          {p.nome}
        </Link>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <Chip testo={p.cliente} />
          <span className="truncate">{p.cliente}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="font-semibold">{eur(p.valore)}</span>
          <div className="flex-1" />
          <span className="text-muted">
            {p.oreFatte > 0
              ? `${p.oreFatte.toLocaleString("it-IT", { maximumFractionDigits: 0 })}/${p.budgetOre.toLocaleString("it-IT", { maximumFractionDigits: 0 })} h`
              : `${p.budgetOre.toLocaleString("it-IT", { maximumFractionDigits: 0 })} h a budget`}
          </span>
        </div>
        {p.oreFatte > 0 && (
          <div className="mt-2">
            <Barra valore={p.oreFatte} max={p.budgetOre} />
          </div>
        )}
        <div className="mt-2 text-xxs text-faint">
          {p.note
            ? p.note
            : p.milestone
              ? `${p.milestone.titolo} il ${data(p.milestone.scadenzaIl)}`
              : p.consegnaIl
                ? `Consegna ${data(p.consegnaIl)}`
                : p.inizioIl
                  ? `Avvio ${data(p.inizioIl)}`
                  : ""}
        </div>
      </>
    ),
  }));

  return (
    <div className="tl-in">
      <VistaDoppia
        chiave="progetti"
        entita="progetto"
        colonne={COLONNE}
        elementi={elementi}
        intestazione={
          <span className="text-xs text-muted">{progetti.length} progetti</span>
        }
        colonneTabella={[
          { intestazione: "Progetto", larghezza: "minmax(0, 1.6fr)", icona: <FolderKanban key="i1" size={13} /> },
          { intestazione: "Cliente", icona: <Building2 key="i2" size={13} /> },
          { intestazione: "Stato", larghezza: "110px", icona: <Tag key="i3" size={13} /> },
          { intestazione: "Ore", larghezza: "150px", icona: <Clock key="i4" size={13} /> },
          { intestazione: "Valore", larghezza: "110px", allinea: "destra", icona: <Euro key="i5" size={13} /> },
        ]}
        righe={progetti.map((x) => ({
          id: x.id,
          href: `/progetti/${x.id}`,
          celle: [
            <span key="c1" className="truncate font-medium">{x.nome}</span>,
            <span key="c2" className="flex min-w-0 items-center gap-1.5 text-muted">
              <Chip testo={x.cliente} />
              <span className="truncate">{x.cliente}</span>
            </span>,
            <Badge key="c3">{STATI[x.stato]}</Badge>,
            <div key="c4">
              <div className="text-muted">
                {ore(x.oreFatte)} / {ore(x.budgetOre)}
              </div>
              <div className="mt-1">
                <Barra valore={x.oreFatte} max={x.budgetOre} />
              </div>
            </div>,
            <span key="c5" className="font-medium">{eur(x.valore)}</span>,
          ],
        }))}
      />
    </div>
  );
}

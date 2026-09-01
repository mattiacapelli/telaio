import Link from "next/link";
import { getAttivita, getProgettiPerSelezione } from "@/lib/queries";
import { titoloPagina } from "@/lib/titolo";
import { VistaDoppia } from "@/components/vista-doppia";
import { Badge } from "@/components/ui/badge";
import { Vuoto } from "@/components/ui-legacy";
import { data } from "@/lib/format";
import { AvviaTimer } from "@/components/avvia-timer";
import { NuovaAttivita } from "@/components/nuova-attivita";
import { CircleCheck, FolderKanban, Clock, Calendar, Tag } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: await titoloPagina("Attività") };
}

const COLONNE = [
  { stato: "DA_FARE", titolo: "Da fare" },
  { stato: "IN_CORSO", titolo: "In corso" },
  { stato: "BLOCCATA", titolo: "Bloccate" },
  { stato: "FATTA", titolo: "Fatte" },
];

const STATI: Record<string, string> = {
  DA_FARE: "Da fare",
  IN_CORSO: "In corso",
  BLOCCATA: "Bloccata",
  FATTA: "Fatta",
};

export default async function AttivitaPage() {
  const [attivita, progetti] = await Promise.all([getAttivita(), getProgettiPerSelezione()]);

  if (attivita.length === 0) {
    return (
      <Vuoto
        titolo="Nessuna attività"
        nota="Crea un'attività libera oppure aggiungila da un progetto."
        azione={<NuovaAttivita progetti={progetti} />}
      />
    );
  }

  const elementi = attivita.map((a) => ({
    id: a.id,
    stato: a.stato,
    etichetta: a.titolo,
    contenuto: (
      <>
        <Link href={`/attivita/${a.id}`} className="block text-md font-medium hover:underline">
          {a.titolo}
        </Link>
        <div className="truncate text-md text-muted">{a.progetto}</div>
        {a.stato === "BLOCCATA" ? (
          <div className="mt-2 text-xs text-faint">{a.bloccoNota ?? "Bloccata"}</div>
        ) : (
          <div className="mt-2 flex items-center gap-2 text-xs text-faint">
            <span>
              {a.oreFatte.toLocaleString("it-IT", { maximumFractionDigits: 2 })}/
              {a.stimaOre.toLocaleString("it-IT", { maximumFractionDigits: 0 })} h
            </span>
            <div className="flex-1" />
            {a.completataIl ? (
              <span>{data(a.completataIl)}</span>
            ) : a.scadenzaIl ? (
              <span>{data(a.scadenzaIl)}</span>
            ) : null}
            {a.stato === "DA_FARE" && (
              <AvviaTimer attivitaId={a.id} etichetta={a.titolo} />
            )}
          </div>
        )}
      </>
    ),
  }));

  return (
    <div className="tl-in">
      <VistaDoppia
        chiave="attivita"
        entita="attivita"
        colonne={COLONNE}
        elementi={elementi}
        intestazione={
          <span className="text-md text-muted">{attivita.length} attività</span>
        }
        azioni={<NuovaAttivita progetti={progetti} />}
        colonneTabella={[
          { intestazione: "Attività", larghezza: "minmax(0, 1.8fr)", icona: <CircleCheck key="i1" size={13} /> },
          { intestazione: "Progetto", icona: <FolderKanban key="i2" size={13} /> },
          { intestazione: "Stato", larghezza: "100px", icona: <Tag key="i3" size={13} /> },
          { intestazione: "Ore", larghezza: "100px", allinea: "destra", icona: <Clock key="i4" size={13} /> },
          { intestazione: "Scadenza", larghezza: "100px", allinea: "destra", icona: <Calendar key="i5" size={13} /> },
        ]}
        righe={attivita.map((x) => ({
          id: x.id,
          href: `/attivita/${x.id}`,
          celle: [
            <div key="c1" className="min-w-0">
              <div className="truncate font-medium">{x.titolo}</div>
              {x.bloccoNota && (
                <div className="truncate text-xs text-faint">{x.bloccoNota}</div>
              )}
            </div>,
            <span key="c2" className="truncate text-muted">{x.progetto}</span>,
            <Badge key="c3" tono={x.stato === "IN_CORSO" ? "accento" : "neutro"}>
              {STATI[x.stato]}
            </Badge>,
            <span key="c4" className="text-muted">
              {x.oreFatte.toLocaleString("it-IT", { maximumFractionDigits: 2 })}/
              {x.stimaOre.toLocaleString("it-IT", { maximumFractionDigits: 0 })} h
            </span>,
            <span key="c5" className="text-muted">
              {x.completataIl
                ? data(x.completataIl)
                : x.scadenzaIl
                  ? data(x.scadenzaIl)
                  : "—"}
            </span>,
          ],
        }))}
      />
    </div>
  );
}

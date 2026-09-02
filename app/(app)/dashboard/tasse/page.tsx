import Link from "next/link";
import { getTasse } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { titoloPagina } from "@/lib/titolo";
import { Card, CardHead } from "@/components/ui/card";
import { Stat, Vuoto } from "@/components/ui-legacy";
import { eur } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: await titoloPagina("Dashboard · Tasse") };
}

export default async function DashboardTassePage({
  searchParams,
}: {
  searchParams: Promise<{ azienda?: string }>;
}) {
  const { azienda: aziendaFiltro } = await searchParams;
  const aziendaId = aziendaFiltro && aziendaFiltro !== "tutte" ? aziendaFiltro : null;

  const [risultato, aziende] = await Promise.all([
    getTasse(undefined, aziendaId),
    prisma.azienda.findMany({ orderBy: { ragioneSociale: "asc" }, select: { id: true, ragioneSociale: true } }),
  ]);

  return (
    <div className="tl-in flex flex-col gap-3">
      {aziende.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Link
            href="/dashboard/tasse?azienda=tutte"
            className={`rounded-full border px-2.5 py-1 transition-colors ${
              !aziendaId
                ? "border-accent-line bg-accent-soft text-accent"
                : "border-border text-muted hover:text-text"
            }`}
          >
            Tutte
          </Link>
          {aziende.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard/tasse?azienda=${a.id}`}
              className={`rounded-full border px-2.5 py-1 transition-colors ${
                aziendaId === a.id
                  ? "border-accent-line bg-accent-soft text-accent"
                  : "border-border text-muted hover:text-text"
              }`}
            >
              {a.ragioneSociale}
            </Link>
          ))}
        </div>
      )}

      {risultato.nonCalcolabile && (
        <div className="flex items-start gap-2 rounded-md border border-[var(--neg)] bg-[var(--neg-soft)] px-3 py-2 text-xs text-neg">
          <AlertTriangle size={14} className="mt-0.5 flex-none" />
          <div>
            <strong>{eur(risultato.nonCalcolabile.incassato)}</strong> incassati non entrano nel calcolo:{" "}
            {risultato.nonCalcolabile.aziende.length > 0 ? (
              <>
                {risultato.nonCalcolabile.aziende.map((a) => a.nome).join(", ")} non {risultato.nonCalcolabile.aziende.length > 1 ? "hanno" : "ha"} un regime fiscale assegnato.
              </>
            ) : (
              "fatture senza una ragione sociale emittente."
            )}{" "}
            <Link href="/impostazioni" className="underline hover:no-underline">Assegna un regime</Link> in Impostazioni.
          </div>
        </div>
      )}

      {!risultato.aggregato ? (
        <Vuoto titolo="Nessun incasso nell'anno" nota={`Il calcolo si basa sull'incassato del ${risultato.anno}: appena registri un incasso comparirà qui.`} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat etichetta={`Incassato ${risultato.anno}`} valore={eur(risultato.aggregato.incassatoAnno)} />
            <Stat etichetta="Imposta sostitutiva dovuta" valore={eur(risultato.aggregato.impostaSostitutivaDovuta)} />
            <Stat etichetta="Contributi INPS dovuti" valore={eur(risultato.aggregato.contributiInpsDovuti)} />
            <Stat
              etichetta="Totale da accantonare"
              valore={eur(risultato.aggregato.totaleDaAccantonare)}
              nota={`netto residuo ${eur(risultato.aggregato.nettoResiduo)}`}
            />
          </div>

          {risultato.calcoli.length === 1 ? (
            <Card>
              <CardHead titolo={`Dettaglio calcolo · ${risultato.calcoli[0].regime.nome}`} />
              <DettaglioPassaggi calcolo={risultato.calcoli[0]} />
            </Card>
          ) : (
            <Card>
              <CardHead titolo="Ripartizione per azienda" />
              <div className="rounded-b">
                {risultato.calcoli.map((c) => (
                  <div key={c.aziendaId} className="border-b border-border px-3 py-2 last:border-0">
                    <div className="mb-1.5 flex items-center gap-2 text-md">
                      <span className="flex-1 truncate font-medium">{c.aziendaNome}</span>
                      <span className="text-xs text-faint">{c.regime.nome}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span>incassato {eur(c.incassatoAnno)}</span>
                      <span>sostitutiva {eur(c.impostaSostitutivaDovuta)}</span>
                      <span>INPS {eur(c.contributiInpsDovuti)}</span>
                      <span className="text-text">da accantonare {eur(c.totaleDaAccantonare)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <p className="text-xs text-faint">
        Stima indicativa a scopo organizzativo: non sostituisce la consulenza di un commercialista.
      </p>
    </div>
  );
}

function DettaglioPassaggi({
  calcolo,
}: {
  calcolo: {
    incassatoAnno: number;
    redditoLordoForfettario: number;
    contributiInpsDovuti: number;
    redditoImponibileFiscale: number;
    impostaSostitutivaDovuta: number;
    regime: { coefficienteRedditivita: number; aliquotaSostitutiva: number; aliquotaInps: number };
  };
}) {
  const passaggi = [
    {
      titolo: "Reddito lordo forfettario",
      formula: `${eur(calcolo.incassatoAnno)} incassati × ${calcolo.regime.coefficienteRedditivita}%`,
      valore: calcolo.redditoLordoForfettario,
    },
    {
      titolo: "Contributi INPS dovuti",
      formula: `${eur(calcolo.redditoLordoForfettario)} reddito lordo × ${calcolo.regime.aliquotaInps}%`,
      valore: calcolo.contributiInpsDovuti,
    },
    {
      titolo: "Reddito imponibile fiscale",
      formula: `${eur(calcolo.redditoLordoForfettario)} reddito lordo − ${eur(calcolo.contributiInpsDovuti)} contributi INPS`,
      valore: calcolo.redditoImponibileFiscale,
    },
    {
      titolo: "Imposta sostitutiva dovuta",
      formula: `${eur(calcolo.redditoImponibileFiscale)} imponibile × ${calcolo.regime.aliquotaSostitutiva}%`,
      valore: calcolo.impostaSostitutivaDovuta,
    },
  ];

  return (
    <div className="flex flex-col gap-0 rounded-b">
      {passaggi.map((p, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0">
          <div className="min-w-0 flex-1">
            <div className="text-md font-medium">{p.titolo}</div>
            <div className="truncate text-xs text-faint">{p.formula}</div>
          </div>
          <span className="flex-none text-md font-semibold">{eur(p.valore)}</span>
        </div>
      ))}
    </div>
  );
}

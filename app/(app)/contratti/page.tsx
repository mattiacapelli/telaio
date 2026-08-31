import Link from "next/link";
import { getContratti, getClientiPerSelezione } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat, Barra, Vuoto } from "@/components/ui-legacy";
import { Chip } from "@/components/chip";
import { NuovoContratto } from "@/components/nuovo-contratto";
import { eur, ore, data } from "@/lib/format";
import { TIPI, STATI, PERIODICITA } from "@/lib/contratti";
import { FileSignature, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContrattiPage() {
  const [contratti, clienti, progetti, aziende] = await Promise.all([
    getContratti(),
    getClientiPerSelezione(),
    prisma.progetto.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.azienda.findMany({ select: { id: true, ragioneSociale: true }, orderBy: { ragioneSociale: "asc" } }),
  ]);

  const attivi = contratti.filter((c) => c.stato === "ATTIVO");
  // Valore annuo ricorrente: il canone moltiplicato per i periodi nell'anno.
  const perAnno: Record<string, number> = {
    MENSILE: 12, TRIMESTRALE: 4, SEMESTRALE: 2, ANNUALE: 1,
  };
  const ricorrenteAnnuo = attivi.reduce(
    (s, c) => s + c.canone * (perAnno[c.periodicita] ?? 1),
    0,
  );
  const inScadenza = attivi.filter(
    (c) => c.giorniAllaScadenza !== null && c.giorniAllaScadenza <= 60,
  );
  const monteEsaurito = attivi.filter(
    (c) => c.consumo && c.consumo.residue !== null && c.consumo.residue <= 0,
  );

  return (
    <div className="tl-in flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-md text-muted">
          {contratti.length} contratti · {attivi.length} attivi
        </span>
        <div className="flex-1" />
        <NuovoContratto clienti={clienti} progetti={progetti} aziende={aziende} />
      </div>

      {(inScadenza.length > 0 || monteEsaurito.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {inScadenza.map((c) => (
            <Link
              key={c.id}
              href={`/contratti/${c.id}`}
              className="flex items-center gap-1.5 rounded border px-2 py-1 text-md"
              style={{ borderColor: "var(--neg)", background: "var(--neg-soft)", color: "var(--neg)" }}
            >
              <AlertTriangle size={12} />
              {c.numero} scade tra {c.giorniAllaScadenza} giorni
            </Link>
          ))}
          {monteEsaurito.map((c) => (
            <Link
              key={c.id}
              href={`/contratti/${c.id}`}
              className="flex items-center gap-1.5 rounded border px-2 py-1 text-md"
              style={{ borderColor: "var(--neg)", background: "var(--neg-soft)", color: "var(--neg)" }}
            >
              <AlertTriangle size={12} />
              {c.numero}: monte ore esaurito
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat etichetta="Contratti attivi" valore={String(attivi.length)} nota={`su ${contratti.length} totali`} />
        <Stat etichetta="Ricorrente annuo" valore={eur(ricorrenteAnnuo)} nota="somma dei canoni" />
        <Stat
          etichetta="Ore incluse nel periodo"
          valore={ore(attivi.reduce((s, c) => s + (c.consumo?.monteOre ?? 0), 0))}
          nota={`${ore(attivi.reduce((s, c) => s + (c.consumo?.consumate ?? 0), 0))} consumate`}
        />
        <Stat
          etichetta="In scadenza"
          valore={String(inScadenza.length)}
          nota="entro 60 giorni"
        />
      </div>

      {contratti.length === 0 ? (
        <Vuoto
          titolo="Nessun contratto"
          nota="Registra un canone di assistenza, un abbonamento ricorrente o un contratto di progetto."
        />
      ) : (
        <Card>
          {contratti.map((c) => (
            <Link
              key={c.id}
              href={`/contratti/${c.id}`}
              className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 hover:bg-[var(--alpha-lighter)]"
            >
              <FileSignature size={14} className="flex-none text-faint" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-faint">{c.numero}</span>
                  <span className="truncate text-md font-medium">{c.titolo}</span>
                  <Badge tono={c.stato === "ATTIVO" ? "accento" : "neutro"}>
                    {STATI[c.stato]}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-faint">
                  <Chip testo={c.cliente} />
                  <span className="truncate">{c.cliente}</span>
                  <span>· {TIPI[c.tipo]}</span>
                  {c.scadeIl && <span>· scade {data(c.scadeIl)}</span>}
                </div>
              </div>

              {c.consumo && c.consumo.monteOre !== null && (
                <div className="w-32 flex-none">
                  <div className="mb-1 text-right text-xs text-faint">
                    <span className={c.consumo.residue !== null && c.consumo.residue < 0 ? "text-neg" : ""}>
                      {ore(c.consumo.consumate)} / {ore(c.consumo.monteOre)}
                    </span>
                  </div>
                  <Barra valore={c.consumo.consumate} max={c.consumo.monteOre} />
                </div>
              )}

              <div className="w-24 flex-none text-right">
                <div className="text-md font-medium">{eur(c.canone)}</div>
                <div className="text-xs text-faint">{PERIODICITA[c.periodicita]}</div>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

import { formattaOre } from "@telaio/core";
import {
  elencaTempo,
  getDb,
  minutiNelPeriodo,
  riepilogoMonteOre,
  tempoRecente,
  timerAttivo,
} from "@telaio/db";
import Link from "next/link";
import { type ContrattoRapido, TimerSemplice } from "@/components/domain/timer-semplice";
import { PageHeader } from "@/components/ui/page-header";
import { oggi } from "@/lib/date";
import { opzioniTempo } from "@/lib/tempo-opzioni";

export const metadata = { title: "Timer" };
export const dynamic = "force-dynamic";

export default async function TimerPage() {
  const db = getDb();
  const dataOggi = oggi();
  const [timer, attivi, recenti, opzioni, voci, minOggi] = await Promise.all([
    timerAttivo(db),
    riepilogoMonteOre(db, dataOggi, { stato: "attivo" }),
    tempoRecente(db, 5),
    opzioniTempo(db, dataOggi),
    elencaTempo(db, { da: dataOggi, a: dataOggi, limite: 50 }),
    minutiNelPeriodo(db, dataOggi, dataOggi),
  ]);

  const contratti: ContrattoRapido[] = attivi.flatMap((r) =>
    r.corrente
      ? [
          {
            id: r.contratto.id,
            nome: r.contratto.nome,
            cliente: r.cliente,
            incluse: r.corrente.incluse,
            usati: r.corrente.usati,
            rimanenti: r.corrente.rimanenti,
            extra: r.corrente.extra,
            percentuale: r.corrente.percentuale,
            n: r.corrente.n,
            inizio: r.corrente.inizio,
            fine: r.corrente.fine,
          },
        ]
      : [],
  );
  // contratti il cui periodo non è ancora iniziato non si avviano da qui
  const saldoTimer = timer?.v.monteOreId
    ? (contratti.find((c) => c.id === timer.v.monteOreId) ?? null)
    : null;

  return (
    <>
      <PageHeader
        titolo="Timer"
        descrizione="Avvia con un tocco, ferma quando hai finito: il tempo si registra da solo."
        azioni={
          <Link href="/tempo" className="text-sm text-fg-2 hover:underline">
            Tutte le voci
          </Link>
        }
      />
      <TimerSemplice
        attivo={
          timer?.v.avviatoAt
            ? {
                avviatoAt: timer.v.avviatoAt.toISOString(),
                cliente: timer.cliente,
                contratto: timer.contratto,
                descrizione: timer.v.descrizione,
                saldo: saldoTimer,
              }
            : null
        }
        contratti={contratti}
        recenti={recenti}
        clienti={opzioni.clienti}
      />

      <section className="mx-auto flex w-full max-w-lg flex-col gap-2" aria-labelledby="t-oggi">
        <div className="flex items-baseline justify-between">
          <h2 id="t-oggi" className="text-sm font-semibold text-fg-2">
            Oggi
          </h2>
          <span className="text-sm font-semibold tabular-nums">{formattaOre(minOggi)}</span>
        </div>
        {voci.length === 0 ? (
          <p className="text-sm text-fg-3">Ancora niente registrato oggi.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {voci.map(({ v, cliente, contratto }) => (
              <li key={v.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{v.descrizione ?? cliente}</span>
                  <span className="truncate text-xs text-fg-3">
                    {[v.descrizione ? cliente : null, contratto].filter(Boolean).join(" · ") ||
                      "Senza contratto"}
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{formattaOre(v.minuti)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

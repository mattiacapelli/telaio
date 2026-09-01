import Link from "next/link";
import { getProgetti } from "@/lib/queries";
import { titoloPagina } from "@/lib/titolo";
import { Card, CardHead } from "@/components/ui/card";
import { Stat, Vuoto, Barra } from "@/components/ui-legacy";
import { Badge } from "@/components/ui/badge";
import { eur, ore } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: await titoloPagina("Dashboard · PM") };
}

const STATI_ORDINE = ["DA_AVVIARE", "IN_CORSO", "IN_PAUSA", "CONCLUSO"] as const;

const STATI: Record<string, string> = {
  DA_AVVIARE: "Da avviare",
  IN_CORSO: "In corso",
  IN_PAUSA: "In pausa",
  CONCLUSO: "Concluso",
};

export default async function DashboardProgettiPage() {
  const progetti = await getProgetti();

  if (progetti.length === 0) {
    return <Vuoto titolo="Nessun progetto" nota="I dati di project management compariranno qui." />;
  }

  const attivi = progetti.filter((p) => p.stato === "IN_CORSO" || p.stato === "DA_AVVIARE");
  const totaleValore = progetti.reduce((s, p) => s + p.valore, 0);
  const totaleOreFatte = progetti.reduce((s, p) => s + p.oreFatte, 0);
  const totaleBudgetOre = progetti.reduce((s, p) => s + p.budgetOre, 0);
  const oltreBudget = progetti.filter((p) => p.oreFatte > p.budgetOre);

  const perStato = STATI_ORDINE.map((s) => ({
    stato: s,
    conteggio: progetti.filter((p) => p.stato === s).length,
  }));
  const maxStato = Math.max(...perStato.map((s) => s.conteggio), 1);

  return (
    <div className="tl-in flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etichetta="Progetti attivi" valore={String(attivi.length)} nota={`su ${progetti.length} totali`} />
        <Stat etichetta="Valore totale" valore={eur(totaleValore)} />
        <Stat etichetta="Ore fatte" valore={ore(totaleOreFatte)} nota={`su ${ore(totaleBudgetOre)} a budget`} />
        <Stat
          etichetta="Oltre budget"
          valore={String(oltreBudget.length)}
          nota={oltreBudget.length > 0 ? "richiede attenzione" : "nessuno"}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHead titolo="Per stato" />
          <div className="flex flex-col gap-2 p-3">
            {perStato.map((s) => (
              <div key={s.stato} className="flex items-center gap-2 text-md">
                <span className="w-24 flex-none text-muted">{STATI[s.stato]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(s.conteggio / maxStato) * 100}%` }}
                  />
                </div>
                <span className="w-8 flex-none text-right text-xs text-faint">{s.conteggio}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead
            titolo="Progetti oltre budget"
            extra={<Link href="/progetti" className="text-xs text-muted hover:text-text">Tutti</Link>}
          />
          {oltreBudget.length === 0 ? (
            <div className="px-3 py-6 text-center text-md text-faint">Nessun progetto oltre budget.</div>
          ) : (
            <div>
              {oltreBudget.map((p) => (
                <Link
                  key={p.id}
                  href={`/progetti/${p.id}`}
                  className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-[var(--alpha-lighter)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-md">{p.nome}</div>
                    <div className="text-xs text-faint">{p.cliente}</div>
                  </div>
                  <div className="w-24 flex-none">
                    <Barra valore={p.oreFatte} max={p.budgetOre} />
                  </div>
                  <Badge tono="attenzione">{ore(p.oreFatte)}/{ore(p.budgetOre)}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

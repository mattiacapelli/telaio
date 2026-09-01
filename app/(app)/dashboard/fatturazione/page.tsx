import Link from "next/link";
import { getIncassi, getFatture, getFattureDaIncassare } from "@/lib/queries";
import { titoloPagina } from "@/lib/titolo";
import { Card, CardHead } from "@/components/ui/card";
import { Stat, Vuoto } from "@/components/ui-legacy";
import { Badge } from "@/components/ui/badge";
import { eur, data } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: await titoloPagina("Dashboard · Fatturazione") };
}

const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const STATI: Record<string, string> = {
  DA_EMETTERE: "Da emettere",
  EMESSA: "Emessa",
  PAGATA: "Pagata",
  SCADUTA: "Scaduta",
};

export default async function DashboardFatturazionePage() {
  const [incassi, fatture, daIncassare] = await Promise.all([
    getIncassi(),
    getFatture(),
    getFattureDaIncassare(),
  ]);

  if (fatture.length === 0) {
    return <Vuoto titolo="Nessuna fattura" nota="I dati di fatturazione compariranno qui." />;
  }

  const perStato = (["DA_EMETTERE", "EMESSA", "PAGATA", "SCADUTA"] as const).map((s) => ({
    stato: s,
    conteggio: fatture.filter((f) => f.stato === s).length,
    imponibile: fatture.filter((f) => f.stato === s).reduce((sum, f) => sum + f.imponibile, 0),
  }));

  const finoA = new Date().getMonth();
  const mesi = incassi.mesi.slice(0, finoA + 1);
  const maxMese = Math.max(...mesi.flatMap((m) => [m.fatturato, m.incassato]), 1);
  const maxStato = Math.max(...perStato.map((s) => s.imponibile), 1);

  return (
    <div className="tl-in flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etichetta="Fatturato anno" valore={eur(incassi.emesso)} nota={`${fatture.length} fatture totali`} />
        <Stat etichetta="Incassato anno" valore={eur(incassi.incassato)} />
        <Stat etichetta="Da incassare" valore={eur(incassi.daIncassare)} nota={`${daIncassare.length} fatture`} />
        <Stat
          etichetta="Scaduto"
          valore={eur(incassi.scaduto)}
          nota={incassi.scaduto > 0 ? "richiede attenzione" : "nessuno scaduto"}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <Card className="min-w-0">
          <CardHead titolo="Fatturato vs incassato" />
          <div className="overflow-x-auto p-4">
            <div className="flex h-40 min-w-[360px] items-end gap-2">
              {mesi.map((m, i) => (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div className="flex h-36 w-full items-end justify-center gap-1">
                    <div
                      title={`Fatturato ${eur(m.fatturato)}`}
                      className="w-1/2 rounded-t bg-accent-line"
                      style={{ height: `${(m.fatturato / maxMese) * 100}%` }}
                    />
                    <div
                      title={`Incassato ${eur(m.incassato)}`}
                      className="w-1/2 rounded-t bg-accent"
                      style={{ height: `${(m.incassato / maxMese) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-faint">{MESI[i]}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-accent-line" />
                Fatturato
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-accent" />
                Incassato
              </span>
            </div>
          </div>
        </Card>

        <Card className="min-w-0">
          <CardHead titolo="Per stato" />
          <div className="flex flex-col gap-2 p-3">
            {perStato.map((s) => (
              <div key={s.stato} className="flex items-center gap-2 text-md">
                <span className="w-24 flex-none text-muted">{STATI[s.stato]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(s.imponibile / maxStato) * 100}%` }}
                  />
                </div>
                <span className="w-16 flex-none text-right text-xs text-faint">{s.conteggio}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead
          titolo="Fatture da incassare"
          extra={<Link href="/incassi" className="text-xs text-muted hover:text-text">Registra incasso</Link>}
        />
        {daIncassare.length === 0 ? (
          <div className="px-3 py-6 text-center text-md text-faint">Tutto incassato.</div>
        ) : (
          <div className="rounded-b">
            {daIncassare.map((f) => (
              <div key={f.id} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0">
                <span className="text-xs text-faint">{f.numero}</span>
                <span className="min-w-0 flex-1 truncate text-md">{f.cliente}</span>
                {f.scadeIl && <span className="text-xs text-faint">scade {data(f.scadeIl)}</span>}
                <Badge tono="attenzione">{eur(f.residuo)}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

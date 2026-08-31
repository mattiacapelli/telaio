import { getIncassi, getFattureDaIncassare } from "@/lib/queries";
import { titoloPagina } from "@/lib/titolo";
import { prisma } from "@/lib/prisma";
import { RegistraIncasso, EliminaIncasso } from "@/components/registra-incasso";
import { Card, CardHead } from "@/components/ui/card";
import { Stat, Vuoto } from "@/components/ui-legacy";
import { eur, data } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: await titoloPagina("Incassi") };
}

const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const METODI: Record<string, string> = {
  BONIFICO: "Bonifico",
  CARTA: "Carta",
  CONTANTI: "Contanti",
  ALTRO: "Altro",
};

export default async function IncassiPage() {
  const [d, daIncassare, conti] = await Promise.all([
    getIncassi(),
    getFattureDaIncassare(),
    prisma.contoIncasso.findMany({
      where: { eliminataIl: null },
      orderBy: [{ predefinito: "desc" }, { ordine: "asc" }, { nome: "asc" }],
      select: { id: true, nome: true, predefinito: true },
    }),
  ]);

  if (d.movimenti.length === 0) {
    return <Vuoto titolo="Nessun incasso" nota="I pagamenti ricevuti compariranno qui." />;
  }

  // Mostra i mesi fino a quello corrente: il grafico non anticipa il futuro.
  const finoA = new Date().getMonth();
  const mesi = d.mesi.slice(0, finoA + 1);
  const max = Math.max(...mesi.flatMap((m) => [m.fatturato, m.incassato]), 1);

  const anno = new Date().getFullYear();

  return (
    <div className="tl-in flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-md text-muted">
          {daIncassare.length} fatture da incassare
        </span>
        <div className="flex-1" />
        <RegistraIncasso fatture={daIncassare} conti={conti} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          etichetta={`Incassato ${anno}`}
          valore={eur(d.incassato)}
          nota={`su ${eur(d.emesso)} fatturati`}
        />
        <Stat
          etichetta="Da incassare"
          valore={eur(d.daIncassare)}
          nota={d.scaduto > 0 ? `di cui ${eur(d.scaduto)} scaduti` : "nessuno scaduto"}
        />
        <Stat
          etichetta="Pagamenti ricevuti"
          valore={String(d.movimenti.length)}
          nota={`nel ${anno}`}
        />
        <Stat
          etichetta="Incasso medio"
          valore={eur(d.incassato / d.movimenti.length)}
          nota="per pagamento"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-4">
        <Card className="min-w-0">
          <CardHead titolo="Fatturato vs incassato" />
          <div className="overflow-x-auto p-4">
            <div className="flex h-44 min-w-[420px] items-end gap-2">
              {mesi.map((m, i) => (
                <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div className="flex h-40 w-full items-end justify-center gap-1">
                    <div
                      title={`Fatturato ${eur(m.fatturato)}`}
                      className="w-1/2 rounded-t bg-accent-line"
                      style={{ height: `${(m.fatturato / max) * 100}%` }}
                    />
                    <div
                      title={`Incassato ${eur(m.incassato)}`}
                      className="w-1/2 rounded-t bg-accent"
                      style={{ height: `${(m.incassato / max) * 100}%` }}
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
          <CardHead titolo="Per conto" />
          <div className="p-2">
            {d.perConto.length === 0 ? (
              <div className="px-2 py-4 text-center text-md text-faint">
                Nessun incasso registrato.
              </div>
            ) : (
              d.perConto.map((c) => (
                <div key={c.nome} className="flex items-center gap-2 px-2 py-1.5 text-md">
                  <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                  <span className="font-medium">{eur(c.importo)}</span>
                </div>
              ))
            )}
          </div>
        </Card>
        </div>

        <Card className="min-w-0">
          <CardHead titolo="Pagamenti ricevuti" />
          <div className="overflow-x-auto">
            <div className="min-w-[560px]">
              <div className="grid grid-cols-[60px_2fr_1fr_1fr_24px] gap-2 border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-faint">
                <span>Data</span>
                <span>Fattura / cliente</span>
                <span>Metodo</span>
                <span className="text-right">Importo</span>
                <span />
              </div>
              {d.movimenti.map((m) => (
                <div
                  key={m.id}
                  className="group grid grid-cols-[60px_2fr_1fr_1fr_24px] items-center gap-2 border-b border-border px-3 py-2 last:border-0"
                >
                  <span className="text-md text-muted">{data(m.data)}</span>
                  <div className="min-w-0">
                    <div className="truncate text-md">
                      {m.fattura} · {m.cliente}
                    </div>
                    {(m.conto || m.nota) && (
                      <div className="truncate text-xs text-faint">
                        {[m.conto, m.nota].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  <span className="text-md text-muted">{METODI[m.metodo]}</span>
                  <span className="text-right text-md font-medium">
                    {eur(m.importo)}
                  </span>
                  <EliminaIncasso id={m.id} />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

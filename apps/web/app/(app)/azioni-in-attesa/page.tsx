import { desc, getDb, pendingActions } from "@telaio/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { decidiAzione } from "./actions";

export const metadata = { title: "Azioni in attesa" };
export const dynamic = "force-dynamic";

const TONI = { in_attesa: "orange", confermata: "green", rifiutata: "ink", fallita: "orange" } as const;
const ETICHETTE = { in_attesa: "In attesa", confermata: "Confermata", rifiutata: "Rifiutata", fallita: "Fallita" } as const;

export default async function AzioniInAttesaPage() {
  const azioni = await getDb().select().from(pendingActions).orderBy(desc(pendingActions.createdAt)).limit(50);
  const inAttesa = azioni.filter((a) => a.stato === "in_attesa");
  const storico = azioni.filter((a) => a.stato !== "in_attesa");

  return (
    <>
      <PageHeader
        numero="05"
        sezione="Commerciale"
        titolo="Azioni in attesa"
        descrizione="Quello che un assistente AI propone di fare. Nulla viene eseguito finché non confermi."
      />
      {inAttesa.length === 0 ? (
        <EmptyState title="Niente da confermare">Quando un assistente collegato via MCP propone una scrittura, la trovi qui.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {inAttesa.map((a) => (
            <Card key={a.id} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">{a.origine}</p>
                  <h2 className="font-mono text-lg font-semibold">{a.tipo}</h2>
                </div>
                <Tag tone="orange">In attesa</Tag>
              </div>
              <pre className="overflow-x-auto rounded-2xl bg-paper-2 p-4 text-xs">{JSON.stringify(a.payload, null, 2)}</pre>
              <form action={decidiAzione} className="flex justify-end gap-3">
                <input type="hidden" name="id" value={a.id} />
                <Button type="submit" name="decisione" value="rifiuta" variant="ghost">Rifiuta</Button>
                <Button type="submit" name="decisione" value="conferma">Conferma ed esegui</Button>
              </form>
            </Card>
          ))}
        </div>
      )}
      {storico.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-semibold">Storico</h2>
          <Card className="p-2 sm:p-3">
            <ul>
              {storico.map((a) => {
                const risultato = a.risultato as { id?: string } | null;
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-grey-2/60 px-3 py-3 text-sm last:border-b-0">
                    <span className="font-mono">{a.tipo}</span>
                    <span className="flex items-center gap-3">
                      {a.errore && <span className="text-orange-2">{a.errore}</span>}
                      {a.tipo === "crea_preventivo" && risultato?.id && (
                        <Link className="text-blue underline-offset-4 hover:underline" href={`/preventivi/${risultato.id}`}>Apri preventivo</Link>
                      )}
                      <Tag tone={TONI[a.stato]}>{ETICHETTE[a.stato]}</Tag>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}
    </>
  );
}

import { twentyDaEnv } from "@telaio/twenty";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";

export const metadata = { title: "Clienti" };
export const dynamic = "force-dynamic";

export default async function ClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const twenty = twentyDaEnv();
  let errore: string | null = null;
  const clienti = await twenty.elencaClienti({ testo: q }).catch((e: Error) => {
    errore = e.message;
    return [];
  });

  return (
    <>
      <PageHeader
        numero="01"
        sezione="Commerciale"
        titolo="Clienti"
        descrizione="Le anagrafiche arrivano da Twenty CRM e non vengono duplicate."
        azione={
          twenty.finto ? (
            <Tag tone="orange">Dati finti · imposta TWENTY_API_URL</Tag>
          ) : (
            <Tag tone="blue">Twenty collegato</Tag>
          )
        }
      />
      <form className="mb-6 max-w-md" role="search">
        <Input name="q" defaultValue={q} placeholder="Cerca per nome…" aria-label="Cerca clienti" />
      </form>
      {errore && (
        <p role="alert" className="mb-4 rounded-2xl bg-orange/10 px-4 py-3 text-sm text-orange-2">
          Twenty non risponde: {errore}
        </p>
      )}
      {clienti.length === 0 ? (
        <EmptyState title="Nessun cliente trovato">Prova un altro termine di ricerca.</EmptyState>
      ) : (
        <Card className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">P.IVA / CF</th>
                <th className="px-4 py-3 font-medium">Città</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {clienti.map((c) => (
                <tr key={c.id} className="border-t border-grey-2/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/clienti/${c.id}`}
                      className="inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline"
                    >
                      {c.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-2">
                    {c.partitaIva ?? c.codiceFiscale ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-2">{c.citta ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c.pa ? <Tag tone="blue">PA</Tag> : <Tag>Privato / impresa</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

import { formatEuro } from "@telaio/core";
import { twentyDaEnv } from "@telaio/twenty";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";

export const dynamic = "force-dynamic";

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const twenty = twentyDaEnv();
  const cliente = await twenty.dettaglioCliente(id).catch(() => null);
  if (!cliente) notFound();
  const [persone, opportunita] = await Promise.all([
    twenty.elencaPersone(id).catch(() => []),
    twenty.elencaOpportunita(id).catch(() => []),
  ]);

  const dati: [string, string | null][] = [
    ["Partita IVA", cliente.partitaIva],
    ["Codice fiscale", cliente.codiceFiscale],
    ["PEC", cliente.pec],
    ["Codice SDI", cliente.codiceSdi],
    ["Città", cliente.citta],
    ["Sito", cliente.sito],
  ];

  return (
    <>
      <PageHeader
        numero="02"
        sezione="Clienti"
        titolo={cliente.nome}
        descrizione={
          cliente.pa ? "Pubblica amministrazione: split payment applicabile." : undefined
        }
        azione={
          <Button asChild>
            <Link href={`/configuratore?cliente=${cliente.id}`}>Nuovo preventivo</Link>
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-semibold">Anagrafica</h2>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {dati.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="tabular-nums">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <h2 className="font-display text-xl font-semibold">Persone</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            {persone.length === 0 && <li className="text-muted">Nessuna persona collegata.</li>}
            {persone.map((p) => (
              <li key={p.id}>
                <p className="font-medium">{p.nome}</p>
                <p className="text-muted">
                  {[p.ruolo, p.email, p.telefono].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-display text-xl font-semibold">Opportunità</h2>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            {opportunita.length === 0 && <li className="text-muted">Nessuna opportunità.</li>}
            {opportunita.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{o.nome}</span>
                <span className="flex items-center gap-3">
                  {o.importoCent !== null && (
                    <span className="money tabular-nums">{formatEuro(o.importoCent)}</span>
                  )}
                  <Tag tone="blue">{o.fase ?? "—"}</Tag>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

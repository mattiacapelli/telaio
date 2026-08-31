import Link from "next/link";
import { notFound } from "next/navigation";
import { getProdottoCompleto, getClientiPerSelezione, getContrattiPerSelezione } from "@/lib/queries";
import { titoloPagina, nomeRecord } from "@/lib/titolo";
import { Badge } from "@/components/ui/badge";
import { Chip, coloreDa } from "@/components/chip";
import { EliminaRecord } from "@/components/elimina-record";
import { SezioneCampi, CampoRecord } from "@/components/record/pannello";
import { NuovaLicenza } from "@/components/nuova-licenza";
import { StatoLicenza } from "@/components/stato-licenza";
import { eur, data } from "@/lib/format";
import { Package, FolderKanban, Euro } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const nome = await nomeRecord("prodotto", id);
  return { title: await titoloPagina(nome ?? "Prodotto") };
}

export default async function ProdottoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [p, clienti, contratti] = await Promise.all([
    getProdottoCompleto(id),
    getClientiPerSelezione(),
    getContrattiPerSelezione(),
  ]);
  if (!p) notFound();

  return (
    <div className="tl-in flex flex-col overflow-hidden rounded border border-border md:h-[calc(100vh-96px)] md:flex-row">
      <aside className="flex w-full flex-none flex-col overflow-y-auto border-b border-border bg-surface md:w-[300px] md:border-b-0 md:border-r">
        <div className="flex flex-col items-center gap-2 px-3 py-5">
          <div
            className="grid h-12 w-12 place-items-center rounded-md text-md font-semibold"
            style={{ background: `${coloreDa(p.nome)}26`, color: coloreDa(p.nome) }}
          >
            {p.nome.trim()[0]?.toUpperCase() ?? "P"}
          </div>
          <div className="text-center">
            <h1 className="text-md font-semibold">{p.nome}</h1>
            <div className="mt-0.5 text-xs text-faint">
              {p.licenze.length} licenz{p.licenze.length === 1 ? "a" : "e"}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <EliminaRecord
              entita="prodotto"
              id={p.id}
              nome={p.nome}
              dopoRedirect="/prodotti"
              size="sm"
            />
          </div>
        </div>

        <div className="px-3 pb-1 text-md font-medium">Campi</div>

        <SezioneCampi titolo="Generale">
          <CampoRecord icona={<Package size={12} />} etichetta="Descrizione" vuoto="Non specificata">
            {p.descrizione}
          </CampoRecord>
          <CampoRecord icona={<Euro size={12} />} etichetta="Prezzo listino" vuoto="Non specificato">
            {p.prezzoListino !== null && eur(p.prezzoListino)}
          </CampoRecord>
          <CampoRecord icona={<FolderKanban size={12} />} etichetta="Progetto" vuoto="Nessuno">
            {p.progetto && (
              <Link href={`/progetti/${p.progetto.id}`} className="truncate hover:underline">
                {p.progetto.nome}
              </Link>
            )}
          </CampoRecord>
        </SezioneCampi>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="text-md font-medium">Licenze</span>
          <div className="flex-1" />
          <NuovaLicenza prodottoId={p.id} clienti={clienti} contratti={contratti} />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {p.licenze.length === 0 ? (
            <div className="rounded border border-border px-3 py-6 text-center text-md text-faint">
              Nessuna licenza attivata per questo prodotto.
            </div>
          ) : (
            <div className="rounded border border-border">
              {p.licenze.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0"
                >
                  <Link
                    href={`/clienti/${l.cliente.id}`}
                    className="flex min-w-0 flex-1 items-center gap-1.5 hover:underline"
                  >
                    <Chip testo={l.cliente.ragioneSociale} />
                    <span className="truncate text-md">{l.cliente.ragioneSociale}</span>
                  </Link>
                  {l.contratto && (
                    <Link href={`/contratti/${l.contratto.id}`} className="flex-none">
                      <Badge>{l.contratto.numero}</Badge>
                    </Link>
                  )}
                  <span className="w-24 flex-none text-xs text-faint">
                    dal {data(l.attivataIl)}
                  </span>
                  <span className="w-24 flex-none text-xs text-faint">
                    {l.scadeIl ? `scade ${data(l.scadeIl)}` : "senza scadenza"}
                  </span>
                  <span className="w-20 flex-none text-right text-md">
                    {l.canone !== null ? eur(l.canone) : "—"}
                  </span>
                  <div className="flex-none">
                    <StatoLicenza id={l.id} stato={l.stato} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

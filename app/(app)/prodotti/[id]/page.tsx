import Link from "next/link";
import { notFound } from "next/navigation";
import { getProdottoCompleto, getClientiPerSelezione, getContrattiPerSelezione } from "@/lib/queries";
import { titoloPagina, nomeRecord } from "@/lib/titolo";
import { Badge } from "@/components/ui/badge";
import { Chip, coloreDa } from "@/components/chip";
import { EliminaRecord } from "@/components/elimina-record";
import { SezioneCampi, CampoRecord, Schede } from "@/components/record/pannello";
import { NuovaLicenza } from "@/components/nuova-licenza";
import { NuovoPiano } from "@/components/nuovo-piano";
import { StatoLicenza } from "@/components/stato-licenza";
import { DocumentiProgetto } from "@/components/documenti-progetto";
import { ModalitaLicenzaProdotto } from "@/components/modalita-licenza-prodotto";
import { ChiaveMasterProdotto } from "@/components/chiave-master-prodotto";
import { GeneraFileLicenza } from "@/components/genera-file-licenza";
import { eur, ore, data } from "@/lib/format";
import { PERIODICITA } from "@/lib/contratti";
import { Package, FolderKanban, Euro, Users, Layers, Paperclip, ShieldCheck } from "lucide-react";

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
              {p.licenze.length} licenz{p.licenze.length === 1 ? "a" : "e"} · {p.piani.length} pian{p.piani.length === 1 ? "o" : "i"}
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
          <CampoRecord icona={<ShieldCheck size={12} />} etichetta="Licenza">
            <ModalitaLicenzaProdotto id={p.id} modalita={p.modalitaLicenza} />
          </CampoRecord>
        </SezioneCampi>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
        <Schede
          schede={[
            {
              chiave: "licenze",
              etichetta: "Licenze",
              icona: <Users size={13} />,
              conteggio: p.licenze.length,
              contenuto: (
                <div className="p-4">
                  {(p.modalitaLicenza === "OFFLINE" || p.modalitaLicenza === "ENTRAMBE") && (
                    <div className="mb-3">
                      <ChiaveMasterProdotto
                        prodottoId={p.id}
                        chiavePubblicaMaster={p.chiavePubblicaMaster}
                        chiaveMasterGenerataIl={p.chiaveMasterGenerataIl?.toString() ?? null}
                      />
                    </div>
                  )}
                  <div className="mb-3 flex items-center justify-end">
                    <NuovaLicenza prodottoId={p.id} clienti={clienti} contratti={contratti} piani={p.piani} />
                  </div>
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
                          {l.piano && <Badge>{l.piano.nome}</Badge>}
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
                          <span className="w-32 flex-none text-xs text-faint">
                            {l.fileLicenzaGeneratoIl
                              ? `file generato il ${data(l.fileLicenzaGeneratoIl)}`
                              : "nessun file generato"}
                          </span>
                          <div className="flex-none">
                            <StatoLicenza id={l.id} stato={l.stato} />
                          </div>
                          {(p.modalitaLicenza === "OFFLINE" || p.modalitaLicenza === "ENTRAMBE") &&
                            p.chiavePubblicaMaster && (
                              <GeneraFileLicenza licenzaId={l.id} />
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            {
              chiave: "piani",
              etichetta: "Piani",
              icona: <Layers size={13} />,
              conteggio: p.piani.length,
              contenuto: (
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-end">
                    <NuovoPiano prodottoId={p.id} />
                  </div>
                  {p.piani.length === 0 ? (
                    <div className="rounded border border-border px-3 py-6 text-center text-md text-faint">
                      Nessun piano configurato: le licenze usano un canone libero.
                    </div>
                  ) : (
                    <div className="rounded border border-border">
                      {p.piani.map((piano) => (
                        <div
                          key={piano.id}
                          className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-md font-medium">{piano.nome}</div>
                            {piano.descrizione && (
                              <div className="truncate text-xs text-faint">{piano.descrizione}</div>
                            )}
                          </div>
                          {piano.monteOre !== null && (
                            <span className="text-xs text-faint">{ore(piano.monteOre)} incluse</span>
                          )}
                          <span className="text-xs text-faint">{piano.terminiPagamento} gg pagamento</span>
                          <div className="w-28 flex-none text-right">
                            <div className="text-md font-medium">{eur(piano.canone)}</div>
                            <div className="text-xs text-faint">{PERIODICITA[piano.periodicita]}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            {
              chiave: "documenti",
              etichetta: "Documenti",
              icona: <Paperclip size={13} />,
              conteggio: p.documenti.length,
              contenuto: (
                <DocumentiProgetto progettoId={p.id} entita="prodotti" documenti={p.documenti} />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

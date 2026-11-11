import {
  formatEuro,
  formatEuroCompatto,
  prezzoVisualizzato,
  type RegoleFiscali,
  staAccettato,
} from "@telaio/core";
import {
  allegatiDelCliente,
  clientiRef,
  conti,
  desc,
  eq,
  getDb,
  incassi,
  preventivi,
  ragioniSociali,
  sql,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import { ExternalLink, Folder } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AllegaDocumenti } from "@/components/domain/allega-documenti";
import { ElencoDocumenti, rigaDocumento } from "@/components/domain/elenco-documenti";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DefList } from "@/components/ui/def-list";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { Table, Td, Th } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { leggiArchivio } from "@/lib/archivio/config";
import { formatData } from "@/lib/date";
import { sqlCanoneAnnuo, sqlUnaTantum } from "@/lib/queries";
import { STATO_PREVENTIVO } from "@/lib/stati";

export const metadata = { title: "Cliente" };
export const dynamic = "force-dynamic";

const FASI = ["Nuovo lead", "Qualificato", "Proposta inviata", "Negoziazione", "Vinto"];
const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/_/g, " ");
const NOME_CONTO = { bonifico: "Bonifico", contante: "Contante", carta: "Carta" } as const;

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const twenty = twentyDaEnv();
  const cliente = await twenty.dettaglioCliente(id).catch(() => null);
  if (!cliente) notFound();
  const db = getDb();
  const [persone, opportunita, [ref]] = await Promise.all([
    twenty.elencaPersone(id).catch(() => []),
    twenty.elencaOpportunita(id).catch(() => []),
    db.select().from(clientiRef).where(eq(clientiRef.twentyCompanyId, id)),
  ]);
  const refId = ref?.id ?? "00000000-0000-0000-0000-000000000000";
  const [prev, versati, somme, allegati, archivio] = await Promise.all([
    db
      .select({
        p: preventivi,
        emittente: ragioniSociali.nome,
        unaTantum: sqlUnaTantum,
        canone: sqlCanoneAnnuo,
      })
      .from(preventivi)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, preventivi.ragioneSocialeId))
      .where(sql`${preventivi.clienteRefId} = ${refId} and ${preventivi.deletedAt} is null`)
      .orderBy(desc(preventivi.dataPreventivo), desc(preventivi.createdAt)),
    db
      .select({ i: incassi, conto: conti.nome, tipo: conti.tipo })
      .from(incassi)
      .innerJoin(conti, eq(conti.id, incassi.contoId))
      .where(sql`${incassi.clienteRefId} = ${refId} and ${incassi.deletedAt} is null`)
      .orderBy(desc(incassi.data)),
    db.execute<{ da_incassare: number; canoni: number }>(sql`
      select coalesce((select sum(r.importo_cent - coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = r.id and i.deleted_at is null),0)) from rate r where r.cliente_ref_id = ${refId} and r.stato in ('da_incassare','parziale','scaduta')),0)::int da_incassare,
             coalesce((select sum(a.importo_rata_cent * (case a.periodicita when 'mensile' then 12 when 'trimestrale' then 4 when 'semestrale' then 2 else 1 end)) from abbonamenti a where a.cliente_ref_id = ${refId} and a.stato = 'attivo' and a.deleted_at is null),0)::int canoni`),
    ref ? allegatiDelCliente(db, ref.id) : Promise.resolve([]),
    leggiArchivio(db),
  ]);

  // Allegati del cliente: i suoi, una «cartella» per ogni progetto, e tutti quelli dei preventivi insieme.
  const diretti = allegati.filter((a) => !a.progetto && !a.preventivo);
  const dePreventivi = allegati.filter((a) => a.preventivo);
  const cartelle = new Map<string, { codice: string; nome: string; righe: typeof allegati }>();
  for (const a of allegati) {
    if (!a.progetto) continue;
    const c = cartelle.get(a.progetto.id) ?? { ...a.progetto, righe: [] };
    c.righe.push(a);
    cartelle.set(a.progetto.id, c);
  }

  const preventivato = prev
    .filter(({ p }) => p.stato !== "bozza")
    .reduce((s, { p }) => s + p.imponibileCent, 0);
  const accettato = prev
    .filter(({ p }) => staAccettato(p.stato))
    .reduce((s, { p }) => s + (p.imponibileAccettatoCent ?? p.imponibileCent), 0);
  const incassato = versati.reduce((s, { i }) => s + i.importoCent, 0);
  const opp = opportunita[0];
  const faseIdx = opp ? FASI.findIndex((f) => norm(f) === norm(opp.fase)) : -1;

  return (
    <>
      <PageHeader
        titolo={cliente.nome}
        descrizione={
          [cliente.citta, cliente.pa ? "Pubblica amministrazione" : null]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        stato={
          <Badge variant={ref ? "ok" : "brand"} dot>
            {ref ? "Cliente" : "Prospect"}
          </Badge>
        }
        azioni={
          <>
            {cliente.sito && (
              <Button asChild variant="secondary">
                <a
                  href={cliente.sito.startsWith("http") ? cliente.sito : `https://${cliente.sito}`}
                >
                  Sito <ExternalLink />
                </a>
              </Button>
            )}
            <Button asChild variant="secondary">
              <Link href="/incassi">Registra incasso</Link>
            </Button>
            <Button asChild>
              <Link href={`/preventivi/nuovo?cliente=${cliente.id}`}>Nuovo preventivo</Link>
            </Button>
          </>
        }
      />

      <StatsRow
        dati={[
          { etichetta: "Preventivato", valore: formatEuroCompatto(preventivato) },
          { etichetta: "Accettato", valore: formatEuroCompatto(accettato) },
          { etichetta: "Incassato", valore: formatEuroCompatto(incassato) },
          { etichetta: "Da incassare", valore: formatEuroCompatto(somme[0]?.da_incassare ?? 0) },
          {
            etichetta: "Canoni attivi",
            valore: (
              <>
                {formatEuroCompatto(somme[0]?.canoni ?? 0)}
                <span className="text-sm font-normal text-fg-2">/anno</span>
              </>
            ),
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Anagrafica" description="Sola lettura · Twenty" />
          <DefList
            voci={[
              { etichetta: "Ragione sociale", valore: cliente.nome },
              { etichetta: "P.IVA", valore: cliente.partitaIva ?? "—", numerico: true },
              { etichetta: "Codice fiscale", valore: cliente.codiceFiscale ?? "—", numerico: true },
              { etichetta: "PEC", valore: cliente.pec ?? "—" },
              { etichetta: "Codice SDI", valore: cliente.codiceSdi ?? "—", numerico: true },
              { etichetta: "Sede", valore: cliente.citta ?? "—" },
            ]}
          />
        </Card>

        <Card>
          <CardHeader
            title="Contatti"
            description={`${persone.length} person${persone.length === 1 ? "a" : "e"}`}
          />
          {persone.length === 0 ? (
            <p className="text-sm text-fg-2">Nessuna persona collegata.</p>
          ) : (
            <ul className="divide-y divide-line">
              {persone.map((p) => (
                <li key={p.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <Avatar name={p.nome} />
                  <div className="flex min-w-0 flex-col text-sm leading-snug">
                    <span className="font-medium">{p.nome}</span>
                    {p.ruolo && <span className="text-xs text-fg-3">{p.ruolo}</span>}
                    {p.email && <span className="truncate text-fg-2">{p.email}</span>}
                    {p.telefono && <span className="text-fg-2 tabular-nums">{p.telefono}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Opportunità" description="Da Twenty" />
          {opp ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium">{opp.nome}</p>
                {opp.importoCent !== null && (
                  <p className="text-xl font-semibold tracking-tight tabular-nums">
                    {formatEuroCompatto(opp.importoCent)}
                  </p>
                )}
              </div>
              <ol className="flex flex-col text-sm">
                {FASI.map((f, i) => (
                  <li
                    key={f}
                    className={`flex items-center gap-2.5 py-1 ${i === faseIdx ? "font-medium text-fg" : "text-fg-3"}`}
                  >
                    <i
                      className={`size-2 rounded-full ${i === faseIdx ? "bg-brand ring-4 ring-brand/15" : i < faseIdx ? "bg-fg-3" : "border border-line-strong"}`}
                    />
                    {f}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-sm text-fg-2">Nessuna opportunità aperta su Twenty.</p>
          )}
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Preventivi</h2>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/preventivi/nuovo?cliente=${cliente.id}`}>Nuovo</Link>
          </Button>
        </div>
        {prev.length === 0 ? (
          <p className="text-sm text-fg-2">Nessun preventivo per questo cliente.</p>
        ) : (
          <Table minLarghezza={620}>
            <thead>
              <tr>
                <Th>Numero</Th>
                <Th>Oggetto</Th>
                <Th>Emittente</Th>
                <Th destra>Una tantum netto</Th>
                <Th destra>Canone netto</Th>
                <Th>Stato</Th>
                <Th>Data</Th>
              </tr>
            </thead>
            <tbody>
              {prev.map(({ p, emittente, unaTantum, canone }) => {
                const regole = p.snapshot.regole as unknown as RegoleFiscali;
                const ut = prezzoVisualizzato(unaTantum, regole);
                const cn = prezzoVisualizzato(canone, regole);
                const s = STATO_PREVENTIVO[p.stato];
                return (
                  <tr key={p.id} className="group">
                    <Td>
                      <Link href={`/preventivi/${p.id}`} className="font-medium hover:underline">
                        {p.numero ?? "Bozza"}
                      </Link>
                    </Td>
                    <Td>{p.oggetto}</Td>
                    <Td className="text-fg-2">{emittente}</Td>
                    <Td destra>{unaTantum > 0 ? formatEuro(ut.nettoCent) : "—"}</Td>
                    <Td destra>{canone > 0 ? `${formatEuro(cn.nettoCent)}/a` : "—"}</Td>
                    <Td>
                      <Tag tone={s?.tone}>{s?.label ?? p.stato}</Tag>
                    </Td>
                    <Td className="tabular-nums text-fg-2">{formatData(p.dataPreventivo)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="titolo-documenti">
        <h2 id="titolo-documenti" className="text-base font-semibold">
          Documenti
        </h2>
        {!ref ? (
          <p className="text-sm text-fg-2">
            Potrai allegare file e link dopo il primo preventivo o progetto di questo cliente.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Del cliente"
                description="Contratti quadro, anagrafiche, materiali non legati a un lavoro."
              />
              <div className="flex flex-col gap-4">
                {diretti.length > 0 ? (
                  <ElencoDocumenti
                    documenti={diretti.map(({ d, caricatoDa }) => rigaDocumento(d, caricatoDa))}
                  />
                ) : (
                  <p className="text-sm text-fg-2">Nessun allegato.</p>
                )}
                <AllegaDocumenti
                  destinazione={{ clienteRefId: ref.id }}
                  configurato={!!archivio.config}
                />
              </div>
            </Card>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader
                  title="Progetti"
                  description="Una cartella per progetto: si allega dalla pagina del progetto."
                />
                {cartelle.size === 0 ? (
                  <p className="text-sm text-fg-2">Nessun file nei progetti di questo cliente.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {[...cartelle.entries()].map(([pid, c]) => (
                      <li key={pid}>
                        <details
                          open={cartelle.size <= 3}
                          className="group rounded-md border border-line"
                        >
                          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium select-none hover:bg-hover">
                            <Folder className="size-4 text-fg-3" aria-hidden />
                            <span className="min-w-0 flex-1 truncate">
                              <span className="tabular-nums">{c.codice}</span> · {c.nome}
                            </span>
                            <Badge>{c.righe.length}</Badge>
                          </summary>
                          <div className="border-t border-line px-3">
                            <ElencoDocumenti
                              documenti={c.righe.map(({ d, caricatoDa }) =>
                                rigaDocumento(d, caricatoDa),
                              )}
                            />
                            <Link
                              href={`/progetti/${pid}`}
                              className="inline-block pb-3 text-xs text-fg-2 hover:underline"
                            >
                              Apri il progetto
                            </Link>
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Preventivi"
                  description="Gli allegati di tutti i preventivi, insieme."
                />
                {dePreventivi.length === 0 ? (
                  <p className="text-sm text-fg-2">Nessun allegato nei preventivi.</p>
                ) : (
                  <ElencoDocumenti
                    documenti={dePreventivi.map(({ d, caricatoDa, preventivo }) =>
                      rigaDocumento(d, caricatoDa, {
                        origine: preventivo && {
                          etichetta: preventivo.numero ?? "Bozza",
                          href: `/preventivi/${preventivo.id}`,
                        },
                      }),
                    )}
                  />
                )}
              </Card>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Incassi</h2>
          <Button asChild variant="secondary" size="sm">
            <Link href="/incassi">Registra incasso</Link>
          </Button>
        </div>
        {versati.length === 0 ? (
          <p className="text-sm text-fg-2">Nessun incasso registrato.</p>
        ) : (
          <Table minLarghezza={560}>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Causale</Th>
                <Th>Conto</Th>
                <Th>Metodo</Th>
                <Th destra>Importo</Th>
              </tr>
            </thead>
            <tbody>
              {versati.map(({ i, conto, tipo }) => (
                <tr key={i.id} className="group">
                  <Td className="tabular-nums">{formatData(i.data)}</Td>
                  <Td>{i.descrizione ?? "Incasso"}</Td>
                  <Td className="text-fg-2">{conto}</Td>
                  <Td>
                    <Badge dot>{NOME_CONTO[tipo]}</Badge>
                  </Td>
                  <Td destra className="font-medium">
                    {formatEuro(i.importoCent)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </>
  );
}

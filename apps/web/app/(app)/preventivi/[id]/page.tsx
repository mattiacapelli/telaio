import {
  ETICHETTA_PERIODO,
  formatAliquota,
  formatEuro,
  formattaNumero,
  nomeServizio,
  prezzoVisualizzato,
  type RegoleFiscali,
  type RigaDecisione,
  type StatoPreventivo,
  serviziRicorrenti,
  staAccettato,
  transizioniPreventivo,
  valoreRicorrenteAnnuo,
} from "@telaio/core";
import {
  abbonamenti,
  and,
  asc,
  eq,
  fatture,
  getDb,
  isNull,
  preventivi,
  preventivoRighe,
  progettiDelPreventivo,
  ragioniSociali,
} from "@telaio/db";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { creaFatturaDaPreventivoAction } from "@/app/(app)/fatture/actions";
import { CreaProgettoDaPreventivo } from "@/app/(app)/progetti/crea-da-preventivo";
import { AccettaPreventivo } from "@/components/domain/accetta-preventivo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DefList } from "@/components/ui/def-list";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { formatData, oggi } from "@/lib/date";
import { STATO_PREVENTIVO, STATO_PROGETTO } from "@/lib/stati";
import { cambiaStatoPreventivoAction } from "./actions";

export const metadata = { title: "Preventivo" };
export const dynamic = "force-dynamic";

const AZIONE_STATO: Record<string, string> = {
  inviato: "Segna come inviato",
  in_revisione: "Metti in revisione",
  rifiutato: "Segna come rifiutato",
  scaduto: "Segna come scaduto",
};

/** Stile di una riga non accettata: testo e importi barrati, in rosso. */
const ESCLUSA = "text-bad line-through decoration-bad/60";

export default async function PreventivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [p] = await db.select().from(preventivi).where(eq(preventivi.id, id));
  if (!p) notFound();
  const [righe, [rs], progettiCollegati, [fattura], abbonamentiCreati] = await Promise.all([
    db
      .select()
      .from(preventivoRighe)
      .where(eq(preventivoRighe.preventivoId, id))
      .orderBy(asc(preventivoRighe.posizione)),
    db.select().from(ragioniSociali).where(eq(ragioniSociali.id, p.ragioneSocialeId)),
    progettiDelPreventivo(db, id),
    db
      .select({ id: fatture.id, numero: fatture.numero })
      .from(fatture)
      .where(
        and(
          eq(fatture.preventivoId, id),
          eq(fatture.origine, "preventivo"),
          isNull(fatture.deletedAt),
        ),
      ),
    db
      .select({ id: abbonamenti.id, rigaId: abbonamenti.preventivoRigaId })
      .from(abbonamenti)
      .where(and(eq(abbonamenti.preventivoId, id), isNull(abbonamenti.deletedAt))),
  ]);

  const regole = p.snapshot.regole as unknown as RegoleFiscali;
  const cliente = p.snapshot.cliente as {
    nome?: string;
    partitaIva?: string;
    codiceSdi?: string;
    citta?: string;
  };
  const stato = STATO_PREVENTIVO[p.stato];
  const accettato = staAccettato(p.stato);
  const decisioni = righe.some((r) => r.accettata !== null);
  const iva = regole.ivaAttiva ? `IVA ${formatAliquota(regole.aliquotaIvaBp)}` : "Senza IVA";
  const transizioni = transizioniPreventivo(p.stato as StatoPreventivo).filter(
    (s) => s !== "accettato" && s !== "accettato_parzialmente",
  );
  const puoAccettare = p.stato === "inviato" || p.stato === "in_revisione";
  const abbonamentoDellaRiga = new Map(abbonamentiCreati.map((a) => [a.rigaId, a.id]));

  const comeDecisione = (
    r: (typeof righe)[number],
  ): RigaDecisione & { accettata: boolean | null; descrizione: string } => ({
    id: r.id,
    tipo: r.tipo,
    quantita: r.quantita,
    prezzoUnitarioCent: r.prezzoUnitarioCent,
    scontoBp: r.scontoBp,
    gruppoAlternativaId: r.gruppoAlternativaId,
    accettata: r.accettata,
    descrizione: r.descrizione,
  });
  const dec = righe.map(comeDecisione);
  const unaTantum = righe.filter((r) => r.tipo === "una_tantum");
  const ricorrenti = righe.filter((r) => r.tipo !== "una_tantum");
  const servizi = serviziRicorrenti(dec);
  const accettateUnaTantum = unaTantum.filter((r) => r.accettata === true);
  const puoFatturare = accettato && accettateUnaTantum.length > 0 && !fattura;
  // Un progetto nasce da un preventivo accettato (anche in parte) con almeno una prestazione accettata.
  const puoCreareProgetto = accettato && righe.some((r) => r.accettata === true);
  const valoreAnnuo = valoreRicorrenteAnnuo(dec, accettato);

  /** Etichetta e stile dell'esito di una riga, tenendo conto delle alternative. */
  function esito(r: (typeof righe)[number]): {
    testo: string;
    escluso: boolean;
    variante: "ok" | "bad" | "neutral" | "brand";
  } {
    if (r.accettata === true) return { testo: "Accettata", escluso: false, variante: "ok" };
    if (r.accettata === false) {
      const altraScelta =
        r.gruppoAlternativaId &&
        righe.some((x) => x.gruppoAlternativaId === r.gruppoAlternativaId && x.accettata === true);
      return {
        testo: altraScelta ? "Alternativa non scelta" : "Non accettata",
        escluso: true,
        variante: "bad",
      };
    }
    if (r.gruppoAlternativaId) return { testo: "Alternativa", escluso: false, variante: "brand" };
    return { testo: accettato ? "—" : "In attesa", escluso: false, variante: "neutral" };
  }

  const cellaImporto = (cent: number, escluso: boolean, mostraLordo = true) => {
    const v = prezzoVisualizzato(cent, regole);
    return (
      <div className="flex flex-col items-end leading-tight">
        <span className={escluso ? `font-medium ${ESCLUSA}` : "font-medium"}>
          {formatEuro(cent)}
        </span>
        {mostraLordo && v.lordoCent !== null && (
          <span className={escluso ? `text-xs ${ESCLUSA}` : "text-xs text-fg-3"}>
            {formatEuro(v.lordoCent)} ivato
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        titolo={p.numero ?? "Preventivo in bozza"}
        descrizione={p.oggetto}
        stato={<Tag tone={stato?.tone}>{stato?.label ?? p.stato}</Tag>}
        azioni={
          <>
            {p.stato === "bozza" && (
              <Button asChild variant="secondary">
                <Link href={`/preventivi/${p.id}/modifica`}>Modifica</Link>
              </Button>
            )}
            <Button asChild variant="secondary">
              <a href={`/api/pdf/preventivi/${p.id}`}>Scarica PDF</a>
            </Button>
            {puoAccettare && (
              <AccettaPreventivo
                preventivoId={p.id}
                regole={regole}
                oggi={oggi()}
                righe={dec.map(({ accettata: _a, ...r }) => r)}
              />
            )}
            {transizioni.map((nuovo) => (
              <form key={nuovo} action={cambiaStatoPreventivoAction}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="stato" value={nuovo} />
                <Button
                  type="submit"
                  variant={nuovo === "rifiutato" || nuovo === "scaduto" ? "secondary" : "primary"}
                >
                  {AZIONE_STATO[nuovo]}
                </Button>
              </form>
            ))}
            {puoCreareProgetto && (
              <CreaProgettoDaPreventivo preventivoId={p.id} nomeIniziale={p.oggetto} />
            )}
            {fattura ? (
              <Button asChild variant="secondary">
                <Link href={`/fatture/${fattura.id}`}>Vai alla fattura</Link>
              </Button>
            ) : (
              puoFatturare && (
                <form action={creaFatturaDaPreventivoAction}>
                  <input type="hidden" name="preventivoId" value={p.id} />
                  <Button type="submit">Converti in fattura</Button>
                </form>
              )
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader title="Emittente" />
              <DefList
                voci={[
                  {
                    etichetta: "Ragione sociale",
                    valore: (p.snapshot.emittente as { nome?: string }).nome ?? "—",
                  },
                  {
                    etichetta: "Tipo",
                    valore: rs
                      ? rs.tipo.charAt(0).toUpperCase() + rs.tipo.slice(1).replace(/_/g, " ")
                      : "—",
                  },
                  {
                    etichetta: "Numerazione",
                    valore: rs ? `es. ${formattaNumero(rs.formatoPreventivo, 1, p.anno)}` : "—",
                  },
                  { etichetta: "IVA", valore: iva },
                ]}
              />
            </Card>
            <Card>
              <CardHeader title="Cliente" description="Da Twenty" />
              <DefList
                voci={[
                  { etichetta: "Azienda", valore: cliente.nome ?? "da assegnare" },
                  { etichetta: "P.IVA", valore: cliente.partitaIva ?? "—", numerico: true },
                  { etichetta: "Codice SDI", valore: cliente.codiceSdi ?? "—", numerico: true },
                  { etichetta: "Sede", valore: cliente.citta ?? "—" },
                ]}
              />
            </Card>
          </div>

          <section className="flex flex-col gap-2" aria-labelledby="titolo-una-tantum">
            <h2 id="titolo-una-tantum" className="text-sm font-semibold">
              Prestazioni una tantum
            </h2>
            {unaTantum.length === 0 ? (
              <Card>
                <p className="text-sm text-fg-2">Nessuna prestazione una tantum.</p>
              </Card>
            ) : (
              <Table minLarghezza={640}>
                <thead>
                  <tr>
                    <Th>Descrizione</Th>
                    <Th destra>Qtà</Th>
                    <Th destra>Prezzo</Th>
                    <Th destra>Sconto</Th>
                    <Th destra>Importo</Th>
                    <Th>Esito</Th>
                  </tr>
                </thead>
                <tbody>
                  {unaTantum.map((r) => {
                    const e = esito(r);
                    return (
                      <tr
                        key={r.id}
                        className="group"
                        data-esito={e.escluso ? "esclusa" : undefined}
                      >
                        <Td className={e.escluso ? ESCLUSA : "font-medium"}>{r.descrizione}</Td>
                        <Td destra className={e.escluso ? ESCLUSA : undefined}>
                          {r.quantita}
                        </Td>
                        <Td destra className={e.escluso ? ESCLUSA : "text-fg-2"}>
                          {formatEuro(r.prezzoUnitarioCent)}
                        </Td>
                        <Td destra className={e.escluso ? ESCLUSA : "text-fg-2"}>
                          {r.scontoBp ? formatAliquota(r.scontoBp) : "—"}
                        </Td>
                        <Td destra>{cellaImporto(r.importoCent, e.escluso)}</Td>
                        <Td>
                          <Badge variant={e.variante}>{e.testo}</Badge>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </section>

          <section className="flex flex-col gap-2" aria-labelledby="titolo-abbonamenti">
            <h2 id="titolo-abbonamenti" className="text-sm font-semibold">
              Abbonamenti
            </h2>
            {ricorrenti.length === 0 ? (
              <Card>
                <p className="text-sm text-fg-2">Nessun abbonamento in questo preventivo.</p>
              </Card>
            ) : (
              <Table minLarghezza={600}>
                <thead>
                  <tr>
                    <Th>Servizio</Th>
                    <Th>Periodicità</Th>
                    <Th destra>Importo per periodo</Th>
                    <Th>Esito</Th>
                  </tr>
                </thead>
                {servizi.map((s) => (
                  <tbody
                    key={s.chiave}
                    className={s.alternative ? "bg-subtle/60" : undefined}
                    data-gruppo={s.alternative ? "alternative" : undefined}
                  >
                    {s.opzioni.map((o, i) => {
                      const r = righe.find((x) => x.id === o.rigaId);
                      if (!r) return null;
                      const e = esito(r);
                      const abbonamentoId = abbonamentoDellaRiga.get(r.id);
                      return (
                        <tr
                          key={o.rigaId}
                          className="group"
                          data-esito={e.escluso ? "esclusa" : undefined}
                        >
                          <Td className={e.escluso ? ESCLUSA : "font-medium"}>
                            {s.alternative && i > 0 && (
                              <span className="mr-1.5 text-xs font-normal text-fg-3 no-underline">
                                oppure
                              </span>
                            )}
                            {nomeServizio(r.descrizione)}
                          </Td>
                          <Td className={e.escluso ? ESCLUSA : "text-fg-2"}>
                            {o.tipo === "canone_annuo" ? "Annuale" : "Mensile"}
                          </Td>
                          <Td destra>
                            {cellaImporto(o.importoCent, e.escluso)}
                            <span className="sr-only"> per {ETICHETTA_PERIODO[o.tipo]}</span>
                          </Td>
                          <Td>
                            <span className="flex flex-wrap items-center gap-1.5">
                              <Badge variant={e.variante}>{e.testo}</Badge>
                              {abbonamentoId && (
                                <Link
                                  href={`/abbonamenti/${abbonamentoId}`}
                                  className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                                >
                                  Abbonamento <ExternalLink className="size-3" aria-hidden />
                                </Link>
                              )}
                            </span>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </Table>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Prestazioni una tantum" description={iva} />
            <DefList
              voci={
                accettato && p.totaleAccettatoCent !== null
                  ? [
                      {
                        etichetta: "Imponibile originale",
                        valore: formatEuro(p.imponibileCent),
                        numerico: true,
                      },
                      {
                        etichetta: "Imponibile accettato",
                        valore: formatEuro(p.imponibileAccettatoCent ?? 0),
                        numerico: true,
                      },
                      ...(regole.ivaAttiva
                        ? [
                            {
                              etichetta: iva,
                              valore: formatEuro(p.ivaAccettataCent ?? 0),
                              numerico: true,
                            },
                          ]
                        : []),
                      ...((p.bolloAccettatoCent ?? 0) > 0
                        ? [
                            {
                              etichetta: "Marca da bollo",
                              valore: formatEuro(p.bolloAccettatoCent ?? 0),
                              numerico: true,
                            },
                          ]
                        : []),
                      {
                        etichetta: "Totale accettato",
                        valore: <b className="text-base">{formatEuro(p.totaleAccettatoCent)}</b>,
                        numerico: true,
                      },
                    ]
                  : [
                      {
                        etichetta: "Imponibile",
                        valore: formatEuro(p.imponibileCent),
                        numerico: true,
                      },
                      ...(regole.ivaAttiva
                        ? [{ etichetta: iva, valore: formatEuro(p.ivaCent), numerico: true }]
                        : []),
                      ...(p.bolloCent > 0
                        ? [
                            {
                              etichetta: "Marca da bollo",
                              valore: formatEuro(p.bolloCent),
                              numerico: true,
                            },
                          ]
                        : []),
                      {
                        etichetta: p.stato === "rifiutato" ? "Totale offerto" : "Totale",
                        valore: <b className="text-base">{formatEuro(p.totaleCent)}</b>,
                        numerico: true,
                      },
                    ]
              }
            />
            {accettato &&
              p.totaleAccettatoCent !== null &&
              p.imponibileAccettatoCent !== p.imponibileCent && (
                <p className="mt-2 text-xs text-fg-2">
                  Escluse: {formatEuro(p.imponibileCent - (p.imponibileAccettatoCent ?? 0))} di
                  imponibile. L'offerta originale resta invariata.
                </p>
              )}
            {!regole.ivaAttiva && regole.diciturSenzaIva && (
              <p className="mt-3 text-xs text-fg-2">{regole.diciturSenzaIva}</p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Abbonamenti"
              description="Importi per periodo, mai sommati tra loro"
            />
            {servizi.length === 0 ? (
              <p className="text-sm text-fg-2">Nessun abbonamento.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {servizi.map((s) => {
                  const scelte = s.opzioni.filter((o) => o.accettata === true);
                  const mostra = decisioni && accettato ? scelte : s.opzioni;
                  const escluso = decisioni && scelte.length === 0;
                  return (
                    <li key={s.chiave} className="flex flex-col gap-0.5 py-2">
                      <span className={escluso ? `font-medium ${ESCLUSA}` : "font-medium"}>
                        {s.nome}
                      </span>
                      {escluso ? (
                        <span className="text-xs text-bad">Non accettato</span>
                      ) : (
                        <span className="flex flex-col text-fg-2 tabular-nums">
                          {mostra.map((o, i) => {
                            const v = prezzoVisualizzato(o.importoCent, regole);
                            return (
                              <span key={o.rigaId}>
                                {i > 0 && <span className="text-fg-3">oppure </span>}
                                {formatEuro(o.importoCent)} / {ETICHETTA_PERIODO[o.tipo]}
                                {v.lordoCent !== null && (
                                  <span className="text-fg-3">
                                    {" "}
                                    ({formatEuro(v.lordoCent)} ivato)
                                  </span>
                                )}
                              </span>
                            );
                          })}
                          {decisioni && accettato && s.alternative && (
                            <span className="text-xs text-fg-3">
                              Alternativa non scelta: barrata nella tabella
                            </span>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {servizi.length > 0 && (
              <p className="mt-3 border-t border-line pt-2 text-xs text-fg-2">
                Valore ricorrente annualizzato {accettato ? "accettato" : "proposto"}:{" "}
                <b className="tabular-nums">{formatEuro(valoreAnnuo)}</b>. Indicativo: non è un
                importo fatturabile e non entra nei totali.
              </p>
            )}
          </Card>

          {progettiCollegati.length > 0 && (
            <Card>
              <CardHeader
                title="Progetti"
                description={`${progettiCollegati.length} ${progettiCollegati.length === 1 ? "progetto collegato" : "progetti collegati"}`}
              />
              <ul className="divide-y divide-line text-sm">
                {progettiCollegati.map((pr) => (
                  <li key={pr.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/progetti/${pr.id}`} className="min-w-0 truncate hover:underline">
                      <span className="font-medium tabular-nums">{pr.codice}</span> · {pr.nome}
                    </Link>
                    <Badge variant={STATO_PROGETTO[pr.stato]?.variante} dot>
                      {STATO_PROGETTO[pr.stato]?.label}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader title="Dettagli" />
            <DefList
              voci={[
                {
                  etichetta: "Creato il",
                  valore: formatData(p.createdAt.toISOString()),
                  numerico: true,
                },
                { etichetta: "Valido fino al", valore: formatData(p.validoFino), numerico: true },
                ...(p.dataAccettazione
                  ? [
                      {
                        etichetta: "Accettato il",
                        valore: formatData(p.dataAccettazione.toISOString()),
                        numerico: true,
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

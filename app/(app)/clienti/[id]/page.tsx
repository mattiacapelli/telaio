import Link from "next/link";
import { notFound } from "next/navigation";
import { getCliente } from "@/lib/queries";
import { titoloPagina, nomeRecord } from "@/lib/titolo";
import { Badge } from "@/components/ui/badge";
import { Chip, coloreDa } from "@/components/chip";
import { EliminaRecord } from "@/components/elimina-record";
import { SezioneCampi, CampoRecord, Schede } from "@/components/record/pannello";
import { InserisciOre } from "@/components/inserisci-ore";
import { eur, eurCent, ore, data, dataEstesa, n } from "@/lib/format";
import { STATI as STATI_CONTRATTO, TIPI as TIPI_CONTRATTO } from "@/lib/contratti";
import {
  Building2, MapPin, CreditCard, Mail, Hash, Clock, Wallet, Euro,
  Users, FolderKanban, LifeBuoy, FileText, Receipt, FileSignature,
} from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const nome = await nomeRecord("cliente", id);
  return { title: await titoloPagina(nome ?? "Cliente") };
}

const STATI_PREVENTIVO: Record<string, string> = {
  BOZZA: "Bozza",
  INVIATO: "Inviato",
  ACCETTATO: "Accettato",
  RIFIUTATO: "Rifiutato",
};

const STATI_TICKET: Record<string, string> = {
  APERTO: "Aperto",
  IN_LAVORAZIONE: "In lavorazione",
  ATTESA_CLIENTE: "Attesa cliente",
  RISOLTO: "Risolto",
  CHIUSO: "Chiuso",
};

const STATI_RELAZIONE: Record<string, string> = {
  CUSTOMER: "Cliente attivo",
  PROSPECT: "Potenziale",
  CHURNED: "Concluso",
};

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCliente(id);
  if (!c) notFound();

  const fatturato = c.fatture
    .filter((f) => f.stato !== "DA_EMETTERE")
    .reduce((s, f) => s + n(f.imponibile), 0);
  const incassato = c.fatture.reduce(
    (s, f) => s + f.incassi.reduce((x, i) => x + n(i.importo), 0),
    0,
  );
  const progettiAttivi = c.progetti.filter(
    (p) => p.stato === "IN_CORSO" || p.stato === "DA_AVVIARE",
  ).length;
  const ticketAperti = c.ticket.filter(
    (t) => t.stato !== "RISOLTO" && t.stato !== "CHIUSO",
  ).length;
  const referentePrincipale = c.referenti.find((r) => r.principale) ?? c.referenti[0];

  return (
    <div className="tl-in flex flex-col overflow-hidden rounded border border-border md:h-[calc(100vh-96px)] md:flex-row">
      <aside className="flex w-full flex-none flex-col overflow-y-auto border-b border-border bg-surface md:w-[300px] md:border-b-0 md:border-r">
        <div className="flex flex-col items-center gap-2 px-3 py-5">
          <div
            className="grid h-12 w-12 place-items-center rounded-md text-md font-semibold"
            style={{ background: `${coloreDa(c.ragioneSociale)}26`, color: coloreDa(c.ragioneSociale) }}
          >
            {c.sigla}
          </div>
          <div className="text-center">
            <h1 className="text-md font-semibold">{c.ragioneSociale}</h1>
            <div className="mt-0.5 text-xs text-faint">
              {[c.settore, c.citta].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            <Badge tono={c.statoRelazione === "CUSTOMER" ? "accento" : "neutro"}>
              {STATI_RELAZIONE[c.statoRelazione] ?? c.statoRelazione}
            </Badge>
            {c.twentyId && <Badge>sincronizzato da Twenty</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <EliminaRecord
              entita="cliente"
              id={c.id}
              nome={c.ragioneSociale}
              dopoRedirect="/clienti"
              size="sm"
            />
          </div>
        </div>

        <div className="px-3 pb-1 text-md font-medium">Campi</div>

        <SezioneCampi titolo="Generale">
          <CampoRecord icona={<Building2 size={12} />} etichetta="Settore" vuoto="Non specificato">
            {c.settore}
          </CampoRecord>
          <CampoRecord icona={<MapPin size={12} />} etichetta="Città" vuoto="Non specificata">
            {c.citta}
          </CampoRecord>
          <CampoRecord icona={<Hash size={12} />} etichetta="P.IVA" vuoto="Non specificata">
            {c.partitaIva}
          </CampoRecord>
          <CampoRecord icona={<Hash size={12} />} etichetta="Cod. fiscale" vuoto="Non specificato">
            {c.codiceFiscale}
          </CampoRecord>
          <CampoRecord icona={<Mail size={12} />} etichetta="PEC" vuoto="Non specificata">
            {c.pec}
          </CampoRecord>
          <CampoRecord icona={<Users size={12} />} etichetta="Referente" vuoto="Nessuno">
            {referentePrincipale && `${referentePrincipale.nome} ${referentePrincipale.cognome}`}
          </CampoRecord>
        </SezioneCampi>

        <SezioneCampi titolo="Economia">
          <CampoRecord icona={<Clock size={12} />} etichetta="Tariffa oraria">
            {eurCent(c.tariffaOraria)}
          </CampoRecord>
          <CampoRecord icona={<CreditCard size={12} />} etichetta="Pagamento">
            {c.terminiPagamento} gg data fattura
          </CampoRecord>
          <CampoRecord icona={<Euro size={12} />} etichetta="Fatturato">
            {eur(fatturato)}
          </CampoRecord>
          <CampoRecord icona={<Wallet size={12} />} etichetta="Incassato">
            {eur(incassato)}
          </CampoRecord>
        </SezioneCampi>

        <SezioneCampi titolo="Sistema" apertaDiDefault={false}>
          <CampoRecord icona={<Hash size={12} />} etichetta="Codice SDI" vuoto="Non specificato">
            {c.codiceSdi}
          </CampoRecord>
          <CampoRecord icona={<Clock size={12} />} etichetta="Sincronizzato" vuoto="Mai">
            {c.syncedAt && dataEstesa(c.syncedAt)}
          </CampoRecord>
        </SezioneCampi>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-bg">
        <Schede
          schede={[
            {
              chiave: "referenti",
              etichetta: "Referenti",
              icona: <Users size={13} />,
              conteggio: c.referenti.length,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border">
                    {c.referenti.length === 0 ? (
                      <div className="px-3 py-6 text-center text-md text-faint">
                        Nessun referente.
                      </div>
                    ) : (
                      c.referenti.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-md">{r.nome} {r.cognome}</div>
                            <div className="truncate text-xs text-faint">
                              {[r.ruolo, r.email, r.telefono].filter(Boolean).join(" · ") || "—"}
                            </div>
                          </div>
                          {r.principale && <Badge tono="accento">principale</Badge>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ),
            },
            {
              chiave: "progetti",
              etichetta: "Progetti",
              icona: <FolderKanban size={13} />,
              conteggio: c.progetti.length,
              contenuto: (
                <div className="p-4">
                  {progettiAttivi > 0 && (
                    <div className="mb-2 text-md text-muted">
                      {progettiAttivi} attiv{progettiAttivi === 1 ? "o" : "i"} su {c.progetti.length}
                    </div>
                  )}
                  <div className="rounded border border-border">
                    {c.progetti.length === 0 ? (
                      <div className="px-3 py-6 text-center text-md text-faint">
                        Nessun progetto.
                      </div>
                    ) : (
                      c.progetti.map((p) => (
                        <Link
                          key={p.id}
                          href={`/progetti/${p.id}`}
                          className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-[var(--alpha-lighter)]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-md">{p.nome}</div>
                            <div className="text-xs text-faint">
                              {ore(p.registrazioni.reduce((s, r) => s + n(r.ore), 0))} / {ore(p.budgetOre)}
                            </div>
                          </div>
                          <Badge tono={p.stato === "IN_CORSO" ? "accento" : "neutro"}>
                            {p.stato.toLowerCase().replace("_", " ")}
                          </Badge>
                          <span className="w-20 flex-none text-right text-md">{eur(p.valore)}</span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ),
            },
            {
              chiave: "ticket",
              etichetta: "Ticket",
              icona: <LifeBuoy size={13} />,
              conteggio: c.ticket.length,
              contenuto: (
                <div className="p-4">
                  {ticketAperti > 0 && (
                    <div className="mb-2 text-md text-muted">
                      {ticketAperti} apert{ticketAperti === 1 ? "o" : "i"} su {c.ticket.length}
                    </div>
                  )}
                  <div className="rounded border border-border">
                    {c.ticket.length === 0 ? (
                      <div className="px-3 py-6 text-center text-md text-faint">
                        Nessun ticket.
                      </div>
                    ) : (
                      c.ticket.map((t) => (
                        <Link
                          key={t.id}
                          href={`/ticket/${t.id}`}
                          className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-[var(--alpha-lighter)]"
                        >
                          <span className="text-xs text-faint">#{t.numero}</span>
                          <div className="min-w-0 flex-1 truncate text-md">{t.titolo}</div>
                          <Badge tono={t.stato === "APERTO" ? "accento" : "neutro"}>
                            {STATI_TICKET[t.stato] ?? t.stato}
                          </Badge>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ),
            },
            {
              chiave: "preventivi",
              etichetta: "Preventivi",
              icona: <FileText size={13} />,
              conteggio: c.preventivi.length,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border">
                    {c.preventivi.length === 0 ? (
                      <div className="px-3 py-6 text-center text-md text-faint">
                        Nessun preventivo.
                      </div>
                    ) : (
                      c.preventivi.map((p) => (
                        <Link
                          key={p.id}
                          href={`/preventivi/${p.id}`}
                          className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-[var(--alpha-lighter)]"
                        >
                          <span className="text-xs text-faint">{p.numero}</span>
                          <div className="min-w-0 flex-1 truncate text-md">{p.titolo}</div>
                          <Badge tono={p.stato === "ACCETTATO" ? "accento" : "neutro"}>
                            {STATI_PREVENTIVO[p.stato] ?? p.stato}
                          </Badge>
                          <span className="w-20 flex-none text-right text-md">{eur(p.imponibile)}</span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ),
            },
            {
              chiave: "fatture",
              etichetta: "Fatture",
              icona: <Receipt size={13} />,
              conteggio: c.fatture.length,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border">
                    {c.fatture.length === 0 ? (
                      <div className="px-3 py-6 text-center text-md text-faint">
                        Nessuna fattura.
                      </div>
                    ) : (
                      c.fatture.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0"
                        >
                          <span className="text-md">{f.numero}</span>
                          <div className="flex-1 text-xs text-faint">
                            {f.emessaIl ? data(f.emessaIl) : "da emettere"}
                          </div>
                          <Badge tono={f.stato === "PAGATA" ? "accento" : "neutro"}>
                            {f.stato.toLowerCase().replace("_", " ")}
                          </Badge>
                          <span className="w-20 flex-none text-right text-md">{eur(f.imponibile)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ),
            },
            {
              chiave: "ore",
              etichetta: "Ore",
              icona: <Clock size={13} />,
              conteggio: c.registrazioni.length,
              contenuto: (
                <div className="p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-md text-muted">
                      Ore registrate direttamente sul cliente, senza passare da un progetto.
                    </span>
                    <InserisciOre clienteFisso={{ id: c.id, nome: c.ragioneSociale }} />
                  </div>
                  <div className="rounded border border-border">
                    {c.registrazioni.length === 0 ? (
                      <div className="px-3 py-6 text-center text-md text-faint">
                        Nessuna ora registrata direttamente sul cliente.
                      </div>
                    ) : (
                      c.registrazioni.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0"
                        >
                          <span className="w-20 flex-none text-xs text-faint">{data(r.data)}</span>
                          <div className="min-w-0 flex-1 truncate text-md">
                            {r.descrizione || "—"}
                          </div>
                          {!r.fatturabile && <Badge>non fatturabile</Badge>}
                          <span className="w-16 flex-none text-right text-md tabular-nums">
                            {ore(r.ore)}
                          </span>
                          <InserisciOre
                            registrazione={{
                              id: r.id,
                              data: r.data.toISOString().slice(0, 10),
                              ore: n(r.ore),
                              descrizione: r.descrizione ?? "",
                              fatturabile: r.fatturabile,
                            }}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ),
            },
            {
              chiave: "contratti",
              etichetta: "Contratti",
              icona: <FileSignature size={13} />,
              conteggio: c.contratti.length,
              contenuto: (
                <div className="p-4">
                  <div className="rounded border border-border">
                    {c.contratti.length === 0 ? (
                      <div className="px-3 py-6 text-center text-md text-faint">
                        Nessun contratto.
                      </div>
                    ) : (
                      c.contratti.map((k) => (
                        <Link
                          key={k.id}
                          href={`/contratti/${k.id}`}
                          className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-[var(--alpha-lighter)]"
                        >
                          <span className="text-xs text-faint">{k.numero}</span>
                          <div className="min-w-0 flex-1 truncate text-md">
                            {k.titolo}
                            <span className="ml-1.5 text-xs text-faint">{TIPI_CONTRATTO[k.tipo]}</span>
                          </div>
                          <Badge tono={k.stato === "ATTIVO" ? "accento" : "neutro"}>
                            {STATI_CONTRATTO[k.stato]}
                          </Badge>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

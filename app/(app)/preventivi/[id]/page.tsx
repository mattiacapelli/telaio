import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/chip";
import { eur, eurCent, data, dataEstesa, n } from "@/lib/format";
import { calcolaPreventivo, UNITA_BREVE } from "@/lib/calcoli";
import { getClientiPerSelezione } from "@/lib/queries";
import { etichettaRevisione, type VoceCongelata } from "@/lib/revisioni";
import { ModificaPreventivo } from "@/components/modifica-preventivo";
import { FileDown } from "lucide-react";

export const dynamic = "force-dynamic";

const STATI: Record<string, string> = {
  BOZZA: "Bozza",
  INVIATO: "Inviato",
  ACCETTATO: "Accettato",
  RIFIUTATO: "Rifiutato",
};

export default async function PreventivoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [p, clienti, aziende] = await Promise.all([
    prisma.preventivo.findUnique({
      where: { id },
      include: {
        cliente: true,
        referente: true,
        voci: { orderBy: { ordine: "asc" } },
        revisioni: { orderBy: { numero: "desc" } },
      },
    }),
    getClientiPerSelezione(),
    prisma.azienda.findMany({ select: { id: true, ragioneSociale: true }, orderBy: { ragioneSociale: "asc" } }),
  ]);
  if (!p) notFound();

  const riepilogo = calcolaPreventivo(
    p.voci.map((v) => ({
      quantita: n(v.quantita),
      prezzo: n(v.prezzo),
      sconto: n(v.sconto),
    })),
    n(p.scontoPercento),
    n(p.aliquotaIva),
  );

  const etichetta = etichettaRevisione(p.revisioneCorrente);

  return (
    <div className="tl-in flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/preventivi"
          className="h-6 rounded border border-border2 bg-[var(--alpha-lighter)] px-2 text-md text-muted hover:border-border2 hover:text-text"
        >
          ← Preventivi
        </Link>
        <span className="text-md text-faint">
          {p.numero}
          {etichetta && ` · ${etichetta}`} · {p.cliente.ragioneSociale}
        </span>
        <div className="flex-1" />
        <a
          href={`/api/preventivi/${p.id}/pdf`}
          target="_blank"
          rel="noopener"
          className="flex h-[24px] items-center gap-1.5 rounded border border-border2 bg-[var(--alpha-lighter)] px-2 text-md text-muted transition-colors hover:bg-[var(--alpha-light)] hover:text-text"
        >
          <FileDown size={13} /> PDF
        </a>
        <ModificaPreventivo
          clienti={clienti}
          aziende={aziende}
          preventivo={{
            id: p.id,
            stato: p.stato,
            dati: {
              titolo: p.titolo,
              clienteId: p.clienteId,
              referenteId: p.referenteId ?? "",
              scadeIl: p.scadeIl ? p.scadeIl.toISOString().slice(0, 10) : "",
              scontoPercento: String(n(p.scontoPercento)),
              aliquotaIva: String(n(p.aliquotaIva)),
              probabilita: p.probabilita === null ? "" : String(p.probabilita),
              premessa: p.premessa ?? "",
              tempiConsegna: p.tempiConsegna ?? "",
              modalitaPagamento: p.modalitaPagamento ?? "",
              validitaGiorni:
                p.validitaGiorni === null ? "" : String(p.validitaGiorni),
              note: p.note ?? "",
              voci: p.voci.map((v) => ({
                descrizione: v.descrizione,
                nota: v.nota ?? "",
                quantita: String(n(v.quantita)),
                unita: v.unita,
                prezzo: String(n(v.prezzo)),
                sconto: String(n(v.sconto)),
              })),
              aziendaId: p.aziendaId ?? "",
            },
          }}
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">{p.titolo}</h2>
              {etichetta && <Badge tono="accento">{etichetta}</Badge>}
              <Badge>{STATI[p.stato]}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-md text-muted">
              <Chip testo={p.cliente.ragioneSociale} />
              {p.cliente.ragioneSociale}
              {p.referente && (
                <span className="text-faint">
                  · alla c.a. {p.referente.nome} {p.referente.cognome}
                </span>
              )}
              {p.probabilita !== null && (
                <Badge>{p.probabilita}% di chiusura</Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">
              {eurCent(riepilogo.totale)}
            </div>
            <div className="text-xs text-faint">
              imponibile {eurCent(riepilogo.imponibile)} · IVA{" "}
              {n(p.aliquotaIva)}%
            </div>
            <div className="text-xs text-faint">
              {p.scadeIl ? `scade ${data(p.scadeIl)}` : "senza scadenza"}
              {p.validitaGiorni ? ` · validità ${p.validitaGiorni} gg` : ""}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHead titolo={`Voci${etichetta ? ` · ${etichetta}` : ""}`} />
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              <div className="grid grid-cols-[1fr_80px_80px_60px_90px] gap-2 border-b border-border px-3 py-2 text-xs font-medium text-faint">
                <span>Descrizione</span>
                <span className="text-right">Q.tà</span>
                <span className="text-right">Prezzo</span>
                <span className="text-right">Sc.</span>
                <span className="text-right">Totale</span>
              </div>
              {p.voci.map((v) => {
                const sconto = n(v.sconto);
                const lordo = n(v.quantita) * n(v.prezzo);
                return (
                  <div
                    key={v.id}
                    className="grid grid-cols-[1fr_80px_80px_60px_90px] gap-2 border-b border-border px-3 py-2 text-md last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate">{v.descrizione}</div>
                      {v.nota && (
                        <div className="truncate text-xs text-faint">{v.nota}</div>
                      )}
                    </div>
                    <span className="text-right text-muted">
                      {n(v.quantita).toLocaleString("it-IT")}{" "}
                      {UNITA_BREVE[v.unita] ?? ""}
                    </span>
                    <span className="text-right text-muted">{eurCent(v.prezzo)}</span>
                    <span className="text-right text-muted">
                      {sconto > 0 ? `${sconto}%` : "—"}
                    </span>
                    <span className="text-right">
                      {eur(lordo * (1 - sconto / 100))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Riepilogo fiscale in coda alle voci. */}
          <div className="border-t border-border px-3 py-2.5 text-md">
            {riepilogo.scontiRiga > 0 && (
              <div className="flex items-center py-0.5 text-muted">
                <span>Sconti di riga</span>
                <div className="flex-1" />
                <span>− {eurCent(riepilogo.scontiRiga)}</span>
              </div>
            )}
            {riepilogo.scontoTotale > 0 && (
              <div className="flex items-center py-0.5 text-muted">
                <span>Sconto {n(p.scontoPercento)}%</span>
                <div className="flex-1" />
                <span>− {eurCent(riepilogo.scontoTotale)}</span>
              </div>
            )}
            <div className="flex items-center py-0.5">
              <span>Imponibile</span>
              <div className="flex-1" />
              <span className="tabular-nums">{eurCent(riepilogo.imponibile)}</span>
            </div>
            <div className="flex items-center py-0.5 text-muted">
              <span>IVA {n(p.aliquotaIva)}%</span>
              <div className="flex-1" />
              <span className="tabular-nums">{eurCent(riepilogo.iva)}</span>
            </div>
            <div className="mt-1 flex items-center border-t border-border pt-1.5 font-semibold">
              <span>Totale documento</span>
              <div className="flex-1" />
              <span className="tabular-nums">{eurCent(riepilogo.totale)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead
            titolo="Revisioni"
            extra={
              <span className="text-xs text-faint">
                {p.revisioni.length + 1} version
                {p.revisioni.length === 0 ? "e" : "i"}
              </span>
            }
          />

          {/* Versione corrente in cima, poi lo storico dal più recente. */}
          <div className="flex items-start gap-3 border-b border-border bg-accent-soft px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-md font-medium">
                  {etichetta || "Versione iniziale"}
                </span>
                <Badge tono="accento">corrente</Badge>
              </div>
              <div className="text-xs text-faint">
                {p.voci.length} voci · aggiornato {dataEstesa(p.updatedAt)}
              </div>
              {p.motivoCorrente && (
                <div className="mt-1 text-md text-muted">
                  &ldquo;{p.motivoCorrente}&rdquo;
                </div>
              )}
            </div>
            <span className="text-md font-semibold">{eur(p.imponibile)}</span>
          </div>

          {p.revisioni.length === 0 ? (
            <div className="px-3 py-5 text-center text-md text-faint">
              Nessuna revisione precedente.
              <br />
              Le modifiche a un preventivo già inviato ne creeranno una.
            </div>
          ) : (
            p.revisioni.map((r) => {
              const voci = (r.voci as unknown as VoceCongelata[]) ?? [];
              return (
                <div
                  key={r.id}
                  className="flex items-start gap-3 border-b border-border px-3 py-2.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-md">
                      {etichettaRevisione(r.numero) || "Versione iniziale"}
                    </div>
                    <div className="text-xs text-faint">
                      {voci.length} voci · {dataEstesa(r.creataIl)}
                      {r.autore && ` · ${r.autore}`}
                    </div>
                    {r.motivo && (
                      <div className="mt-1 text-md text-muted">
                        &ldquo;{r.motivo}&rdquo;
                      </div>
                    )}
                  </div>
                  <span className="text-md text-muted">{eur(r.imponibile)}</span>
                  <a
                    href={`/api/preventivi/${p.id}/pdf?revisione=${r.numero}`}
                    target="_blank"
                    rel="noopener"
                    title={`PDF della revisione ${r.numero}`}
                    className="grid h-6 w-6 flex-none place-items-center rounded text-faint transition-colors hover:bg-surface2 hover:text-text"
                  >
                    <FileDown size={13} />
                  </a>
                </div>
              );
            })
          )}
        </Card>
      </div>

      {(p.premessa || p.tempiConsegna || p.modalitaPagamento || p.note) && (
        <Card>
          <CardHead titolo="Condizioni" />
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            {p.premessa && (
              <Testo etichetta="Premessa" valore={p.premessa} ampio />
            )}
            {p.tempiConsegna && (
              <Testo etichetta="Tempi di consegna" valore={p.tempiConsegna} />
            )}
            {p.modalitaPagamento && (
              <Testo etichetta="Modalità di pagamento" valore={p.modalitaPagamento} />
            )}
            {p.note && <Testo etichetta="Note" valore={p.note} ampio />}
          </div>
        </Card>
      )}
    </div>
  );
}

function Testo({
  etichetta,
  valore,
  ampio,
}: {
  etichetta: string;
  valore: string;
  ampio?: boolean;
}) {
  return (
    <div className={ampio ? "sm:col-span-2" : undefined}>
      <div className="text-xs text-faint">{etichetta}</div>
      <div className="mt-0.5 whitespace-pre-wrap text-md">{valore}</div>
    </div>
  );
}

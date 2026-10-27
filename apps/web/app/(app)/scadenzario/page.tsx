import { formatEuro, giorniDiRitardo } from "@telaio/core";
import {
  asc,
  clientiRef,
  conti,
  eq,
  getDb,
  inArray,
  isNull,
  ragioniSociali,
  rate,
  solleciti,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import { IncassoModal } from "@/components/domain/incasso-modal";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { formatData, oggi } from "@/lib/date";
import { inviaSollecitoAction, scartaSollecitoAction } from "./actions";

export const metadata = { title: "Scadenzario" };
export const dynamic = "force-dynamic";

export default async function ScadenzarioPage() {
  const db = getDb();
  const dataOggi = oggi();
  const [lista, bozze, contiAttivi] = await Promise.all([
    db
      .select({ r: rate, cliente: clientiRef.nome, emittente: ragioniSociali.nome })
      .from(rate)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, rate.ragioneSocialeId))
      .leftJoin(clientiRef, eq(clientiRef.id, rate.clienteRefId))
      .where(inArray(rate.stato, ["da_incassare", "scaduta", "parziale"]))
      .orderBy(asc(rate.scadenza))
      .limit(300),
    db
      .select({
        s: solleciti,
        r: rate,
        cliente: clientiRef.nome,
        pec: clientiRef.pec,
        twentyId: clientiRef.twentyCompanyId,
      })
      .from(solleciti)
      .innerJoin(rate, eq(rate.id, solleciti.rataId))
      .leftJoin(clientiRef, eq(clientiRef.id, rate.clienteRefId))
      .where(eq(solleciti.stato, "da_confermare"))
      .orderBy(asc(rate.scadenza)),
    db.select({ id: conti.id, nome: conti.nome }).from(conti).where(isNull(conti.deletedAt)),
  ]);

  // Destinatario suggerito: prima persona con email su Twenty, altrimenti la PEC del cliente.
  const twenty = twentyDaEnv();
  const suggerimenti = new Map<string, string>();
  for (const { s, pec, twentyId } of bozze) {
    const persona = twentyId
      ? (await twenty.elencaPersone(twentyId).catch(() => [])).find((p) => p.email)
      : undefined;
    suggerimenti.set(s.id, persona?.email ?? pec ?? "");
  }

  const scadute = lista.filter(({ r }) => r.scadenza < dataOggi);
  const inScadenza = lista.filter(({ r }) => r.scadenza >= dataOggi);
  const totale = (xs: typeof lista) => xs.reduce((s, { r }) => s + r.importoCent, 0);

  return (
    <>
      <PageHeader
        numero="08"
        sezione="Amministrazione"
        titolo="Scadenzario"
        descrizione="Rate da incassare e scadute. I solleciti li prepara il sistema, li invii tu."
      />

      <section className="mb-10">
        <h2 className="mb-1 font-display text-2xl font-semibold">Solleciti da confermare</h2>
        <p className="mb-4 text-sm text-muted">
          Nessun sollecito parte da solo: rivedi testo e destinatario, poi conferma.
        </p>
        {bozze.length === 0 ? (
          <EmptyState title="Nessun sollecito in attesa">
            Le bozze per le rate scadute compaiono qui dopo il controllo giornaliero.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {bozze.map(({ s, r, cliente }) => (
              <Card key={s.id} className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {cliente ?? "Cliente"} · {r.descrizione}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <Tag tone="orange">
                      {giorniDiRitardo(r.scadenza, dataOggi)} giorni di ritardo
                    </Tag>
                    <Tag>Livello {s.livello}</Tag>
                    <span className="tabular-nums">{formatEuro(r.importoCent)}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <FormModal
                    trigger="Rivedi e invia"
                    triggerSize="sm"
                    title="Rivedi il sollecito"
                    description="L'email parte solo quando premi «Invia sollecito»."
                    submitLabel="Invia sollecito"
                    action={inviaSollecitoAction}
                  >
                    <input type="hidden" name="id" value={s.id} />
                    <Field
                      label="Destinatario"
                      name="destinatario"
                      hint={
                        suggerimenti.get(s.id)
                          ? undefined
                          : "Nessun indirizzo trovato su Twenty: inseriscilo a mano"
                      }
                    >
                      <Input
                        name="destinatario"
                        type="email"
                        required
                        defaultValue={suggerimenti.get(s.id)}
                      />
                    </Field>
                    <Field label="Oggetto" name="oggetto">
                      <Input name="oggetto" required defaultValue={s.oggetto ?? ""} />
                    </Field>
                    <Field label="Testo" name="corpo">
                      <Textarea
                        name="corpo"
                        required
                        defaultValue={s.corpo ?? ""}
                        className="min-h-56"
                      />
                    </Field>
                  </FormModal>
                  <form action={scartaSollecitoAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Scarta
                    </Button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Sezione
        titolo="Scadute"
        righe={scadute}
        totale={totale(scadute)}
        conti={contiAttivi}
        dataOggi={dataOggi}
        vuoto="Nessuna rata scaduta."
      />
      <Sezione
        titolo="In scadenza"
        righe={inScadenza}
        totale={totale(inScadenza)}
        conti={contiAttivi}
        dataOggi={dataOggi}
        vuoto="Nessuna rata futura."
      />
    </>
  );
}

function Sezione({
  titolo,
  righe,
  totale,
  conti: contiOpt,
  dataOggi,
  vuoto,
}: {
  titolo: string;
  righe: { r: typeof rate.$inferSelect; cliente: string | null; emittente: string }[];
  totale: number;
  conti: { id: string; nome: string }[];
  dataOggi: string;
  vuoto: string;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">{titolo}</h2>
        <p className="money text-lg tabular-nums">{formatEuro(totale)}</p>
      </div>
      {righe.length === 0 ? (
        <p className="glass-card p-5 text-sm text-muted">{vuoto}</p>
      ) : (
        <Card className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[720px] text-sm">
            <tbody>
              {righe.map(({ r, cliente, emittente }) => (
                <tr key={r.id} className="border-t border-grey-2/60 first:border-t-0">
                  <td className="px-4 py-3 tabular-nums">{formatData(r.scadenza)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.descrizione}</p>
                    <p className="text-xs text-muted">
                      {cliente ?? "—"} · {emittente}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {r.scadenza < dataOggi ? (
                      <Tag tone="orange">Scaduta</Tag>
                    ) : r.stato === "parziale" ? (
                      <Tag tone="blue">Parziale</Tag>
                    ) : (
                      <Tag>Da incassare</Tag>
                    )}
                  </td>
                  <td className="money px-4 py-3 text-right tabular-nums">
                    {formatEuro(r.importoCent)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <IncassoModal
                      conti={contiOpt}
                      rataId={r.id}
                      importoCent={r.importoCent}
                      descrizione={r.descrizione}
                      trigger="Incasso"
                      triggerVariant="ghost"
                      triggerSize="sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

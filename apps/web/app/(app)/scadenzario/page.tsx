import { formatEuro, GIORNI_TRA_SOLLECITI, giorniDiRitardo, LIVELLO_MASSIMO } from "@telaio/core";
import {
  and,
  asc,
  clientiRef,
  conti,
  eq,
  getDb,
  gte,
  inArray,
  isNull,
  ragioniSociali,
  rate,
  solleciti,
  sql,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { oggi } from "@/lib/date";
import { inviaSollecitoAction, scartaSollecitoAction } from "./actions";
import { RateTabella, type RigaRata } from "./rate-tabella";

export const metadata = { title: "Scadenzario" };
export const dynamic = "force-dynamic";

const LIVELLI = [
  ["Primo sollecito", "Email · dopo la scadenza"],
  ["Secondo sollecito", `Email · ${GIORNI_TRA_SOLLECITI} giorni dopo il primo`],
  ["Avviso formale", "Email · tono deciso, ultimo livello"],
];

export default async function ScadenzarioPage() {
  const db = getDb();
  const dataOggi = oggi();
  const inizioMese = `${dataOggi.slice(0, 7)}-01`;
  const [lista, bozze, contiAttivi, inviati] = await Promise.all([
    db
      .select({
        r: rate,
        cliente: clientiRef.nome,
        emittente: ragioniSociali.nome,
        incassato: sql<number>`coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = ${rate.id} and i.deleted_at is null),0)::int`,
        nSoll: sql<number>`(select count(*)::int from solleciti s where s.rata_id = ${rate.id} and s.stato = 'inviato')`,
        bozza: sql<
          string | null
        >`(select s.id from solleciti s where s.rata_id = ${rate.id} and s.stato = 'da_confermare' limit 1)`,
      })
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
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(solleciti)
      .where(
        and(
          eq(solleciti.stato, "inviato"),
          gte(solleciti.inviatoIl, new Date(`${inizioMese}T00:00:00Z`)),
        ),
      ),
  ]);

  const twenty = twentyDaEnv();
  const suggerimenti = new Map<string, string>();
  for (const { s, pec, twentyId } of bozze) {
    const persona = twentyId
      ? (await twenty.elencaPersone(twentyId).catch(() => [])).find((p) => p.email)
      : undefined;
    suggerimenti.set(s.id, persona?.email ?? pec ?? "");
  }

  const residuo = (x: (typeof lista)[number]) => Math.max(0, x.r.importoCent - x.incassato);
  const scadute = lista.filter(({ r }) => r.scadenza < dataOggi);
  const fra30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const prossime = lista.filter(({ r }) => r.scadenza >= dataOggi && r.scadenza <= fra30);
  const somma = (xs: typeof lista) => xs.reduce((s, x) => s + residuo(x), 0);
  const maxRitardo = scadute.reduce(
    (m, { r }) => Math.max(m, giorniDiRitardo(r.scadenza, dataOggi)),
    0,
  );
  const anteprima = bozze[0];

  const righe: RigaRata[] = lista.map((x) => ({
    id: x.r.id,
    scadenza: x.r.scadenza,
    stato: x.r.scadenza < dataOggi ? "scaduta" : "in_arrivo",
    giorniRitardo: giorniDiRitardo(x.r.scadenza, dataOggi),
    parziale: x.r.stato === "parziale",
    cliente: x.cliente,
    descrizione: x.r.descrizione,
    emittente: x.emittente,
    residuoCent: residuo(x),
    importoCent: x.r.importoCent,
    solleciti: x.nSoll,
    bozza: !!x.bozza,
  }));

  return (
    <>
      <PageHeader
        titolo="Scadenzario"
        descrizione="Rate dei preventivi accettati e canoni in scadenza. I solleciti li prepara il sistema; li invii tu, dopo averli riletti."
        azioni={
          <>
            <Button asChild variant="secondary">
              <Link href="/incassi">Incassi</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/cash-flow">Cash flow</Link>
            </Button>
          </>
        }
      />
      <StatsRow
        dati={[
          {
            etichetta: "Da incassare",
            valore: formatEuro(somma(lista)),
            nota: `${lista.length} rat${lista.length === 1 ? "a" : "e"}`,
          },
          {
            etichetta: "Scaduto",
            valore: formatEuro(somma(scadute)),
            nota: scadute.length
              ? `${scadute.length} rat${scadute.length === 1 ? "a" : "e"} · ${maxRitardo} giorni`
              : "nessuna rata scaduta",
            tono: scadute.length ? "bad" : undefined,
          },
          {
            etichetta: "Prossimi 30 giorni",
            valore: formatEuro(somma(prossime)),
            nota: `${prossime.length} rat${prossime.length === 1 ? "a" : "e"}`,
          },
          { etichetta: "Solleciti inviati", valore: inviati[0]?.n ?? 0, nota: "questo mese" },
        ]}
      />

      {bozze.length > 0 && (
        <Card>
          <CardHeader
            title="Solleciti da confermare"
            description="Nessun sollecito parte da solo: rivedi testo e destinatario, poi conferma."
          />
          <ul className="-mx-2 flex flex-col">
            {bozze.map(({ s, r, cliente }) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md px-2 py-2.5"
              >
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-medium">
                    {cliente ?? "Cliente"} · {r.descrizione}
                  </span>
                  <span className="text-xs text-fg-3">
                    {giorniDiRitardo(r.scadenza, dataOggi)} giorni di ritardo · livello {s.livello}{" "}
                    · {formatEuro(r.importoCent)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <FormModal
                    trigger="Rivedi e invia"
                    triggerVariant="secondary"
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
              </li>
            ))}
          </ul>
        </Card>
      )}

      <RateTabella righe={righe} conti={contiAttivi} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Cadenza dei solleciti" description="Sempre con la tua conferma" />
          <ol className="flex flex-col divide-y divide-line text-sm">
            {LIVELLI.slice(0, LIVELLO_MASSIMO).map(([t, d], i) => (
              <li key={t} className="flex items-baseline gap-3 py-2">
                <span className="w-16 shrink-0 text-xs text-fg-3">Livello {i + 1}</span>
                <span className="flex flex-col leading-tight">
                  <span className="font-medium">{t}</span>
                  <span className="text-xs text-fg-2">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-fg-2">
            Ogni mattina il sistema prepara la bozza per le rate scadute; non ne propone un'altra
            finché ce n'è una in attesa e aspetta {GIORNI_TRA_SOLLECITI} giorni dall'ultimo inviato.
            I solleciti si fermano appena l'incasso viene registrato.
          </p>
        </Card>
        <Card>
          <CardHeader
            title="Anteprima"
            description={anteprima ? `Livello ${anteprima.s.livello}` : "Ultima bozza"}
          />
          {anteprima ? (
            <div className="flex flex-col gap-2 rounded-md border border-line bg-subtle p-3 text-sm">
              <b>Oggetto: {anteprima.s.oggetto}</b>
              <div className="whitespace-pre-wrap text-fg-2">{anteprima.s.corpo}</div>
            </div>
          ) : (
            <p className="text-sm text-fg-2">
              Quando una rata scade, la bozza del sollecito compare qui per essere riletta e
              confermata.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

import {
  aggiungiMesi,
  formatAliquota,
  formatEuro,
  importoRataDaCanoneAnnuo,
  MESI_PER_PERIODICITA,
  type Periodicita,
  prezzoVisualizzato,
} from "@telaio/core";
import {
  abbonamenti,
  asc,
  clientiRef,
  desc,
  eq,
  getDb,
  isNull,
  ragioniSociali,
  rate,
} from "@telaio/db";
import { AbbonamentoModal } from "@/components/domain/abbonamento-modal";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { oggi } from "@/lib/date";
import { regoleDa } from "@/lib/regole";
import { AbbonamentiTabella, type RigaAbbonamento } from "./abbonamenti-tabella";

export const metadata = { title: "Abbonamenti" };
export const dynamic = "force-dynamic";

export default async function AbbonamentiPage() {
  const db = getDb();
  const dataOggi = oggi();
  const [lista, clienti, emittenti, prossime] = await Promise.all([
    db
      .select({ a: abbonamenti, cliente: clientiRef.nome, rs: ragioniSociali })
      .from(abbonamenti)
      .innerJoin(clientiRef, eq(clientiRef.id, abbonamenti.clienteRefId))
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, abbonamenti.ragioneSocialeId))
      .where(isNull(abbonamenti.deletedAt))
      .orderBy(desc(abbonamenti.createdAt)),
    db
      .select({ id: clientiRef.id, nome: clientiRef.nome })
      .from(clientiRef)
      .where(isNull(clientiRef.deletedAt))
      .orderBy(clientiRef.nome),
    db
      .select({ id: ragioniSociali.id, nome: ragioniSociali.nome })
      .from(ragioniSociali)
      .where(isNull(ragioniSociali.deletedAt)),
    db
      .select({ abbonamentoId: rate.abbonamentoId, scadenza: rate.scadenza })
      .from(rate)
      .where(eq(rate.stato, "da_incassare"))
      .orderBy(asc(rate.scadenza)),
  ]);

  const prossima = new Map<string, string>();
  for (const r of prossime)
    if (r.abbonamentoId && r.scadenza >= dataOggi && !prossima.has(r.abbonamentoId))
      prossima.set(r.abbonamentoId, r.scadenza);

  const annuo = (a: (typeof lista)[number]["a"]) =>
    (a.importoRataCent * 12) / MESI_PER_PERIODICITA[a.periodicita as Periodicita];
  const attivi = lista.filter(({ a }) => a.stato === "attivo");
  const arr = Math.round(attivi.reduce((s, { a }) => s + annuo(a), 0));
  const arrLordo = Math.round(
    attivi.reduce(
      (s, { a, rs }) =>
        s + (prezzoVisualizzato(Math.round(annuo(a)), regoleDa(rs)).lordoCent ?? annuo(a)),
      0,
    ),
  );
  const entro60 = aggiungiMesi(dataOggi, 2);
  const rinnovi = attivi.filter(({ a }) => (prossima.get(a.id) ?? "9999") <= entro60).length;

  const righe: RigaAbbonamento[] = lista.map(({ a, cliente, rs }) => ({
    id: a.id,
    cliente,
    descrizione: a.descrizione,
    emittente: rs.nome,
    periodicita: a.periodicita,
    importoCent: a.importoRataCent,
    lordoCent: prezzoVisualizzato(a.importoRataCent, regoleDa(rs)).lordoCent,
    stato: a.stato,
    prossima: prossima.get(a.id) ?? null,
  }));

  return (
    <>
      <PageHeader
        titolo="Abbonamenti"
        descrizione="Canoni ricorrenti: ogni abbonamento genera le rate in anticipo sullo scadenzario. Sospendere o cessare annulla le rate future ancora da incassare."
        azioni={<AbbonamentoModal clienti={clienti} emittenti={emittenti} />}
      />
      <StatsRow
        dati={[
          {
            etichetta: "Ricavo annuo netto",
            valore: formatEuro(arr),
            nota: `${formatEuro(arrLordo)} con IVA`,
          },
          { etichetta: "Media mensile netta", valore: formatEuro(Math.round(arr / 12)) },
          { etichetta: "Attivi", valore: attivi.length },
          { etichetta: "Rate entro 60 gg", valore: rinnovi },
        ]}
      />
      <AbbonamentiTabella righe={righe} />
    </>
  );
}

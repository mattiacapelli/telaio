import {
  formatEuro,
  prezzoVisualizzato,
  type RegoleFiscali,
  serviziRicorrenti,
  staAccettato,
  valoreRicorrenteAnnuo,
} from "@telaio/core";
import {
  clientiRef,
  desc,
  eq,
  getDb,
  inArray,
  isNull,
  preventivi,
  preventivoRighe,
  ragioniSociali,
} from "@telaio/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { oggi } from "@/lib/date";
import { PreventiviTabella, type RigaPreventivo } from "./preventivi-tabella";

export const metadata = { title: "Preventivi" };
export const dynamic = "force-dynamic";

const ETICHETTE: Record<string, string> = {
  bozza: "Bozza",
  inviato: "Inviato",
  in_revisione: "In revisione",
  accettato: "Accettato",
  accettato_parzialmente: "Accettato parzialmente",
  rifiutato: "Rifiutato",
  scaduto: "Scaduto",
};

const giorniA = (data: string, da: string) =>
  Math.ceil(
    (new Date(`${data}T00:00:00Z`).getTime() - new Date(`${da}T00:00:00Z`).getTime()) / 86400000,
  );

export default async function PreventiviPage() {
  const db = getDb();
  const dataOggi = oggi();
  const [emittenti, tutti] = await Promise.all([
    db
      .select({ id: ragioniSociali.id, nome: ragioniSociali.nome })
      .from(ragioniSociali)
      .where(isNull(ragioniSociali.deletedAt)),
    db
      .select({
        p: preventivi,
        emittente: ragioniSociali.nome,
        cliente: clientiRef.nome,
      })
      .from(preventivi)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, preventivi.ragioneSocialeId))
      .leftJoin(clientiRef, eq(clientiRef.id, preventivi.clienteRefId))
      .where(isNull(preventivi.deletedAt))
      .orderBy(desc(preventivi.createdAt))
      .limit(500),
  ]);
  const righePerPreventivo = new Map<string, (typeof preventivoRighe.$inferSelect)[]>();
  if (tutti.length > 0) {
    const tutteLeRighe = await db
      .select()
      .from(preventivoRighe)
      .where(
        inArray(
          preventivoRighe.preventivoId,
          tutti.map(({ p }) => p.id),
        ),
      )
      .orderBy(preventivoRighe.posizione);
    for (const r of tutteLeRighe) {
      const l = righePerPreventivo.get(r.preventivoId) ?? [];
      l.push(r);
      righePerPreventivo.set(r.preventivoId, l);
    }
  }

  const inScadenza = (p: (typeof tutti)[number]["p"]) =>
    p.stato === "inviato" &&
    !!p.validoFino &&
    giorniA(p.validoFino, dataOggi) <= 7 &&
    giorniA(p.validoFino, dataOggi) >= 0;
  const attesa = tutti.filter(({ p }) => p.stato === "inviato" || p.stato === "in_revisione");
  const attesaNetto = attesa.reduce((s, { p }) => s + p.imponibileCent, 0);
  const attesaLordo = attesa.reduce((s, { p }) => s + p.totaleCent, 0);
  const limite = new Date(Date.now() - 90 * 86400000);
  const chiusi = tutti.filter(
    ({ p }) =>
      p.createdAt >= limite &&
      ["accettato", "accettato_parzialmente", "rifiutato", "scaduto"].includes(p.stato),
  );
  const accettazione = chiusi.length
    ? Math.round((chiusi.filter(({ p }) => staAccettato(p.stato)).length / chiusi.length) * 100)
    : null;

  const righe: RigaPreventivo[] = tutti.map(({ p, emittente, cliente }) => {
    const regole = p.snapshot.regole as unknown as RegoleFiscali;
    const rr = righePerPreventivo.get(p.id) ?? [];
    const accettato = staAccettato(p.stato);
    const decisioni = rr.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      quantita: r.quantita,
      prezzoUnitarioCent: r.prezzoUnitarioCent,
      scontoBp: r.scontoBp,
      gruppoAlternativaId: r.gruppoAlternativaId,
      descrizione: r.descrizione,
      accettata: r.accettata,
    }));
    const proposto = rr
      .filter((r) => r.tipo === "una_tantum")
      .reduce((s, r) => s + r.importoCent, 0);
    // Accettato: l'importo davvero accettato; altrimenti quello proposto.
    const netto = accettato ? (p.imponibileAccettatoCent ?? proposto) : proposto;
    const ut = prezzoVisualizzato(netto, regole);
    const scad = inScadenza(p);
    return {
      id: p.id,
      numero: p.numero,
      cliente,
      oggetto: p.oggetto,
      emittente,
      unaTantumCent: ut.nettoCent,
      unaTantumLordoCent: ut.lordoCent,
      unaTantumPropostaCent: accettato && netto !== proposto ? proposto : null,
      servizi: serviziRicorrenti(decisioni),
      valoreAnnuoCent: valoreRicorrenteAnnuo(decisioni, accettato),
      stato: scad ? "in_scadenza" : p.stato,
      etichettaStato: scad
        ? `Scade tra ${giorniA(p.validoFino ?? dataOggi, dataOggi)} gg`
        : (ETICHETTE[p.stato] ?? p.stato),
      data: p.createdAt.toISOString().slice(0, 10),
    };
  });

  return (
    <>
      <PageHeader
        titolo="Preventivi"
        descrizione="Ogni preventivo parte da un listino ed è emesso da una delle tue ragioni sociali."
        azioni={
          <>
            <Button asChild>
              <Link href="/preventivi/nuovo">Nuovo preventivo</Link>
            </Button>
          </>
        }
      />
      <StatsRow
        dati={[
          { etichetta: "Bozze", valore: tutti.filter(({ p }) => p.stato === "bozza").length },
          {
            etichetta: "In attesa",
            valore: attesa.length,
            nota: `${formatEuro(attesaNetto)} netto · ${formatEuro(attesaLordo)} con IVA`,
          },
          {
            etichetta: "Accettati",
            valore: tutti.filter(({ p }) => p.stato === "accettato").length,
          },
          {
            etichetta: "Accettati parzialmente",
            valore: tutti.filter(({ p }) => p.stato === "accettato_parzialmente").length,
          },
          {
            etichetta: "Accettazione 90 gg",
            valore: accettazione === null ? "—" : `${accettazione}%`,
          },
        ]}
      />
      <PreventiviTabella righe={righe} emittenti={emittenti.map((e) => e.nome)} />
    </>
  );
}

import { formatEuro, prezzoVisualizzato, type RegoleFiscali } from "@telaio/core";
import { clientiRef, desc, eq, getDb, isNull, preventivi, ragioniSociali } from "@telaio/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { oggi } from "@/lib/date";
import { sqlCanoneAnnuo, sqlUnaTantum } from "@/lib/queries";
import { PreventiviTabella, type RigaPreventivo } from "./preventivi-tabella";

export const metadata = { title: "Preventivi" };
export const dynamic = "force-dynamic";

const ETICHETTE: Record<string, string> = {
  bozza: "Bozza",
  inviato: "Inviato",
  in_revisione: "In revisione",
  accettato: "Accettato",
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
        unaTantum: sqlUnaTantum,
        canone: sqlCanoneAnnuo,
      })
      .from(preventivi)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, preventivi.ragioneSocialeId))
      .leftJoin(clientiRef, eq(clientiRef.id, preventivi.clienteRefId))
      .where(isNull(preventivi.deletedAt))
      .orderBy(desc(preventivi.createdAt))
      .limit(500),
  ]);

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
    ({ p }) => p.createdAt >= limite && ["accettato", "rifiutato", "scaduto"].includes(p.stato),
  );
  const accettazione = chiusi.length
    ? Math.round((chiusi.filter(({ p }) => p.stato === "accettato").length / chiusi.length) * 100)
    : null;

  const righe: RigaPreventivo[] = tutti.map(({ p, emittente, cliente, unaTantum, canone }) => {
    const regole = p.snapshot.regole as unknown as RegoleFiscali;
    const ut = prezzoVisualizzato(unaTantum, regole);
    const cn = prezzoVisualizzato(canone, regole);
    const scad = inScadenza(p);
    return {
      id: p.id,
      numero: p.numero,
      cliente,
      oggetto: p.oggetto,
      emittente,
      unaTantumCent: ut.nettoCent,
      unaTantumLordoCent: ut.lordoCent,
      canoneCent: cn.nettoCent,
      canoneLordoCent: cn.lordoCent,
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
            <Button asChild variant="secondary">
              <Link href="/configuratore">Preventivo rapido</Link>
            </Button>
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
            etichetta: "Accettazione 90 gg",
            valore: accettazione === null ? "—" : `${accettazione}%`,
          },
        ]}
      />
      <PreventiviTabella righe={righe} emittenti={emittenti.map((e) => e.nome)} />
    </>
  );
}

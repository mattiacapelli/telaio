import { formatEuro } from "@telaio/core";
import {
  clientiRef,
  conti,
  desc,
  eq,
  fatture,
  getDb,
  incassi,
  isNull,
  ragioniSociali,
  rate,
} from "@telaio/db";
import Link from "next/link";
import { IncassoModal } from "@/components/domain/incasso-modal";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { oggi } from "@/lib/date";
import { IncassiTabella, type RigaIncasso } from "./incassi-tabella";

export const metadata = { title: "Incassi" };
export const dynamic = "force-dynamic";

const NOME_METODO = { bonifico: "Bonifico", contante: "Contante", carta: "Carta" } as const;

export default async function IncassiPage() {
  const db = getDb();
  const inizioMese = `${oggi().slice(0, 7)}-01`;
  const [lista, contiAttivi] = await Promise.all([
    db
      .select({
        i: incassi,
        conto: conti.nome,
        tipo: conti.tipo,
        cliente: clientiRef.nome,
        emittente: ragioniSociali.nome,
        fattura: fatture.numero,
        rataDescr: rate.descrizione,
      })
      .from(incassi)
      .innerJoin(conti, eq(conti.id, incassi.contoId))
      .leftJoin(clientiRef, eq(clientiRef.id, incassi.clienteRefId))
      .leftJoin(ragioniSociali, eq(ragioniSociali.id, incassi.ragioneSocialeId))
      .leftJoin(fatture, eq(fatture.id, incassi.fatturaId))
      .leftJoin(rate, eq(rate.id, incassi.rataId))
      .where(isNull(incassi.deletedAt))
      .orderBy(desc(incassi.data), desc(incassi.createdAt))
      .limit(500),
    db.select({ id: conti.id, nome: conti.nome }).from(conti).where(isNull(conti.deletedAt)),
  ]);

  const delMese = lista.filter(({ i }) => i.data >= inizioMese);
  const somma = (xs: typeof lista) => xs.reduce((s, { i }) => s + i.importoCent, 0);
  const per = (t: keyof typeof NOME_METODO) => delMese.filter((x) => x.tipo === t);
  const righe: RigaIncasso[] = lista.map(
    ({ i, conto, tipo, cliente, emittente, fattura, rataDescr }) => ({
      id: i.id,
      data: i.data,
      cliente,
      causale: i.descrizione ?? rataDescr ?? "Incasso",
      emittente,
      fattura,
      conto,
      metodo: tipo,
      importoCent: i.importoCent,
    }),
  );

  return (
    <>
      <PageHeader
        titolo="Incassi"
        descrizione="Ogni incasso va su un conto preciso e chiude una rata o una fattura. Genera anche l'entrata in prima nota."
        azioni={
          <>
            <Button asChild variant="secondary">
              <Link href="/incasso-rapido">Da telefono</Link>
            </Button>
            <IncassoModal conti={contiAttivi} trigger="Registra incasso" />
          </>
        }
      />
      <StatsRow
        dati={[
          {
            etichetta: "Totale mese",
            valore: formatEuro(somma(delMese)),
            nota: `${delMese.length} moviment${delMese.length === 1 ? "o" : "i"}`,
          },
          ...(["bonifico", "contante", "carta"] as const).map((t) => ({
            etichetta: NOME_METODO[t],
            valore: formatEuro(somma(per(t))),
            nota: [...new Set(per(t).map((x) => x.conto))].join(", ") || "nessun movimento",
          })),
        ]}
      />
      <IncassiTabella righe={righe} />
    </>
  );
}

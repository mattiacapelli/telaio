import { aggiungiMesi } from "@telaio/core";
import { conti, type Database, isNull, movimenti, preventivi, rate, sql } from "@telaio/db";
import { oggi } from "../date";
import { saldiConti } from "./movimenti";

const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const MESI_LUNGHI = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];
/** Peso dei preventivi in attesa: stima prudente, finché non c'è uno storico di accettazione. */
export const PROBABILITA = 0.5;

export interface MeseCashFlow {
  ym: string;
  label: string;
  lungo: string;
  certi: number;
  pesati: number;
  uscite: number;
  saldo: number;
}

/**
 * Previsione di cassa a sei mesi: liquidità di oggi + rate non incassate + preventivi in attesa
 * (pesati) − media mensile delle uscite degli ultimi tre mesi di prima nota.
 */
export async function calcolaCashFlow(
  db: Database,
  opzioni: { conPreventivi?: boolean; prudente?: boolean } = {},
) {
  const conPreventivi = opzioni.conPreventivi ?? true;
  const prudente = opzioni.prudente ?? false;
  const dataOggi = oggi();
  const primo = `${dataOggi.slice(0, 7)}-01`;
  const mesi = Array.from({ length: 6 }, (_, i) => {
    const d = aggiungiMesi(primo, i + 1);
    return {
      ym: d.slice(0, 7),
      label: MESI[Number(d.slice(5, 7)) - 1] ?? "",
      lungo: MESI_LUNGHI[Number(d.slice(5, 7)) - 1] ?? "",
    };
  });
  const treMesiFa = aggiungiMesi(primo, -3);

  const [saldi, contiAttivi, dovute, attesa, spese] = await Promise.all([
    saldiConti(db),
    db.select({ id: conti.id }).from(conti).where(isNull(conti.deletedAt)),
    db.execute<{ ym: string; tot: number }>(sql`
      select to_char(case when r.scadenza < ${primo}::date then ${primo}::date else r.scadenza end,'YYYY-MM') ym,
             sum(r.importo_cent - coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = r.id and i.deleted_at is null),0))::int tot
      from ${rate} r where r.stato in ('da_incassare','parziale','scaduta') group by 1`),
    db.execute<{ ym: string; tot: number }>(sql`
      select to_char(coalesce(p.valido_fino, ${primo}::date + interval '1 month'),'YYYY-MM') ym, sum(p.totale_cent)::int tot
      from ${preventivi} p where p.stato in ('inviato','in_revisione') and p.deleted_at is null group by 1`),
    db.execute<{ tot: number }>(sql`
      select coalesce(sum(m.importo_cent),0)::int tot from ${movimenti} m
      where m.tipo = 'uscita' and m.deleted_at is null and m.data >= ${treMesiFa} and m.data < ${primo}`),
  ]);

  const liquidita = [...saldi.values()].reduce((a, b) => a + b, 0);
  const usciteMese = Math.round((spese[0]?.tot ?? 0) / 3);
  const perMese = (righe: { ym: string; tot: number }[], ym: string) =>
    righe.filter((r) => r.ym === ym).reduce((s, r) => s + r.tot, 0);

  let saldo = liquidita;
  const serie: MeseCashFlow[] = mesi.map((m, i) => {
    // Scenario prudente: gli incassi arrivano con un mese di ritardo.
    const certi = perMese(dovute, prudente ? (mesi[i - 1]?.ym ?? "") : m.ym);
    const pesati = conPreventivi ? Math.round(perMese(attesa, m.ym) * PROBABILITA) : 0;
    saldo += certi + pesati - usciteMese;
    return { ...m, certi, pesati, uscite: usciteMese, saldo };
  });
  return { liquidita, nConti: contiAttivi.length, serie };
}

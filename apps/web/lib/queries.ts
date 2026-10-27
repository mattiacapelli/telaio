import { preventivi, sql } from "@telaio/db";

/** Importo una tantum (netto) di un preventivo, dalle sue righe. */
export const sqlUnaTantum = sql<number>`coalesce((select sum(importo_cent) from preventivo_righe where preventivo_id = ${preventivi.id} and tipo = 'una_tantum'),0)::int`;

/** Canone annuo (netto) di un preventivo: i mensili contano dodici volte. */
export const sqlCanoneAnnuo = sql<number>`coalesce((select sum(case tipo when 'canone_annuo' then importo_cent when 'canone_mensile' then importo_cent * 12 else 0 end) from preventivo_righe where preventivo_id = ${preventivi.id}),0)::int`;

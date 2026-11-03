import { preventivi, sql } from "@telaio/db";

/**
 * Importo una tantum (netto) di un preventivo: quello accettato se è stato accettato, altrimenti
 * quello proposto. Conta le sole righe una tantum.
 */
export const sqlUnaTantum = sql<number>`coalesce(case when ${preventivi.stato} in ('accettato','accettato_parzialmente') and ${preventivi.imponibileAccettatoCent} is not null then ${preventivi.imponibileAccettatoCent} else (select sum(importo_cent) from preventivo_righe where preventivo_id = ${preventivi.id} and tipo = 'una_tantum') end,0)::int`;

/**
 * Valore ricorrente annualizzato (netto) di un preventivo: un indicatore, non un importo fatturabile.
 * Se accettato conta i soli canoni accettati; altrimenti un solo importo per servizio, la più economica
 * tra le alternative annuale/mensile (mai la somma). Il mensile conta dodici volte.
 */
export const sqlCanoneAnnuo = sql<number>`coalesce((select sum(x.v)::int from (select case when ${preventivi.stato} in ('accettato','accettato_parzialmente') then sum(case when r.accettata then r.annuo else 0 end) else min(r.annuo) end as v from (select id, gruppo_alternativa_id, accettata, case tipo when 'canone_mensile' then importo_cent * 12 else importo_cent end as annuo from preventivo_righe where preventivo_id = ${preventivi.id} and tipo <> 'una_tantum') r group by coalesce(r.gruppo_alternativa_id::text, r.id::text)) x),0)::int`;

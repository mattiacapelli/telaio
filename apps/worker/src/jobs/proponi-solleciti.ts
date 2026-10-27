import { bozzaSollecito, serveSollecito } from "@telaio/core";
import {
  and,
  clientiRef,
  type Database,
  eq,
  inArray,
  ragioniSociali,
  rate,
  solleciti,
  sql,
} from "@telaio/db";
import { oggi } from "./genera-rate";

/**
 * Propone i solleciti per le rate scadute e non incassate.
 * NON invia mai nulla: crea bozze in stato `da_confermare` che l'utente rivede,
 * completa col destinatario e conferma dallo scadenzario. Idempotente: non propone
 * un nuovo sollecito finché ce n'è uno in attesa o non sono passati 7 giorni dall'ultimo inviato.
 */
export async function proponiSolleciti(db: Database, dataOggi = oggi()) {
  const scadute = await db
    .select({ r: rate, cliente: clientiRef.nome, emittente: ragioniSociali.nome })
    .from(rate)
    .innerJoin(ragioniSociali, eq(ragioniSociali.id, rate.ragioneSocialeId))
    .leftJoin(clientiRef, eq(clientiRef.id, rate.clienteRefId))
    .where(
      and(
        inArray(rate.stato, ["da_incassare", "scaduta", "parziale"]),
        sql`${rate.scadenza} < ${dataOggi}`,
      ),
    );

  let proposti = 0;
  for (const { r, cliente, emittente } of scadute) {
    const storico = await db.select().from(solleciti).where(eq(solleciti.rataId, r.id));
    const inviati = storico.filter((s) => s.stato === "inviato");
    const ultimo =
      inviati
        .map((s) => s.inviatoIl?.toISOString() ?? "")
        .sort()
        .at(-1) ?? null;
    const ok = serveSollecito({
      inviati: inviati.length,
      daConfermare: storico.filter((s) => s.stato === "da_confermare").length,
      ultimoInvioIso: ultimo,
      oggi: dataOggi,
    });
    if (!ok) continue;

    const livello = inviati.length + 1;
    const bozza = bozzaSollecito({
      livello,
      cliente: cliente ?? "cliente",
      emittente,
      descrizioneRata: r.descrizione,
      importoCent: r.importoCent,
      scadenza: r.scadenza,
      oggi: dataOggi,
    });
    await db.insert(solleciti).values({
      rataId: r.id,
      livello,
      programmatoIl: new Date(),
      stato: "da_confermare",
      oggetto: bozza.oggetto,
      corpo: bozza.corpo,
    });
    proposti++;
  }
  return { rateScadute: scadute.length, bozzeProposte: proposti };
}

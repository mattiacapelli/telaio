import {
  calcolaTotali,
  puoTransirePreventivo,
  type RegoleFiscali,
  type StatoPreventivo,
} from "@telaio/core";
import {
  and,
  assegnaNumero,
  type Database,
  eq,
  isNull,
  preventivi,
  preventivoRighe,
  ragioniSociali,
} from "@telaio/db";
import { regoleDa } from "../regole";

/**
 * Cambia lo stato di un preventivo rispettando le transizioni del dominio.
 * Alla prima uscita dalla bozza (invio) assegna il numero e congela emittente, regole e totali.
 */
export async function cambiaStatoPreventivo(db: Database, id: string, nuovo: StatoPreventivo) {
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(preventivi)
      .where(and(eq(preventivi.id, id), isNull(preventivi.deletedAt)))
      .for("update");
    if (!p) throw new Error("Preventivo non trovato");
    if (!puoTransirePreventivo(p.stato, nuovo))
      throw new Error(`Non si può passare da «${p.stato}» a «${nuovo}»`);

    if (p.stato === "bozza" && nuovo === "inviato") {
      const [rs] = await tx
        .select()
        .from(ragioniSociali)
        .where(eq(ragioniSociali.id, p.ragioneSocialeId));
      if (!rs) throw new Error("Ragione sociale non trovata");
      const regole: RegoleFiscali = regoleDa(rs);
      const righe = (
        await tx.select().from(preventivoRighe).where(eq(preventivoRighe.preventivoId, id))
      ).filter((r) => r.tipo === "una_tantum");
      const t = calcolaTotali(righe, regole);
      const { numero } = await assegnaNumero(tx, {
        ragioneSocialeId: rs.id,
        tipo: "preventivo",
        anno: p.anno,
        formato: rs.formatoPreventivo,
      });
      await tx
        .update(preventivi)
        .set({
          stato: nuovo,
          numero,
          snapshot: {
            ...p.snapshot,
            emittente: {
              id: rs.id,
              nome: rs.nome,
              partitaIva: rs.partitaIva,
              codiceFiscale: rs.codiceFiscale,
              indirizzo: rs.indirizzo,
              citta: rs.citta,
            },
            regole: { ...regole },
          },
          imponibileCent: t.imponibileCent,
          ivaCent: t.ivaCent,
          bolloCent: t.bolloCent,
          totaleCent: t.totaleCent,
        })
        .where(eq(preventivi.id, id));
      return { numero };
    }
    await tx.update(preventivi).set({ stato: nuovo }).where(eq(preventivi.id, id));
    return { numero: p.numero };
  });
}

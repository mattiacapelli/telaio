import {
  calcolaTotali,
  puoTransirePreventivo,
  type RegoleFiscali,
  type StatoPreventivo,
  sceltaTotale,
  staAccettato,
} from "@telaio/core";
import {
  accettaPreventivo,
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
import { emettiEvento } from "../webhooks";

/**
 * Cambia lo stato di un preventivo rispettando le transizioni del dominio.
 * Alla prima uscita dalla bozza (invio) assegna il numero e congela emittente, regole e totali.
 */
export async function cambiaStatoPreventivo(db: Database, id: string, nuovo: StatoPreventivo) {
  if (staAccettato(nuovo)) return accettaConScelta(db, id, nuovo);
  const esito = await cambiaStatoInTransazione(db, id, nuovo);
  await emettiEvento(db, "preventivo.stato", {
    preventivoId: id,
    stato: nuovo,
    numero: esito.numero,
  });
  return esito;
}

/**
 * L'accettazione ha una sua procedura (`accettaPreventivo`, con la scelta delle righe). Da qui, per
 * i chiamanti che passano solo lo stato (API, MCP), vale solo l'accettazione totale: serve che non
 * ci siano alternative annuale/mensile da scegliere.
 */
async function accettaConScelta(db: Database, id: string, nuovo: StatoPreventivo) {
  if (nuovo !== "accettato")
    throw new Error(
      "L'accettazione parziale richiede di scegliere le righe: usa la finestra di accettazione",
    );
  const righe = await db.select().from(preventivoRighe).where(eq(preventivoRighe.preventivoId, id));
  const scelta = sceltaTotale(
    righe.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      quantita: r.quantita,
      prezzoUnitarioCent: r.prezzoUnitarioCent,
      scontoBp: r.scontoBp,
      gruppoAlternativaId: r.gruppoAlternativaId,
    })),
  );
  if (Object.keys(scelta.gruppi).length > 0)
    throw new Error(
      "Il preventivo ha alternative mensile/annuale da scegliere: registra l'accettazione dalla pagina del preventivo",
    );
  const esito = await accettaPreventivo(db, id, { scelta });
  await emettiEvento(db, "preventivo.stato", {
    preventivoId: id,
    stato: esito.stato,
    numero: esito.numero,
  });
  return { numero: esito.numero };
}

async function cambiaStatoInTransazione(db: Database, id: string, nuovo: StatoPreventivo) {
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
    // Rifiutato: nessuna riga è accettata. Le righe restano, con l'esito registrato.
    if (nuovo === "rifiutato")
      await tx
        .update(preventivoRighe)
        .set({ accettata: false })
        .where(eq(preventivoRighe.preventivoId, id));
    return { numero: p.numero };
  });
}

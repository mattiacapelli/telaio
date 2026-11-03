import { calcolaTotali, importoRiga, type RegoleFiscali, staAccettato } from "@telaio/core";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database } from "./client";
import { violazioneUnivoco } from "./errori";
import { fatturaRighe, fatture, preventivi, preventivoRighe } from "./schema";

/**
 * Bozza di fattura dalle sole prestazioni una tantum **accettate** di un preventivo accettato (anche
 * parzialmente). Esclude le righe rifiutate e tutti i canoni: gli abbonamenti hanno il loro flusso.
 * I totali si ricalcolano sulle righe fatturate con le regole fiscali congelate nel preventivo.
 * Una sola fattura per preventivo: il preventivo è bloccato nella transazione e un indice univoco
 * parziale del database lo garantisce anche in caso di richieste concorrenti.
 */
export async function creaFatturaDaPreventivo(
  db: Database,
  preventivoId: string,
): Promise<{ id: string }> {
  try {
    return await db.transaction(async (tx) => {
      const [p] = await tx
        .select()
        .from(preventivi)
        .where(and(eq(preventivi.id, preventivoId), isNull(preventivi.deletedAt)))
        .for("update");
      if (!p) throw new Error("Preventivo non trovato");
      if (!staAccettato(p.stato))
        throw new Error("Si può fatturare solo un preventivo accettato, anche parzialmente");
      const [esistente] = await tx
        .select({ id: fatture.id })
        .from(fatture)
        .where(
          and(
            eq(fatture.preventivoId, p.id),
            eq(fatture.origine, "preventivo"),
            isNull(fatture.deletedAt),
          ),
        );
      if (esistente) throw new Error("Questo preventivo ha già una fattura");

      const righe = (
        await tx
          .select()
          .from(preventivoRighe)
          .where(eq(preventivoRighe.preventivoId, p.id))
          .orderBy(asc(preventivoRighe.posizione))
      ).filter((r) => r.tipo === "una_tantum" && r.accettata === true);
      if (righe.length === 0)
        throw new Error(
          "Nessuna prestazione una tantum accettata da fatturare. Gli abbonamenti si gestiscono da Abbonamenti.",
        );

      const regole = p.snapshot.regole as unknown as RegoleFiscali;
      const t = calcolaTotali(righe, regole);
      const [f] = await tx
        .insert(fatture)
        .values({
          ragioneSocialeId: p.ragioneSocialeId,
          clienteRefId: p.clienteRefId,
          origine: "preventivo",
          preventivoId: p.id,
          anno: new Date().getFullYear(),
          snapshot: p.snapshot,
          imponibileCent: t.imponibileCent,
          ivaCent: t.ivaCent,
          bolloCent: t.bolloCent,
          totaleCent: t.totaleCent,
          ritenutaCent: t.ritenutaCent,
          ivaSplitCent: t.ivaSplitCent,
          nettoDaPagareCent: t.nettoDaPagareCent,
        })
        .returning({ id: fatture.id });
      if (!f) throw new Error("Creazione fattura fallita");
      await tx.insert(fatturaRighe).values(
        righe.map((r, i) => ({
          fatturaId: f.id,
          posizione: i,
          descrizione: r.descrizione,
          quantita: r.quantita,
          prezzoUnitarioCent: r.prezzoUnitarioCent,
          scontoBp: r.scontoBp,
          importoCent: importoRiga(r),
        })),
      );
      return f;
    });
  } catch (e) {
    if (violazioneUnivoco(e, "fatture_preventivo_uq"))
      throw new Error("Questo preventivo ha già una fattura");
    throw e;
  }
}

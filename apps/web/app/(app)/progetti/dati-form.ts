import {
  and,
  asc,
  clientiRef,
  type Database,
  desc,
  eq,
  inArray,
  isNull,
  preventivi,
  sql,
  users,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";

/** Opzioni dei menu del form progetto: clienti di Twenty, utenti e preventivi collegabili. */
export async function opzioniFormProgetto(
  db: Database,
  attuale?: { clienteTwentyId: string | null; preventivoId: string | null },
) {
  const [clientiTwenty, utenti, accettati] = await Promise.all([
    twentyDaEnv()
      .elencaClienti({ limite: 200 })
      .catch(() => []),
    db.select({ id: users.id, nome: users.name }).from(users).orderBy(asc(users.name)),
    db
      .select({
        id: preventivi.id,
        numero: preventivi.numero,
        oggetto: preventivi.oggetto,
        stato: preventivi.stato,
      })
      .from(preventivi)
      .where(
        and(
          // accettati anche parzialmente, e con almeno una prestazione accettata
          inArray(preventivi.stato, ["accettato", "accettato_parzialmente"]),
          sql`exists (select 1 from preventivo_righe r where r.preventivo_id = ${preventivi.id} and r.accettata)`,
          isNull(preventivi.deletedAt),
        ),
      )
      .orderBy(desc(preventivi.createdAt))
      .limit(200),
  ]);
  const clienti = clientiTwenty.map((c) => ({ id: c.id, nome: c.nome }));
  // Il cliente già collegato resta scelto anche se non rientra nei primi 200 di Twenty.
  if (attuale?.clienteTwentyId && !clienti.some((c) => c.id === attuale.clienteTwentyId)) {
    const [ref] = await db
      .select({ nome: clientiRef.nome })
      .from(clientiRef)
      .where(eq(clientiRef.twentyCompanyId, attuale.clienteTwentyId));
    clienti.unshift({ id: attuale.clienteTwentyId, nome: ref?.nome ?? "Cliente attuale" });
  }
  const preventiviOpz = accettati.map((p) => ({
    id: p.id,
    etichetta: `${p.numero ?? "Bozza"} · ${p.oggetto}${p.stato === "accettato_parzialmente" ? " (parziale)" : ""}`,
  }));
  return { clienti, utenti, preventivi: preventiviOpz };
}

import {
  and,
  asc,
  clientiRef,
  type Database,
  desc,
  eq,
  isNull,
  preventivi,
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
      .select({ id: preventivi.id, numero: preventivi.numero, oggetto: preventivi.oggetto })
      .from(preventivi)
      .where(and(eq(preventivi.stato, "accettato"), isNull(preventivi.deletedAt)))
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
    etichetta: `${p.numero ?? "Bozza"} · ${p.oggetto}`,
  }));
  return { clienti, utenti, preventivi: preventiviOpz };
}

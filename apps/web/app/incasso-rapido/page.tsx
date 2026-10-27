import { clientiRef, conti, eq, getDb, inArray, isNull, rate } from "@telaio/db";
import { IncassoRapido } from "@/components/domain/incasso-rapido";
import { oggi } from "@/lib/date";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Incasso al volo" };
export const dynamic = "force-dynamic";

export default async function IncassoRapidoPage() {
  await requireSession();
  const db = getDb();
  const [contiAttivi, aperte] = await Promise.all([
    db
      .select({
        id: conti.id,
        nome: conti.nome,
        tipo: conti.tipo,
        ragioneSocialeId: conti.ragioneSocialeId,
      })
      .from(conti)
      .where(isNull(conti.deletedAt)),
    db
      .select({ r: rate, cliente: clientiRef.nome, clienteId: clientiRef.id })
      .from(rate)
      .innerJoin(clientiRef, eq(clientiRef.id, rate.clienteRefId))
      .where(inArray(rate.stato, ["da_incassare", "scaduta", "parziale"]))
      .orderBy(rate.scadenza)
      .limit(100),
  ]);
  const dataOggi = oggi();
  const clienti = new Map<string, { id: string; nome: string }>();
  for (const { cliente, clienteId } of aperte)
    clienti.set(clienteId, { id: clienteId, nome: cliente });
  return (
    <IncassoRapido
      conti={contiAttivi}
      clienti={[...clienti.values()]}
      rate={aperte.map(({ r, clienteId }) => ({
        id: r.id,
        clienteId,
        descrizione: r.descrizione,
        importoCent: r.importoCent,
        scaduta: r.scadenza < dataOggi,
        ragioneSocialeId: r.ragioneSocialeId,
      }))}
    />
  );
}

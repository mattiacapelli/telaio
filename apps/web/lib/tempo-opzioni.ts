import { clientiRef, type Database, isNull, ragioniSociali, riepilogoMonteOre } from "@telaio/db";
import type { OpzioniTempo } from "@/components/domain/tempo-modal";

/** Clienti e contratti attivi da proporre nei form del tempo. */
export async function opzioniTempo(db: Database, oggi: string): Promise<OpzioniTempo> {
  const [clienti, attivi] = await Promise.all([
    db
      .select({ id: clientiRef.id, nome: clientiRef.nome })
      .from(clientiRef)
      .where(isNull(clientiRef.deletedAt))
      .orderBy(clientiRef.nome),
    riepilogoMonteOre(db, oggi, { stato: "attivo" }),
  ]);
  return {
    clienti,
    contratti: attivi.map((r) => ({
      id: r.contratto.id,
      nome: `${r.cliente} · ${r.contratto.nome}`,
    })),
  };
}

/** Le ragioni sociali tra cui scegliere l'emittente di un contratto a ore. */
export async function elencaEmittenti(db: Database) {
  return db
    .select({ id: ragioniSociali.id, nome: ragioniSociali.nome })
    .from(ragioniSociali)
    .where(isNull(ragioniSociali.deletedAt))
    .orderBy(ragioniSociali.nome);
}

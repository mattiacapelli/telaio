import {
  asc,
  type Database,
  eq,
  isNull,
  listini,
  listinoBasi,
  listinoModuli,
  moduloBasi,
  ragioniSociali,
} from "@telaio/db";
import type { ListinoCfg } from "@/app/(app)/configuratore/configuratore";
import { regoleDa } from "./regole";

/** Listini con basi, moduli e compatibilità, nella forma usata da configuratore ed editor. */
export async function caricaListiniCfg(db: Database): Promise<ListinoCfg[]> {
  const [elenco, basi, moduli, assegn] = await Promise.all([
    db
      .select({ l: listini, rs: ragioniSociali })
      .from(listini)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, listini.ragioneSocialeId))
      .where(isNull(listini.deletedAt))
      .orderBy(asc(listini.createdAt)),
    db
      .select()
      .from(listinoBasi)
      .where(isNull(listinoBasi.deletedAt))
      .orderBy(asc(listinoBasi.ordine)),
    db
      .select()
      .from(listinoModuli)
      .where(isNull(listinoModuli.deletedAt))
      .orderBy(asc(listinoModuli.ordine)),
    db.select().from(moduloBasi),
  ]);
  const voce = (v: (typeof basi)[number]) => ({
    id: v.id,
    nome: v.nome,
    descrizione: v.descrizione,
    unaTantumCent: v.unaTantumCent,
    canoneAnnuoCent: v.canoneAnnuoCent,
    canoneMensileCent: v.canoneMensileCent,
  });
  return elenco
    .filter(({ rs }) => !rs.deletedAt)
    .map(({ l, rs }) => ({
      id: l.id,
      nome: l.nome,
      ragioneSocialeId: rs.id,
      ragioneSociale: rs.nome,
      regole: regoleDa(rs),
      basi: basi.filter((b) => b.listinoId === l.id).map(voce),
      moduli: moduli
        .filter((m) => m.listinoId === l.id)
        .map((m) => ({
          ...voce(m),
          baseIds: assegn.filter((a) => a.moduloId === m.id).map((a) => a.baseId),
        })),
    }));
}

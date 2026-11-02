import type { RegoleFiscali } from "@telaio/core";
import { asc, type Database, isNull, ragioniSociali } from "@telaio/db";
import { caricaListiniCfg, type ListinoCfg } from "./listini-cfg";
import { regoleDa } from "./regole";

export interface EmittenteCfg {
  id: string;
  nome: string;
  regole: RegoleFiscali;
  /** Listini dell'emittente: possono mancare, il preventivo si compone anche a mano. */
  listini: ListinoCfg[];
}

/** Tutte le ragioni sociali attive con i loro listini (se ne hanno). */
export async function caricaEmittentiCfg(db: Database): Promise<EmittenteCfg[]> {
  const [elenco, listini] = await Promise.all([
    db
      .select()
      .from(ragioniSociali)
      .where(isNull(ragioniSociali.deletedAt))
      .orderBy(asc(ragioniSociali.createdAt)),
    caricaListiniCfg(db),
  ]);
  return elenco.map((rs) => ({
    id: rs.id,
    nome: rs.nome,
    regole: regoleDa(rs),
    listini: listini.filter((l) => l.ragioneSocialeId === rs.id),
  }));
}

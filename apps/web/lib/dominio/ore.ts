import { formatEuro, formattaOre, importoOreExtraCent } from "@telaio/core";
import {
  type Database,
  eq,
  monteOre,
  registraOreExtraFatturate,
  riepilogoMonteOre,
} from "@telaio/db";
import { formatData } from "../date";
import { creaFatturaLibera } from "./fatture";

/**
 * Crea la bozza di fattura con le ore extra ancora da fatturare di un periodo e le segna come
 * fatturate. Il contratto si blocca per tutta l'operazione: due clic simultanei non fatturano due volte.
 */
export async function fatturaOreExtra(
  db: Database,
  monteOreId: string,
  cicloN: number,
  oggi: string,
): Promise<{ fatturaId: string; minuti: number; importoCent: number }> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as Database;
    await tx
      .select({ id: monteOre.id })
      .from(monteOre)
      .where(eq(monteOre.id, monteOreId))
      .for("update");
    const [r] = await riepilogoMonteOre(t, oggi, { id: monteOreId });
    if (!r) throw new Error("Contratto non trovato");
    const ciclo = r.cicli.find((c) => c.n === cicloN);
    if (!ciclo) throw new Error("Periodo non trovato");
    if (ciclo.daFatturare <= 0)
      throw new Error("Non ci sono ore extra da fatturare in questo periodo");
    const tariffa = r.contratto.tariffaExtraCent;
    if (tariffa <= 0)
      throw new Error("Imposta la tariffa delle ore extra nel contratto per poterle fatturare");
    const importoCent = importoOreExtraCent(ciclo.daFatturare, tariffa);
    const f = await creaFatturaLibera(t, {
      ragioneSocialeId: r.contratto.ragioneSocialeId,
      clienteRefId: r.contratto.clienteRefId,
      occasionale: null,
      note: null,
      righe: [
        {
          descrizione: `Ore extra «${r.contratto.nome}», periodo ${formatData(ciclo.inizio)} - ${formatData(ciclo.fine)}: ${formattaOre(ciclo.daFatturare)} a ${formatEuro(tariffa)}/h`,
          quantita: 1,
          prezzoUnitarioCent: importoCent,
          scontoBp: 0,
        },
      ],
    });
    await registraOreExtraFatturate(t, {
      monteOreId,
      cicloN,
      minuti: ciclo.daFatturare,
      fatturaId: f.id,
    });
    return { fatturaId: f.id, minuti: ciclo.daFatturare, importoCent };
  });
}

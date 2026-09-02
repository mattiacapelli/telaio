import { prisma } from "./prisma";

const FORFETTARIO_DEFAULT = {
  nome: "Forfettario",
  coefficienteRedditivita: 78,
  aliquotaSostitutiva: 15,
  aliquotaInps: 26.07,
  minimaleInps: null as number | null,
};

/**
 * Crea il regime "Forfettario" coi valori normativi correnti se non esiste
 * ancora nessun regime: come per Azienda/ContoIncasso, il primo record del
 * sistema nasce già "predefinito", senza un passo di setup separato.
 */
export async function assicuraRegimeForfettarioDefault() {
  const esistenti = await prisma.regimeFiscale.count({ where: { eliminataIl: null } });
  if (esistenti > 0) return;
  await prisma.regimeFiscale.create({ data: { ...FORFETTARIO_DEFAULT, predefinito: true } });
}

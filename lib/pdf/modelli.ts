import { prisma } from "../prisma";
import { modelloPredefinito, STILE_PREDEFINITO } from "./blocchi";
import type { BloccoPdf, StilePdf } from "./blocchi";

/**
 * Modello da usare per stampare un documento.
 *
 * Se il documento non ne indica uno si prende il predefinito dell'ambito;
 * se non esiste nemmeno quello si usa il modello di base incorporato, così
 * la stampa funziona anche su un'installazione senza modelli configurati.
 */
export async function modelloPerDocumento(
  ambito: "PREVENTIVO" | "CONTRATTO",
  modelloId?: string | null,
): Promise<{ blocchi: BloccoPdf[]; stile: StilePdf; nome: string }> {
  const modello = modelloId
    ? await prisma.modelloPdf.findUnique({ where: { id: modelloId } })
    : await prisma.modelloPdf.findFirst({
        where: { ambito, predefinito: true, eliminataIl: null },
      });

  if (!modello) {
    return {
      blocchi: modelloPredefinito(ambito),
      stile: STILE_PREDEFINITO,
      nome: "Modello di base",
    };
  }

  return {
    blocchi: (modello.blocchi as unknown as BloccoPdf[]) ?? [],
    stile: { ...STILE_PREDEFINITO, ...(modello.stile as unknown as Partial<StilePdf>) },
    nome: modello.nome,
  };
}

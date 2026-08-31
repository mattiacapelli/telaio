import { prisma } from "./prisma";

/**
 * Azienda emittente da usare su un documento.
 *
 * Se il documento non ne indica una si prende la predefinita; se non ce
 * n'è ancora nessuna configurata il PDF stampa comunque, semplicemente
 * senza dati fiscali dell'emittente — meglio un documento incompleto che
 * uno che non si genera.
 */
export async function aziendaPerDocumento(aziendaId?: string | null) {
  if (aziendaId) {
    const a = await prisma.azienda.findUnique({ where: { id: aziendaId } });
    if (a) return a;
  }
  return prisma.azienda.findFirst({
    where: { predefinita: true },
    orderBy: { createdAt: "asc" },
  });
}

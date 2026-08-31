import { prisma } from "./prisma";

/**
 * Titolo del tab del browser: "Sezione · Spazio di lavoro".
 *
 * Il nome dello spazio viene da Impostazioni, non dalla ragione sociale di
 * un'Azienda: deve restare stabile anche cambiando quale azienda è
 * predefinita per la fatturazione.
 */
export async function titoloPagina(sezione: string) {
  const imp = await prisma.impostazioni.findUnique({
    where: { id: 1 },
    select: { nomeSpazio: true },
  });
  return `${sezione} · ${imp?.nomeSpazio ?? "Telaio"}`;
}

/**
 * Nome breve di un record per il title di una pagina di dettaglio.
 *
 * Query minimale, apposta per generateMetadata: la pagina fa già la sua
 * fetch completa, questa non deve duplicarne il peso solo per un titolo.
 */
export async function nomeRecord(
  entita: "ticket" | "attivita" | "cliente" | "contratto" | "preventivo" | "progetto" | "workflow" | "prodotto",
  id: string,
): Promise<string | null> {
  switch (entita) {
    case "ticket": {
      const t = await prisma.ticket.findUnique({ where: { id }, select: { numero: true, titolo: true } });
      return t ? `#${t.numero} ${t.titolo}` : null;
    }
    case "attivita":
      return (await prisma.attivita.findUnique({ where: { id }, select: { titolo: true } }))?.titolo ?? null;
    case "cliente":
      return (await prisma.cliente.findUnique({ where: { id }, select: { ragioneSociale: true } }))?.ragioneSociale ?? null;
    case "contratto":
      return (await prisma.contratto.findUnique({ where: { id }, select: { numero: true } }))?.numero ?? null;
    case "preventivo":
      return (await prisma.preventivo.findUnique({ where: { id }, select: { numero: true } }))?.numero ?? null;
    case "progetto":
      return (await prisma.progetto.findUnique({ where: { id }, select: { nome: true } }))?.nome ?? null;
    case "workflow":
      return (await prisma.workflow.findUnique({ where: { id }, select: { nome: true } }))?.nome ?? null;
    case "prodotto":
      return (await prisma.prodotto.findUnique({ where: { id }, select: { nome: true } }))?.nome ?? null;
  }
}

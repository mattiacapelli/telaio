import { prisma } from "./prisma";
import { n } from "./format";

/**
 * Logica dei contratti.
 *
 * Il monte ore si misura per periodo, non sulla vita del contratto: un canone
 * di 20 h/mese dà 20 ore ogni mese, non 20 in totale. Per questo il consumo
 * si calcola sempre dentro il periodo di competenza.
 */

export const MESI_PERIODO: Record<string, number> = {
  MENSILE: 1,
  TRIMESTRALE: 3,
  SEMESTRALE: 6,
  ANNUALE: 12,
};

/** Numerazione progressiva annuale: CON-2026/003. */
export async function prossimoNumeroContratto() {
  const anno = new Date().getFullYear();
  const esistenti = await prisma.contratto.findMany({
    where: { numero: { contains: `${anno}/` } },
    select: { numero: true },
  });
  const max = esistenti
    .map((e) => Number(e.numero.match(/\/(\d+)$/)?.[1] ?? 0))
    .reduce((a, b) => Math.max(a, b), 0);
  return `CON-${anno}/${String(max + 1).padStart(3, "0")}`;
}

/** Confini del periodo che contiene `quando`, a partire dall'inizio contratto. */
export function periodoDi(
  inizioContratto: Date,
  periodicita: string,
  quando = new Date(),
) {
  const passi = MESI_PERIODO[periodicita] ?? 1;
  const inizio = new Date(inizioContratto);
  // Avanza di un periodo alla volta finché non contiene la data richiesta:
  // così i confini restano ancorati alla data di stipula, non al mese solare.
  while (true) {
    const fine = new Date(inizio);
    fine.setMonth(fine.getMonth() + passi);
    if (quando < fine) {
      return { inizio: new Date(inizio), fine };
    }
    inizio.setMonth(inizio.getMonth() + passi);
  }
}

/**
 * Consumo del monte ore nel periodo corrente.
 *
 * Conta le ore registrate sui ticket del cliente collegati al contratto.
 * Le ore oltre il monte restano fatturabili: il contratto copre fino a lì.
 */
export async function consumoPeriodo(contrattoId: string, quando = new Date()) {
  const c = await prisma.contratto.findUnique({
    where: { id: contrattoId },
    include: { cliente: true },
  });
  if (!c) return null;

  const { inizio, fine } = periodoDi(c.inizioIl, c.periodicita, quando);
  const monte = c.monteOre === null ? null : n(c.monteOre);

  const registrazioni = await prisma.registrazioneOre.findMany({
    where: {
      data: { gte: inizio, lt: fine },
      ticket: { contrattoId },
      eliminataIl: null,
    },
    select: { ore: true },
  });

  const consumate = registrazioni.reduce((s, r) => s + n(r.ore), 0);
  const residue = monte === null ? null : monte - consumate;

  return {
    inizio,
    fine,
    monteOre: monte,
    consumate,
    residue,
    // Sopra il monte: le ore in eccesso vanno fatturate a parte.
    eccedenza: monte !== null && consumate > monte ? consumate - monte : 0,
    tariffaExtra: c.tariffaExtra !== null ? n(c.tariffaExtra) : n(c.cliente.tariffaOraria),
    percentuale: monte && monte > 0 ? Math.min(100, (consumate / monte) * 100) : 0,
  };
}

/**
 * Contratto attivo che copre un cliente a una certa data.
 *
 * Serve per collegare automaticamente i ticket: se il cliente ha un contratto
 * di assistenza attivo, il ticket vi rientra senza doverlo scegliere a mano.
 */
export async function contrattoAttivoPer(clienteId: string, quando = new Date()) {
  return prisma.contratto.findFirst({
    where: {
      clienteId,
      stato: "ATTIVO",
      tipo: "ASSISTENZA_ORE",
      inizioIl: { lte: quando },
      OR: [{ scadeIl: null }, { scadeIl: { gte: quando } }],
      eliminataIl: null,
    },
    orderBy: { inizioIl: "desc" },
  });
}

/** Giorni alla scadenza; null se il contratto non scade. */
export function giorniAllaScadenza(scadeIl: Date | null) {
  if (!scadeIl) return null;
  return Math.ceil((new Date(scadeIl).getTime() - Date.now()) / 86400000);
}

export const TIPI: Record<string, string> = {
  ASSISTENZA_ORE: "Assistenza a ore",
  CANONE_FISSO: "Canone fisso",
  PROGETTO: "Contratto di progetto",
};

export const STATI: Record<string, string> = {
  BOZZA: "Bozza",
  ATTIVO: "Attivo",
  SOSPESO: "Sospeso",
  SCADUTO: "Scaduto",
  DISDETTO: "Disdetto",
};

export const PERIODICITA: Record<string, string> = {
  MENSILE: "Mensile",
  TRIMESTRALE: "Trimestrale",
  SEMESTRALE: "Semestrale",
  ANNUALE: "Annuale",
};

import { prisma } from "./prisma";
import { eliminaFile } from "./storage";

/**
 * Cestino unico per tutte le entità principali.
 *
 * Due livelli, non uno: il soft delete (eliminataIl valorizzato) è
 * l'operazione quotidiana, reversibile, quella dietro al cestino di ogni
 * lista. L'hard delete è irreversibile e passa sempre dal cestino — non
 * esiste un modo di cancellare un record ancora "in vista" senza prima
 * nasconderlo.
 *
 * Ogni entità dichiara qui le sue regole invece di riscriverle in ogni
 * route: dove sta il nome da mostrare/confermare, quali figli bloccano
 * l'eliminazione (mai a cascata: un errore da un click non deve poter
 * cancellare mezzo database) ed eventuali vincoli propri (una fattura
 * emessa non si elimina mai davvero, per la sequenzialità fiscale dei
 * numeri).
 */

export type Entita =
  | "cliente"
  | "preventivo"
  | "progetto"
  | "attivita"
  | "ticket"
  | "fattura"
  | "contratto"
  | "costo"
  | "registrazioneOre"
  | "documento"
  | "workflow"
  | "modelloPdf"
  | "testoStandard";

export class ErroreEliminazione extends Error {}

type Figlio = { etichetta: string; conta: (id: string) => Promise<number> };

type ConfigEntita = {
  /** Nome del delegate Prisma, es. prisma.cliente. */
  modello: keyof typeof prisma;
  /** Colonna da mostrare nella conferma testuale dell'hard delete. */
  campoNome: string;
  /** Recupera il valore di campoNome per un id, per validare la conferma. */
  nome: (id: string) => Promise<string | null>;
  /** Figli che bloccano l'eliminazione (soft e hard) se non sono a zero. */
  figli?: Figlio[];
  /** Vincolo aggiuntivo, es. lo stato di una fattura. Ritorna un messaggio se blocca. */
  vincoloHard?: (id: string) => Promise<string | null>;
  /** Se il record ha un file su S3/MinIO da rimuovere insieme all'hard delete. */
  chiaveFile?: (id: string) => Promise<string | null>;
  /** Se eliminare questo record lascia lo studio senza un "predefinito", va scelto un fallback. */
  gestisciPredefinito?: (id: string) => Promise<void>;
};

const CONFIG: Record<Entita, ConfigEntita> = {
  cliente: {
    modello: "cliente",
    campoNome: "ragioneSociale",
    nome: async (id) => (await prisma.cliente.findUnique({ where: { id }, select: { ragioneSociale: true } }))?.ragioneSociale ?? null,
    figli: [
      { etichetta: "progetti", conta: (id) => prisma.progetto.count({ where: { clienteId: id, eliminataIl: null } }) },
      { etichetta: "preventivi", conta: (id) => prisma.preventivo.count({ where: { clienteId: id, eliminataIl: null } }) },
      { etichetta: "ticket", conta: (id) => prisma.ticket.count({ where: { clienteId: id, eliminataIl: null } }) },
      { etichetta: "fatture", conta: (id) => prisma.fattura.count({ where: { clienteId: id, eliminataIl: null } }) },
      { etichetta: "contratti", conta: (id) => prisma.contratto.count({ where: { clienteId: id, eliminataIl: null } }) },
    ],
  },

  preventivo: {
    modello: "preventivo",
    campoNome: "numero",
    nome: async (id) => (await prisma.preventivo.findUnique({ where: { id }, select: { numero: true } }))?.numero ?? null,
    figli: [
      { etichetta: "un progetto", conta: async (id) => (await prisma.progetto.count({ where: { preventivoId: id, eliminataIl: null } })) },
    ],
  },

  progetto: {
    modello: "progetto",
    campoNome: "nome",
    nome: async (id) => (await prisma.progetto.findUnique({ where: { id }, select: { nome: true } }))?.nome ?? null,
    figli: [
      { etichetta: "attività", conta: (id) => prisma.attivita.count({ where: { progettoId: id, eliminataIl: null } }) },
      { etichetta: "ticket", conta: (id) => prisma.ticket.count({ where: { progettoId: id, eliminataIl: null } }) },
      { etichetta: "ore registrate", conta: (id) => prisma.registrazioneOre.count({ where: { progettoId: id, eliminataIl: null } }) },
      { etichetta: "costi", conta: (id) => prisma.costo.count({ where: { progettoId: id, eliminataIl: null } }) },
      { etichetta: "contratti", conta: (id) => prisma.contratto.count({ where: { progettoId: id, eliminataIl: null } }) },
      { etichetta: "documenti", conta: (id) => prisma.documento.count({ where: { progettoId: id, eliminataIl: null } }) },
    ],
  },

  attivita: {
    modello: "attivita",
    campoNome: "titolo",
    nome: async (id) => (await prisma.attivita.findUnique({ where: { id }, select: { titolo: true } }))?.titolo ?? null,
    figli: [
      { etichetta: "ore registrate", conta: (id) => prisma.registrazioneOre.count({ where: { attivitaId: id, eliminataIl: null } }) },
      { etichetta: "costi", conta: (id) => prisma.costo.count({ where: { attivitaId: id, eliminataIl: null } }) },
    ],
  },

  ticket: {
    modello: "ticket",
    campoNome: "titolo",
    nome: async (id) => {
      const t = await prisma.ticket.findUnique({ where: { id }, select: { numero: true, titolo: true } });
      return t ? `#${t.numero} ${t.titolo}` : null;
    },
    figli: [
      { etichetta: "ore registrate", conta: (id) => prisma.registrazioneOre.count({ where: { ticketId: id, eliminataIl: null } }) },
      { etichetta: "costi", conta: (id) => prisma.costo.count({ where: { ticketId: id, eliminataIl: null } }) },
      { etichetta: "documenti", conta: (id) => prisma.documento.count({ where: { ticketId: id, eliminataIl: null } }) },
    ],
  },

  fattura: {
    modello: "fattura",
    campoNome: "numero",
    nome: async (id) => (await prisma.fattura.findUnique({ where: { id }, select: { numero: true } }))?.numero ?? null,
    figli: [
      { etichetta: "incassi registrati", conta: (id) => prisma.incasso.count({ where: { fatturaId: id } }) },
    ],
    // Una fattura uscita dallo studio non si cancella mai per davvero: il
    // numero deve restare tracciabile. Il soft delete resta permesso (serve
    // a "nasconderla" da un errore di battitura prima ancora di emetterla,
    // o a scopo di pulizia visiva), l'hard delete no.
    vincoloHard: async (id) => {
      const f = await prisma.fattura.findUnique({ where: { id }, select: { stato: true } });
      if (f && f.stato !== "DA_EMETTERE") {
        return "una fattura emessa non può essere eliminata definitivamente: la numerazione fiscale deve restare tracciabile";
      }
      return null;
    },
  },

  contratto: {
    modello: "contratto",
    campoNome: "numero",
    nome: async (id) => (await prisma.contratto.findUnique({ where: { id }, select: { numero: true } }))?.numero ?? null,
    figli: [
      { etichetta: "ticket collegati", conta: (id) => prisma.ticket.count({ where: { contrattoId: id, eliminataIl: null } }) },
      { etichetta: "periodi fatturati", conta: (id) => prisma.periodoContratto.count({ where: { contrattoId: id, fatturaId: { not: null } } }) },
    ],
  },

  costo: {
    modello: "costo",
    campoNome: "descrizione",
    nome: async (id) => (await prisma.costo.findUnique({ where: { id }, select: { descrizione: true } }))?.descrizione ?? null,
    vincoloHard: async (id) => {
      const c = await prisma.costo.findUnique({ where: { id }, select: { rigaFatturaId: true } });
      if (c?.rigaFatturaId) return "questo costo è già stato fatturato: eliminarlo per sempre farebbe perdere la tracciabilità della fattura";
      return null;
    },
  },

  registrazioneOre: {
    modello: "registrazioneOre",
    campoNome: "descrizione",
    nome: async (id) => {
      const r = await prisma.registrazioneOre.findUnique({ where: { id }, select: { descrizione: true, ore: true } });
      return r ? (r.descrizione || `${r.ore} h`) : null;
    },
    vincoloHard: async (id) => {
      const r = await prisma.registrazioneOre.findUnique({ where: { id }, select: { rigaFatturaId: true } });
      if (r?.rigaFatturaId) return "queste ore sono già state fatturate: eliminarle per sempre farebbe perdere la tracciabilità della fattura";
      return null;
    },
  },

  documento: {
    modello: "documento",
    campoNome: "nome",
    nome: async (id) => (await prisma.documento.findUnique({ where: { id }, select: { nome: true } }))?.nome ?? null,
    chiaveFile: async (id) => (await prisma.documento.findUnique({ where: { id }, select: { chiave: true } }))?.chiave ?? null,
  },

  workflow: {
    modello: "workflow",
    campoNome: "nome",
    nome: async (id) => (await prisma.workflow.findUnique({ where: { id }, select: { nome: true } }))?.nome ?? null,
  },

  modelloPdf: {
    modello: "modelloPdf",
    campoNome: "nome",
    nome: async (id) => (await prisma.modelloPdf.findUnique({ where: { id }, select: { nome: true } }))?.nome ?? null,
    vincoloHard: async (id) => {
      const m = await prisma.modelloPdf.findUnique({ where: { id }, select: { predefinito: true, ambito: true } });
      if (!m?.predefinito) return null;
      const altri = await prisma.modelloPdf.count({ where: { ambito: m.ambito, eliminataIl: null, NOT: { id } } });
      if (altri === 0) return "è l'unico modello di questo ambito: designa prima un altro come predefinito, oppure lascialo nel cestino";
      return null;
    },
    gestisciPredefinito: async (id) => {
      const m = await prisma.modelloPdf.findUnique({ where: { id }, select: { predefinito: true, ambito: true } });
      if (!m?.predefinito) return;
      const altro = await prisma.modelloPdf.findFirst({ where: { ambito: m.ambito, eliminataIl: null, NOT: { id } } });
      if (altro) await prisma.modelloPdf.update({ where: { id: altro.id }, data: { predefinito: true } });
    },
  },

  testoStandard: {
    modello: "testoStandard",
    campoNome: "titolo",
    nome: async (id) => (await prisma.testoStandard.findUnique({ where: { id }, select: { titolo: true } }))?.titolo ?? null,
  },
};

async function figliBloccanti(config: ConfigEntita, id: string) {
  if (!config.figli) return [];
  const risultati = await Promise.all(
    config.figli.map(async (f) => ({ etichetta: f.etichetta, conteggio: await f.conta(id) })),
  );
  return risultati.filter((r) => r.conteggio > 0);
}

/** Sposta un record nel cestino. Rifiutato se ha figli non eliminati. */
export async function spostaNelCestino(entita: Entita, id: string) {
  const config = CONFIG[entita];
  const nome = await config.nome(id);
  if (nome === null) throw new ErroreEliminazione("record inesistente");

  const bloccanti = await figliBloccanti(config, id);
  if (bloccanti.length > 0) {
    const elenco = bloccanti.map((b) => `${b.conteggio} ${b.etichetta}`).join(", ");
    throw new ErroreEliminazione(`elimina prima: ${elenco}`);
  }

  const delegate = prisma[config.modello] as any;
  await delegate.update({ where: { id }, data: { eliminataIl: new Date() } });
  if (config.gestisciPredefinito) await config.gestisciPredefinito(id);
}

/** Ripristina un record dal cestino. */
export async function ripristinaDalCestino(entita: Entita, id: string) {
  const config = CONFIG[entita];
  const delegate = prisma[config.modello] as any;
  const esiste = await config.nome(id);
  if (esiste === null) throw new ErroreEliminazione("record inesistente");
  await delegate.update({ where: { id }, data: { eliminataIl: null } });
}

/**
 * Elimina un record per sempre. Richiede che sia già nel cestino, che il
 * nome digitato corrisponda esattamente (conferma testuale) e che non ci
 * siano figli o vincoli propri (es. fattura già emessa) a bloccarlo.
 */
export async function eliminaDefinitivamente(entita: Entita, id: string, confermaTestuale: string) {
  const config = CONFIG[entita];
  const delegate = prisma[config.modello] as any;

  const record = await delegate.findUnique({ where: { id }, select: { eliminataIl: true } });
  if (!record) throw new ErroreEliminazione("record inesistente");
  if (!record.eliminataIl) throw new ErroreEliminazione("va prima spostato nel cestino");

  const nome = await config.nome(id);
  if (nome === null) throw new ErroreEliminazione("record inesistente");
  if (confermaTestuale.trim() !== nome.trim()) {
    throw new ErroreEliminazione(`scrivi esattamente «${nome}» per confermare`);
  }

  const bloccanti = await figliBloccanti(config, id);
  if (bloccanti.length > 0) {
    const elenco = bloccanti.map((b) => `${b.conteggio} ${b.etichetta}`).join(", ");
    throw new ErroreEliminazione(`elimina prima: ${elenco}`);
  }

  if (config.vincoloHard) {
    const messaggio = await config.vincoloHard(id);
    if (messaggio) throw new ErroreEliminazione(messaggio);
  }

  const chiaveFile = config.chiaveFile ? await config.chiaveFile(id) : null;

  await delegate.delete({ where: { id } });
  if (config.gestisciPredefinito) await config.gestisciPredefinito(id);
  if (chiaveFile) await eliminaFile(chiaveFile).catch(() => {});
}

const INCLUDE_CESTINO: Partial<Record<Entita, Record<string, boolean>>> = {
  preventivo: { cliente: true },
  progetto: { cliente: true },
  attivita: { progetto: true },
  ticket: { cliente: true },
  fattura: { cliente: true },
  contratto: { cliente: true },
  costo: { progetto: true, ticket: true },
  registrazioneOre: { progetto: true, ticket: true },
};

/** Elenco del cestino per un'entità, con il nome e un dettaglio leggibile. */
export async function elencoCestino(entita: Entita) {
  const config = CONFIG[entita];
  const delegate = prisma[config.modello] as any;
  const righe: any[] = await delegate.findMany({
    where: { eliminataIl: { not: null } },
    orderBy: { eliminataIl: "desc" },
    include: INCLUDE_CESTINO[entita],
  });

  return righe.map((r) => ({
    id: r.id as string,
    nome: nomeCestino(entita, r),
    dettaglio: dettaglioCestino(entita, r),
    eliminataIl: r.eliminataIl as Date,
  }));
}

function nomeCestino(entita: Entita, r: any): string {
  switch (entita) {
    case "ticket": return `#${r.numero} ${r.titolo}`;
    case "preventivo": return r.numero;
    case "fattura": return r.numero;
    case "contratto": return r.numero;
    case "registrazioneOre": return r.descrizione || `${r.ore} h`;
    case "cliente": return r.ragioneSociale;
    case "progetto": return r.nome;
    case "attivita": return r.titolo;
    case "costo": return r.descrizione;
    case "workflow": return r.nome;
    case "modelloPdf": return r.nome;
    case "testoStandard": return r.titolo;
    case "documento": return r.nome;
  }
}

function dettaglioCestino(entita: Entita, r: any): string | undefined {
  switch (entita) {
    case "preventivo":
    case "progetto":
    case "ticket":
    case "fattura":
    case "contratto":
      return r.cliente?.ragioneSociale;
    case "attivita":
      return r.progetto?.nome;
    case "costo":
    case "registrazioneOre":
      return r.progetto?.nome ?? r.ticket?.titolo ?? undefined;
    default:
      return undefined;
  }
}

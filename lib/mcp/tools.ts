import { z, type ZodTypeAny } from "zod";
import { prisma } from "@/lib/prisma";
import { invalidate } from "@/lib/redis";
import { registraEvento } from "@/lib/eventi";
import { n, arrotondaOre } from "@/lib/format";

/**
 * Tool esposti all'AI via MCP.
 *
 * Riusano le stesse regole delle route API (stessi Zod, stesso
 * `registraEvento`, stessa invalidazione cache): un agente non deve poter
 * fare nulla che l'interfaccia non permetta già, solo farlo in linguaggio
 * naturale.
 */

export type ToolContesto = { autore: string };

export type Tool = {
  descrizione: string;
  schema: ZodTypeAny;
  /** Se true, il tool scrive: le implementazioni "sola lettura" lo omettono. */
  scrittura?: boolean;
  esegui: (input: any, ctx: ToolContesto) => Promise<unknown>;
};

const paginazione = {
  limite: z.coerce.number().int().min(1).max(100).default(25),
};

function toJsonSchema(schema: ZodTypeAny): unknown {
  // Conversione minimale: copre solo le forme usate qui sotto (object di
  // stringhe/numeri/booleani/enum, opzionali). Basta per i client MCP, che
  // leggono lo schema solo per costruire l'input. Zod 4 espone il tipo in
  // `_def.type` (stringa), non più `_def.typeName` come in Zod 3.
  const def = (schema as any)._def;
  const tipo = def?.type;

  if (tipo === "object") {
    const shape = def.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [chiave, valore] of Object.entries(shape) as [string, ZodTypeAny][]) {
      properties[chiave] = toJsonSchema(valore);
      if (!isOpzionale(valore)) required.push(chiave);
    }
    return { type: "object", properties, ...(required.length ? { required } : {}) };
  }
  if (tipo === "optional" || tipo === "nullable" || tipo === "default") {
    return toJsonSchema(def.innerType);
  }
  if (tipo === "enum") return { type: "string", enum: Object.keys(def.entries) };
  if (tipo === "number") return { type: "number" };
  if (tipo === "boolean") return { type: "boolean" };
  return { type: "string" };
}

function isOpzionale(schema: ZodTypeAny): boolean {
  const tipo = (schema as any)._def?.type;
  return tipo === "optional" || tipo === "default" || tipo === "nullable";
}

export function schemaJson(tool: Tool) {
  return toJsonSchema(tool.schema);
}

// ------------------------------------------------------------------ lettura

const clienteSel = {
  id: true,
  ragioneSociale: true,
  sigla: true,
  settore: true,
  citta: true,
  partitaIva: true,
  tariffaOraria: true,
  statoRelazione: true,
} as const;

const TOOLS_LETTURA: Record<string, Tool> = {
  cerca_clienti: {
    descrizione: "Cerca clienti per ragione sociale, città o settore.",
    schema: z.object({ query: z.string().optional(), ...paginazione }),
    esegui: async ({ query, limite }) =>
      prisma.cliente.findMany({
        where: query
          ? {
              OR: [
                { ragioneSociale: { contains: query, mode: "insensitive" } },
                { citta: { contains: query, mode: "insensitive" } },
                { settore: { contains: query, mode: "insensitive" } },
              ],
              eliminataIl: null,
            }
          : { eliminataIl: null },
        select: clienteSel,
        orderBy: { ragioneSociale: "asc" },
        take: limite,
      }),
  },

  dettaglio_cliente: {
    descrizione: "Dettaglio di un cliente: anagrafica, referenti, progetti, contratti attivi.",
    schema: z.object({ clienteId: z.string() }),
    esegui: async ({ clienteId }) => {
      const c = await prisma.cliente.findUnique({
        where: { id: clienteId },
        include: {
          referenti: true,
          progetti: { select: { id: true, nome: true, stato: true, valore: true } },
          contratti: { select: { id: true, numero: true, titolo: true, stato: true, tipo: true } },
        },
      });
      if (!c) throw new Errore404("cliente inesistente");
      return c;
    },
  },

  elenca_progetti: {
    descrizione: "Elenca progetti, opzionalmente filtrati per stato o cliente.",
    schema: z.object({
      stato: z.enum(["DA_AVVIARE", "IN_CORSO", "IN_PAUSA", "COMPLETATO", "ANNULLATO"]).optional(),
      clienteId: z.string().optional(),
      ...paginazione,
    }),
    esegui: async ({ stato, clienteId, limite }) =>
      prisma.progetto.findMany({
        where: { stato, clienteId, eliminataIl: null },
        include: { cliente: { select: { ragioneSociale: true } } },
        orderBy: { updatedAt: "desc" },
        take: limite,
      }),
  },

  dettaglio_progetto: {
    descrizione: "Dettaglio completo di un progetto: attività, ticket, milestone, problemi aperti, consuntivo ore.",
    schema: z.object({ progettoId: z.string() }),
    esegui: async ({ progettoId }) => {
      const p = await prisma.progetto.findUnique({
        where: { id: progettoId },
        include: {
          cliente: { select: { ragioneSociale: true } },
          attivita: { orderBy: { updatedAt: "desc" } },
          ticket: { orderBy: { apertoIl: "desc" } },
          milestone: { orderBy: { scadenzaIl: "asc" } },
          problemi: { where: { stato: { in: ["APERTO", "IN_GESTIONE"] } } },
          registrazioni: { select: { ore: true, fatturabile: true } },
        },
      });
      if (!p) throw new Errore404("progetto inesistente");
      const oreTotali = p.registrazioni.reduce((s, r) => s + n(r.ore), 0);
      return { ...p, registrazioni: undefined, oreTotali };
    },
  },

  elenca_ticket: {
    descrizione: "Elenca i ticket di assistenza, filtrabili per stato, priorità o cliente.",
    schema: z.object({
      stato: z.enum(["APERTO", "IN_LAVORAZIONE", "ATTESA_CLIENTE", "RISOLTO", "CHIUSO"]).optional(),
      priorita: z.enum(["BASSA", "MEDIA", "ALTA", "URGENTE"]).optional(),
      clienteId: z.string().optional(),
      ...paginazione,
    }),
    esegui: async ({ stato, priorita, clienteId, limite }) =>
      prisma.ticket.findMany({
        where: { stato, priorita, clienteId, eliminataIl: null },
        include: { cliente: { select: { ragioneSociale: true } } },
        orderBy: { apertoIl: "desc" },
        take: limite,
      }),
  },

  dettaglio_ticket: {
    descrizione: "Dettaglio di un ticket: note, ore registrate, costi, documenti.",
    schema: z.object({ ticketId: z.string() }),
    esegui: async ({ ticketId }) => {
      const t = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          cliente: { select: { ragioneSociale: true } },
          progetto: { select: { id: true, nome: true } },
          note: { orderBy: { createdAt: "desc" } },
          registrazioni: true,
          costi: true,
          documenti: { select: { id: true, nome: true, createdAt: true } },
        },
      });
      if (!t) throw new Errore404("ticket inesistente");
      return t;
    },
  },

  elenca_attivita: {
    descrizione: "Elenca attività, filtrabili per stato o progetto.",
    schema: z.object({
      stato: z.enum(["DA_FARE", "IN_CORSO", "BLOCCATA", "COMPLETATA"]).optional(),
      progettoId: z.string().optional(),
      ...paginazione,
    }),
    esegui: async ({ stato, progettoId, limite }) =>
      prisma.attivita.findMany({
        where: { stato, progettoId, eliminataIl: null },
        include: { progetto: { select: { nome: true } } },
        orderBy: [{ scadenzaIl: "asc" }],
        take: limite,
      }),
  },

  ore_registrate: {
    descrizione: "Ore registrate in un intervallo di date, con filtro facoltativo su progetto o ticket.",
    schema: z.object({
      da: z.string().describe("data ISO, es. 2026-08-01"),
      a: z.string().describe("data ISO, es. 2026-08-31"),
      progettoId: z.string().optional(),
      ticketId: z.string().optional(),
    }),
    esegui: async ({ da, a, progettoId, ticketId }) => {
      const righe = await prisma.registrazioneOre.findMany({
        where: {
          data: { gte: new Date(`${da}T00:00:00.000Z`), lte: new Date(`${a}T23:59:59.999Z`) },
          progettoId,
          ticketId,
          eliminataIl: null,
        },
        include: {
          progetto: { select: { nome: true } },
          ticket: { select: { titolo: true } },
        },
        orderBy: { data: "asc" },
      });
      return { righe, totaleOre: righe.reduce((s, r) => s + n(r.ore), 0) };
    },
  },

  elenca_preventivi: {
    descrizione: "Elenca preventivi, filtrabili per stato o cliente.",
    schema: z.object({
      stato: z.enum(["BOZZA", "INVIATO", "ACCETTATO", "RIFIUTATO", "SCADUTO"]).optional(),
      clienteId: z.string().optional(),
      ...paginazione,
    }),
    esegui: async ({ stato, clienteId, limite }) =>
      prisma.preventivo.findMany({
        where: { stato, clienteId, eliminataIl: null },
        include: { cliente: { select: { ragioneSociale: true } } },
        orderBy: { createdAt: "desc" },
        take: limite,
      }),
  },

  elenca_fatture: {
    descrizione: "Elenca fatture, filtrabili per stato o cliente, con importo incassato.",
    schema: z.object({
      stato: z.enum(["DA_EMETTERE", "EMESSA", "PAGATA", "SCADUTA"]).optional(),
      clienteId: z.string().optional(),
      ...paginazione,
    }),
    esegui: async ({ stato, clienteId, limite }) => {
      const fatture = await prisma.fattura.findMany({
        where: { stato, clienteId, eliminataIl: null },
        include: { cliente: { select: { ragioneSociale: true } }, incassi: true },
        orderBy: { createdAt: "desc" },
        take: limite,
      });
      return fatture.map((f) => ({
        ...f,
        incassato: f.incassi.reduce((s, i) => s + n(i.importo), 0),
      }));
    },
  },

  elenca_contratti: {
    descrizione: "Elenca contratti, filtrabili per stato o cliente, con consumo del monte ore del periodo corrente.",
    schema: z.object({
      stato: z.enum(["BOZZA", "ATTIVO", "SCADUTO", "DISDETTO"]).optional(),
      clienteId: z.string().optional(),
      ...paginazione,
    }),
    esegui: async ({ stato, clienteId, limite }) =>
      prisma.contratto.findMany({
        where: { stato, clienteId, eliminataIl: null },
        include: {
          cliente: { select: { ragioneSociale: true } },
          periodi: { orderBy: { inizioIl: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: limite,
      }),
  },

  riepilogo_studio: {
    descrizione:
      "Riepilogo rapido dello studio: progetti attivi, ticket aperti, ore del mese, fatturato emesso/incassato, scadenze imminenti.",
    schema: z.object({}),
    esegui: async () => {
      const oggi = new Date();
      const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
      const traSetteGiorni = new Date(Date.now() + 7 * 86400000);

      const [progettiAttivi, ticketAperti, oreMese, fatture, scadenzeContratti] =
        await Promise.all([
          prisma.progetto.count({ where: { stato: { in: ["IN_CORSO", "DA_AVVIARE"] }, eliminataIl: null } }),
          prisma.ticket.count({ where: { stato: { notIn: ["RISOLTO", "CHIUSO"] }, eliminataIl: null } }),
          prisma.registrazioneOre.findMany({ where: { data: { gte: inizioMese }, eliminataIl: null } }),
          prisma.fattura.findMany({ where: { eliminataIl: null }, include: { incassi: true } }),
          prisma.contratto.findMany({
            where: { stato: "ATTIVO", scadeIl: { lte: traSetteGiorni, not: null }, eliminataIl: null },
            include: { cliente: { select: { ragioneSociale: true } } },
          }),
        ]);

      const emesso = fatture
        .filter((f) => f.stato !== "DA_EMETTERE")
        .reduce((s, f) => s + n(f.imponibile), 0);
      const incassato = fatture.reduce(
        (s, f) => s + f.incassi.reduce((x, i) => x + n(i.importo), 0),
        0,
      );

      return {
        progettiAttivi,
        ticketAperti,
        oreMeseCorrente: oreMese.reduce((s, r) => s + n(r.ore), 0),
        fatturatoEmesso: emesso,
        fatturatoIncassato: incassato,
        contrattiInScadenza: scadenzeContratti.map((c) => ({
          numero: c.numero,
          cliente: c.cliente.ragioneSociale,
          scadeIl: c.scadeIl,
        })),
      };
    },
  },
};

// ------------------------------------------------------------------ scrittura

const TOOLS_SCRITTURA: Record<string, Tool> = {
  crea_ticket: {
    descrizione: "Apre un nuovo ticket di assistenza per un cliente.",
    scrittura: true,
    schema: z.object({
      clienteId: z.string(),
      titolo: z.string().min(1),
      descrizione: z.string().optional(),
      progettoId: z.string().optional(),
      priorita: z.enum(["BASSA", "MEDIA", "ALTA", "URGENTE"]).default("MEDIA"),
    }),
    esegui: async ({ clienteId, titolo, descrizione, progettoId, priorita }) => {
      const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
      if (!cliente) throw new Errore404("cliente inesistente");

      const ultimo = await prisma.ticket.findFirst({ orderBy: { numero: "desc" } });
      const ticket = await prisma.ticket.create({
        data: {
          numero: (ultimo?.numero ?? 0) + 1,
          clienteId,
          titolo,
          descrizione: descrizione || null,
          progettoId: progettoId || null,
          priorita,
        },
      });
      await invalidate();
      return ticket;
    },
  },

  aggiorna_stato_ticket: {
    descrizione: "Cambia stato o priorità di un ticket esistente.",
    scrittura: true,
    schema: z.object({
      ticketId: z.string(),
      stato: z.enum(["APERTO", "IN_LAVORAZIONE", "ATTESA_CLIENTE", "RISOLTO", "CHIUSO"]).optional(),
      priorita: z.enum(["BASSA", "MEDIA", "ALTA", "URGENTE"]).optional(),
    }),
    esegui: async ({ ticketId, stato, priorita }, ctx) => {
      const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!t) throw new Errore404("ticket inesistente");

      const chiuso = stato ? ["RISOLTO", "CHIUSO"].includes(stato) : null;
      const aggiornato = await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          ...(stato ? { stato, risoltoIl: chiuso ? new Date() : null } : {}),
          ...(priorita ? { priorita } : {}),
        },
      });

      if (t.progettoId && stato && stato !== t.stato) {
        await registraEvento(t.progettoId, "stato", `Ticket #${t.numero}: ${t.stato} → ${stato}`, {
          autore: ctx.autore,
        });
      }
      await invalidate();
      return aggiornato;
    },
  },

  aggiungi_nota_ticket: {
    descrizione: "Aggiunge una nota operativa a un ticket.",
    scrittura: true,
    schema: z.object({ ticketId: z.string(), testo: z.string().min(1) }),
    esegui: async ({ ticketId, testo }, ctx) => {
      const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!t) throw new Errore404("ticket inesistente");
      const nota = await prisma.notaOperativa.create({
        data: { ticketId, testo, autore: ctx.autore },
      });
      await invalidate();
      return nota;
    },
  },

  registra_ore: {
    descrizione:
      "Registra ore lavorate su un progetto, un'attività o un ticket (almeno uno dei tre è obbligatorio).",
    scrittura: true,
    schema: z.object({
      data: z.string().describe("data ISO, es. 2026-08-30"),
      ore: z.coerce.number().positive(),
      descrizione: z.string().optional(),
      fatturabile: z.boolean().default(true),
      progettoId: z.string().optional(),
      attivitaId: z.string().optional(),
      ticketId: z.string().optional(),
    }),
    esegui: async (d, ctx) => {
      if (!d.progettoId && !d.attivitaId && !d.ticketId) {
        throw new ErroreInput("indica un progetto, un'attività o un ticket");
      }
      let progettoId: string | null = d.progettoId || null;
      if (d.attivitaId) {
        const a = await prisma.attivita.findUnique({
          where: { id: d.attivitaId },
          select: { progettoId: true },
        });
        if (!a) throw new ErroreInput("attività inesistente");
        progettoId = progettoId ?? a.progettoId;
      }
      if (d.ticketId) {
        const t = await prisma.ticket.findUnique({
          where: { id: d.ticketId },
          select: { progettoId: true },
        });
        if (!t) throw new ErroreInput("ticket inesistente");
        progettoId = progettoId ?? t.progettoId;
      }

      const r = await prisma.registrazioneOre.create({
        data: {
          data: new Date(`${d.data}T00:00:00.000Z`),
          ore: arrotondaOre(d.ore),
          descrizione: d.descrizione || null,
          fatturabile: d.fatturabile,
          progettoId,
          attivitaId: d.attivitaId || null,
          ticketId: d.ticketId || null,
        },
      });

      if (progettoId) {
        await registraEvento(progettoId, "ore", `${d.ore} h registrate`, {
          dettaglio: d.descrizione || null,
          autore: ctx.autore,
        });
      }
      await invalidate();
      return r;
    },
  },

  registra_costo: {
    descrizione:
      "Registra un costo sostenuto (trasferta, materiale, licenza, servizio terzi) su un progetto, un'attività o un ticket.",
    scrittura: true,
    schema: z.object({
      data: z.string().describe("data ISO, es. 2026-08-30"),
      tipo: z.enum(["TRASFERTA", "MATERIALE", "LICENZA", "SERVIZIO_TERZI", "ALTRO"]).default("ALTRO"),
      descrizione: z.string().min(1),
      importo: z.coerce.number().positive(),
      rimborsabile: z.boolean().default(true),
      progettoId: z.string().optional(),
      attivitaId: z.string().optional(),
      ticketId: z.string().optional(),
    }),
    esegui: async (d, ctx) => {
      if (!d.progettoId && !d.attivitaId && !d.ticketId) {
        throw new ErroreInput("indica un progetto, un'attività o un ticket");
      }
      const costo = await prisma.costo.create({
        data: {
          data: new Date(`${d.data}T00:00:00.000Z`),
          tipo: d.tipo,
          descrizione: d.descrizione,
          importo: d.importo,
          rimborsabile: d.rimborsabile,
          progettoId: d.progettoId || null,
          attivitaId: d.attivitaId || null,
          ticketId: d.ticketId || null,
          registratoDa: ctx.autore,
        },
      });
      await invalidate();
      return costo;
    },
  },

  crea_attivita: {
    descrizione: "Crea una nuova attività, opzionalmente collegata a un progetto.",
    scrittura: true,
    schema: z.object({
      titolo: z.string().min(1),
      progettoId: z.string().optional(),
      stimaOre: z.coerce.number().positive().optional(),
      scadenzaIl: z.string().optional().describe("data ISO, es. 2026-09-15"),
    }),
    esegui: async ({ titolo, progettoId, stimaOre, scadenzaIl }) => {
      const attivita = await prisma.attivita.create({
        data: {
          titolo,
          progettoId: progettoId || null,
          stimaOre: stimaOre ?? null,
          scadenzaIl: scadenzaIl ? new Date(`${scadenzaIl}T00:00:00.000Z`) : null,
        },
      });
      await invalidate();
      return attivita;
    },
  },

  aggiorna_stato_attivita: {
    descrizione: "Cambia lo stato di un'attività.",
    scrittura: true,
    schema: z.object({
      attivitaId: z.string(),
      stato: z.enum(["DA_FARE", "IN_CORSO", "BLOCCATA", "COMPLETATA"]),
    }),
    esegui: async ({ attivitaId, stato }) => {
      const a = await prisma.attivita.findUnique({ where: { id: attivitaId } });
      if (!a) throw new Errore404("attività inesistente");
      const aggiornata = await prisma.attivita.update({
        where: { id: attivitaId },
        data: { stato, completataIl: stato === "COMPLETATA" ? new Date() : null },
      });
      await invalidate();
      return aggiornata;
    },
  },
};

export const TOOLS: Record<string, Tool> = { ...TOOLS_LETTURA, ...TOOLS_SCRITTURA };

export class Errore404 extends Error {}
export class ErroreInput extends Error {}

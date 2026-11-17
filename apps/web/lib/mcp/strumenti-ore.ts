import { formattaOre, STATI_MONTE_ORE } from "@telaio/core";
import {
  avviaTimer,
  cambiaStatoMonteOre,
  creaMonteOre,
  elencaTempo,
  eliminaMonteOre,
  eliminaTempo,
  fermaTimer,
  modificaMonteOre,
  modificaTempo,
  registraTempo,
  riepilogoMonteOre,
  scartaTimer,
  timerAttivo,
} from "@telaio/db";
import { z } from "zod";
import { oggi } from "../date";
import { fatturaOreExtra } from "../dominio/ore";
import { type Strumento, strumento } from "./base";
import { data, id, limite } from "./schemi";

/** Campi di un contratto a ore, senza valori di default: le modifiche non devono riscriverli. */
const campiContratto = {
  nome: z.string().min(1).max(150),
  minutiIncluse: z.number().int().min(1).describe("minuti inclusi in ogni periodo (10 ore = 600)"),
  tariffaOrariaCent: z.number().int().min(0),
  tariffaExtraCent: z
    .number()
    .int()
    .min(0)
    .describe("tariffa delle ore oltre il monte, in centesimi"),
  arrotondamentoMinuti: z.number().int().describe("1, 5, 15, 30 o 60; si arrotonda per eccesso"),
  dataInizio: data.describe("il giorno del mese fissa i periodi mensili"),
  dataFine: data.nullish(),
};

const campiTempo = {
  clienteRefId: id.optional().describe("id locale del cliente; serve se non c'è un contratto"),
  monteOreId: id.optional(),
  progettoId: id.optional(),
  ticketId: id.optional(),
  descrizione: z.string().max(500).optional(),
};

const riga = ({
  v,
  cliente,
  contratto,
  progetto,
  ticketNumero,
}: Awaited<ReturnType<typeof elencaTempo>>[number]) => ({
  id: v.id,
  data: v.data,
  cliente,
  clienteRefId: v.clienteRefId,
  contratto,
  monteOreId: v.monteOreId,
  progetto,
  ticketNumero,
  minutiEffettivi: v.minutiEffettivi,
  minuti: v.minuti,
  durata: formattaOre(v.minuti),
  descrizione: v.descrizione,
  fatturabile: v.fatturabile,
});

/** Contratti a ore e time tracking. */
export const ORE: Record<string, Strumento> = {
  elenca_monte_ore: strumento(
    { clienteRefId: id.optional(), stato: z.enum(STATI_MONTE_ORE).optional() },
    async (db, { clienteRefId, stato }) =>
      (await riepilogoMonteOre(db, oggi(), { clienteRefId, stato })).map((r) => ({
        id: r.contratto.id,
        nome: r.contratto.nome,
        cliente: r.cliente,
        clienteRefId: r.contratto.clienteRefId,
        stato: r.contratto.stato,
        minutiIncluse: r.contratto.minutiIncluse,
        periodoCorrente: r.corrente,
      })),
  ),

  dettaglio_monte_ore: strumento({ id }, async (db, { id: contrattoId }) => {
    const [r] = await riepilogoMonteOre(db, oggi(), { id: contrattoId });
    if (!r) throw new Error("Contratto non trovato");
    return {
      contratto: r.contratto,
      cliente: r.cliente,
      periodoCorrente: r.corrente,
      periodi: r.cicli,
      tempoDelPeriodo: r.corrente
        ? (
            await elencaTempo(db, {
              monteOreId: contrattoId,
              da: r.corrente.inizio,
              a: r.corrente.fine,
            })
          ).map(riga)
        : [],
    };
  }),

  crea_monte_ore: strumento(
    {
      clienteRefId: id.describe("id locale del cliente (clienti_ref)"),
      ragioneSocialeId: id.describe("emittente delle fatture e dell'estratto ore"),
      preventivoId: id.optional(),
      nome: campiContratto.nome,
      minutiIncluse: campiContratto.minutiIncluse,
      tariffaOrariaCent: campiContratto.tariffaOrariaCent.optional(),
      tariffaExtraCent: campiContratto.tariffaExtraCent.optional(),
      arrotondamentoMinuti: campiContratto.arrotondamentoMinuti.optional(),
      dataInizio: campiContratto.dataInizio,
      dataFine: campiContratto.dataFine,
    },
    (db, { clienteRefId, ragioneSocialeId, preventivoId, ...dati }) =>
      creaMonteOre(db, { clienteRefId, ragioneSocialeId, preventivoId, dati }),
  ),

  modifica_monte_ore: strumento(
    {
      id,
      preventivoId: id.nullish(),
      ragioneSocialeId: id.optional(),
      nome: campiContratto.nome.optional(),
      minutiIncluse: campiContratto.minutiIncluse.optional(),
      tariffaOrariaCent: campiContratto.tariffaOrariaCent.optional(),
      tariffaExtraCent: campiContratto.tariffaExtraCent.optional(),
      arrotondamentoMinuti: campiContratto.arrotondamentoMinuti.optional(),
      dataInizio: campiContratto.dataInizio.optional(),
      dataFine: campiContratto.dataFine,
    },
    (db, { id: contrattoId, ...campi }) => modificaMonteOre(db, contrattoId, campi),
  ),

  cambia_stato_monte_ore: strumento(
    { id, stato: z.enum(STATI_MONTE_ORE) },
    (db, { id: contrattoId, stato }) => cambiaStatoMonteOre(db, contrattoId, stato),
  ),

  elimina_monte_ore: strumento({ id }, async (db, { id: contrattoId }) => ({
    ...(await eliminaMonteOre(db, contrattoId)),
    eliminato: true,
  })),

  fattura_ore_extra: strumento(
    { id, ciclo: z.number().int().min(0).describe("numero del periodo (0 = il primo)") },
    (db, { id: contrattoId, ciclo }) => fatturaOreExtra(db, contrattoId, ciclo, oggi()),
  ),

  elenca_tempo: strumento(
    {
      clienteRefId: id.optional(),
      monteOreId: id.optional(),
      progettoId: id.optional(),
      ticketId: id.optional(),
      da: data.optional(),
      a: data.optional(),
      limite,
    },
    async (db, filtri) => (await elencaTempo(db, filtri)).map(riga),
  ),

  registra_tempo: strumento(
    {
      ...campiTempo,
      data,
      minuti: z
        .number()
        .int()
        .min(1)
        .describe("minuti lavorati; con un contratto si arrotondano per eccesso"),
      fatturabile: z.boolean().optional(),
    },
    (db, i) => registraTempo(db, i),
  ),

  modifica_tempo: strumento(
    {
      id,
      clienteRefId: id.nullish(),
      monteOreId: id.nullish(),
      progettoId: id.nullish(),
      ticketId: id.nullish(),
      data: data.optional(),
      minuti: z.number().int().min(1).optional(),
      descrizione: z.string().max(500).nullish(),
      fatturabile: z.boolean().optional(),
    },
    (db, { id: voceId, ...campi }) => modificaTempo(db, voceId, campi),
  ),

  elimina_tempo: strumento({ id }, async (db, { id: voceId }) => ({
    ...(await eliminaTempo(db, voceId)),
    eliminato: true,
  })),

  stato_timer: strumento({}, async (db) => {
    const t = await timerAttivo(db);
    return t
      ? {
          inCorso: true,
          cliente: t.cliente,
          contratto: t.contratto,
          descrizione: t.v.descrizione,
          avviatoAt: t.v.avviatoAt,
        }
      : { inCorso: false };
  }),

  avvia_timer: strumento(campiTempo, async (db, i) => avviaTimer(db, { ...i, data: oggi() })),
  ferma_timer: strumento({}, (db) => fermaTimer(db)),
  scarta_timer: strumento({}, async (db) => ({ ...(await scartaTimer(db)), scartato: true })),
};

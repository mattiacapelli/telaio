import { prisma } from "./prisma";
import { redis } from "./redis";
import { esegui } from "./workflow/motore";
import type { SchemaWorkflow } from "./workflow/tipi";
import { periodoDi, giorniAllaScadenza, MESI_PERIODO } from "./contratti";
import { n } from "./format";

/**
 * Attività ricorrenti.
 *
 * Girano dentro l'app invece che in un cron di sistema: così condividono il
 * codice del motore workflow e non serve un secondo processo da tenere
 * allineato. Il lucchetto in Redis fa sì che, con più istanze, solo una le
 * esegua.
 */

const LUCCHETTO = "telaio:scheduler:in-corso";
const ULTIMA = "telaio:scheduler:ultima";

export type EsitoScheduler = {
  eseguito: boolean;
  motivo?: string;
  contrattiScaduti: number;
  contrattiRinnovati: number;
  avvisiCreati: number;
  workflowEseguiti: number;
};

/**
 * Prende il lucchetto per la durata indicata.
 *
 * `NX` fa sì che la chiave venga scritta solo se non esiste: se due istanze
 * partono insieme, una sola ottiene il lucchetto e l'altra si ferma.
 */
async function prendiLucchetto(secondi = 300) {
  try {
    const esito = await redis.set(LUCCHETTO, "1", "EX", secondi, "NX");
    return esito === "OK";
  } catch {
    // Senza Redis non possiamo coordinarci: meglio non eseguire che
    // rischiare fatture doppie da due istanze.
    return false;
  }
}

async function rilasciaLucchetto() {
  try {
    await redis.del(LUCCHETTO);
  } catch {
    /* scade da sé */
  }
}

/** Ultima esecuzione riuscita, per non ripetere lo stesso giorno. */
async function giaEseguitoOggi() {
  try {
    const ultima = await redis.get(ULTIMA);
    if (!ultima) return false;
    return ultima.slice(0, 10) === new Date().toISOString().slice(0, 10);
  } catch {
    return false;
  }
}

/**
 * Contratti scaduti e rinnovi.
 *
 * Un contratto con rinnovo automatico non scade: la data di scadenza avanza
 * di un periodo. Senza rinnovo passa a SCADUTO e smette di coprire i ticket.
 */
async function gestisciContratti() {
  const oggi = new Date();
  const attivi = await prisma.contratto.findMany({
    where: { stato: "ATTIVO", scadeIl: { not: null, lt: oggi } },
  });

  let scaduti = 0;
  let rinnovati = 0;

  for (const c of attivi) {
    if (c.rinnovoAutomatico) {
      const passi = MESI_PERIODO[c.periodicita] ?? 1;
      const nuova = new Date(c.scadeIl!);
      // Avanza finché la scadenza non è di nuovo nel futuro: copre anche il
      // caso di più periodi saltati (app spenta a lungo).
      while (nuova <= oggi) nuova.setMonth(nuova.getMonth() + passi);
      await prisma.contratto.update({
        where: { id: c.id },
        data: { scadeIl: nuova },
      });
      await prisma.notifica.create({
        data: {
          titolo: `Contratto ${c.numero} rinnovato`,
          testo: `${c.titolo} · nuova scadenza ${nuova.toLocaleDateString("it-IT")}`,
          link: `/contratti/${c.id}`,
          livello: "info",
        },
      });
      rinnovati++;
    } else {
      await prisma.contratto.update({ where: { id: c.id }, data: { stato: "SCADUTO" } });
      // Un contratto scaduto non copre più: i ticket tornano a consuntivo.
      await prisma.ticket.updateMany({
        where: { contrattoId: c.id, stato: { notIn: ["RISOLTO", "CHIUSO"] } },
        data: { contrattoId: null, conContratto: false },
      });
      await prisma.notifica.create({
        data: {
          titolo: `Contratto ${c.numero} scaduto`,
          testo: `${c.titolo} non copre più i ticket del cliente.`,
          link: `/contratti/${c.id}`,
          livello: "urgente",
        },
      });
      scaduti++;
    }
  }

  return { scaduti, rinnovati };
}

/** Avvisi su scadenze imminenti e monte ore esaurito. */
async function creaAvvisi() {
  let creati = 0;

  const attivi = await prisma.contratto.findMany({
    where: { stato: "ATTIVO" },
    include: { cliente: true },
  });

  for (const c of attivi) {
    const giorni = giorniAllaScadenza(c.scadeIl);

    // Avvisa quando manca il preavviso di disdetta: oltre, non si può più
    // disdire e l'avviso arriverebbe inutile.
    if (giorni !== null && giorni <= c.preavvisoGiorni && giorni >= 0) {
      const chiave = `scadenza:${c.id}:${c.scadeIl?.toISOString().slice(0, 10)}`;
      if (await nuovoAvviso(chiave)) {
        await prisma.notifica.create({
          data: {
            titolo: `${c.numero} scade tra ${giorni} giorni`,
            testo: `${c.titolo} · ${c.cliente.ragioneSociale}. Preavviso di disdetta: ${c.preavvisoGiorni} giorni.`,
            link: `/contratti/${c.id}`,
            livello: giorni <= 7 ? "urgente" : "attenzione",
          },
        });
        creati++;
      }
    }

    if (c.tipo === "ASSISTENZA_ORE" && c.monteOre) {
      const { inizio, fine } = periodoDi(c.inizioIl, c.periodicita);
      const registrazioni = await prisma.registrazioneOre.findMany({
        where: { data: { gte: inizio, lt: fine }, ticket: { contrattoId: c.id } },
        select: { ore: true },
      });
      const consumate = registrazioni.reduce((s, r) => s + n(r.ore), 0);
      const monte = n(c.monteOre);

      // Sopra l'80% conviene saperlo prima di sforare.
      if (consumate >= monte * 0.8) {
        const chiave = `monte:${c.id}:${inizio.toISOString().slice(0, 10)}:${consumate > monte ? "oltre" : "vicino"}`;
        if (await nuovoAvviso(chiave)) {
          await prisma.notifica.create({
            data: {
              titolo:
                consumate > monte
                  ? `${c.numero}: monte ore superato`
                  : `${c.numero}: monte ore quasi esaurito`,
              testo: `${consumate.toLocaleString("it-IT")} h su ${monte.toLocaleString("it-IT")} incluse · ${c.cliente.ragioneSociale}`,
              link: `/contratti/${c.id}`,
              livello: consumate > monte ? "urgente" : "attenzione",
            },
          });
          creati++;
        }
      }
    }
  }

  return creati;
}

/**
 * Evita di ripetere lo stesso avviso ogni giorno.
 *
 * La chiave scade dopo 30 giorni: se la condizione persiste oltre, l'avviso
 * torna, ma non tutti i giorni.
 */
async function nuovoAvviso(chiave: string) {
  try {
    const esito = await redis.set(
      `telaio:avviso:${chiave}`,
      "1",
      "EX",
      60 * 60 * 24 * 30,
      "NX",
    );
    return esito === "OK";
  } catch {
    return true;
  }
}

/** Workflow con innesco a tempo, eseguiti secondo la loro frequenza. */
async function eseguiWorkflowPianificati() {
  const oggi = new Date();
  const workflow = await prisma.workflow.findMany({
    where: { attivo: true, innesco: "PIANIFICATO" },
  });

  let eseguiti = 0;
  for (const w of workflow) {
    const freq = w.eventoChiave ?? "giornaliero";
    const giorno = oggi.getDay(); // 0 = domenica
    const dataMese = oggi.getDate();

    const tocca =
      freq === "giornaliero" ||
      (freq === "settimanale" && giorno === 1) ||
      (freq === "mensile" && dataMese === 1);
    if (!tocca) continue;

    // Un workflow gira una volta al giorno, anche se lo scheduler passa più volte.
    if (
      w.ultimaEsecuzione &&
      w.ultimaEsecuzione.toISOString().slice(0, 10) === oggi.toISOString().slice(0, 10)
    ) {
      continue;
    }

    await esegui(
      w.id,
      (w.azioni as unknown as SchemaWorkflow) ?? { blocchi: [], collegamenti: [] },
      { evento: freq, entita: "nessuna", dati: {} },
    );
    eseguiti++;
  }

  return eseguiti;
}

/**
 * Passata completa dello scheduler.
 *
 * `forza` salta il controllo "già eseguito oggi": serve per l'esecuzione
 * manuale dalle impostazioni.
 */
export async function eseguiScheduler(forza = false): Promise<EsitoScheduler> {
  const vuoto = {
    contrattiScaduti: 0,
    contrattiRinnovati: 0,
    avvisiCreati: 0,
    workflowEseguiti: 0,
  };

  if (!forza && (await giaEseguitoOggi())) {
    return { eseguito: false, motivo: "già eseguito oggi", ...vuoto };
  }
  if (!(await prendiLucchetto())) {
    return { eseguito: false, motivo: "un'altra esecuzione è in corso", ...vuoto };
  }

  try {
    const contratti = await gestisciContratti();
    const avvisi = await creaAvvisi();
    const workflow = await eseguiWorkflowPianificati();

    try {
      await redis.set(ULTIMA, new Date().toISOString());
    } catch {
      /* la prossima passata ripartirà comunque */
    }

    return {
      eseguito: true,
      contrattiScaduti: contratti.scaduti,
      contrattiRinnovati: contratti.rinnovati,
      avvisiCreati: avvisi,
      workflowEseguiti: workflow,
    };
  } finally {
    await rilasciaLucchetto();
  }
}

import { prisma } from "../prisma";
import { registraEvento } from "../eventi";
import { notificaWebhook } from "../webhook";
import { n } from "../format";
import type { Blocco, SchemaWorkflow } from "./tipi";

/**
 * Esecuzione dei workflow.
 *
 * Il contesto è ciò che ha fatto scattare il workflow: l'entità coinvolta e i
 * suoi valori. Le condizioni lo interrogano, le azioni lo usano per sapere su
 * cosa agire.
 */
export type Contesto = {
  evento: string;
  entita: "preventivo" | "progetto" | "attivita" | "fattura" | "ticket" | "problema" | "nessuna";
  id?: string;
  /** Valori esposti alle condizioni e ai segnaposto nei testi. */
  dati: Record<string, string | number | null>;
};

export type EsitoEsecuzione = {
  successo: boolean;
  esito: string;
  azioniEseguite: string[];
};

/** Sostituisce i segnaposto {nome} con i valori del contesto. */
export function interpola(testo: string, ctx: Contesto) {
  return testo.replace(/\{(\w+)\}/g, (intero, chiave: string) => {
    const v = ctx.dati[chiave];
    return v === undefined || v === null ? intero : String(v);
  });
}

function valutaCondizione(b: Blocco, ctx: Contesto): boolean {
  const c = b.config;

  if (b.tipo === "condizione.valore") {
    const valore = Number(ctx.dati[String(c.campo)] ?? 0);
    const soglia = Number(c.soglia ?? 0);
    if (c.operatore === "maggiore") return valore > soglia;
    if (c.operatore === "minore") return valore < soglia;
    return valore === soglia;
  }

  if (b.tipo === "condizione.giorni") {
    const grezzo = ctx.dati[String(c.campo)];
    if (!grezzo) return false;
    const giorni = Math.floor(
      (Date.now() - new Date(String(grezzo)).getTime()) / 86400000,
    );
    return giorni >= Number(c.giorni ?? 0);
  }

  if (b.tipo === "condizione.stato") {
    return String(ctx.dati.stato ?? "") === String(c.stato ?? "");
  }

  // Un blocco sconosciuto non deve bloccare il workflow né farlo passare
  // silenziosamente: lo trattiamo come non soddisfatto.
  return false;
}

async function eseguiAzione(b: Blocco, ctx: Contesto): Promise<string> {
  const c = b.config;

  switch (b.tipo) {
    case "azione.notifica": {
      await prisma.notifica.create({
        data: {
          titolo: interpola(String(c.titolo ?? "Notifica"), ctx),
          testo: c.testo ? interpola(String(c.testo), ctx) : null,
          livello: String(c.livello ?? "info"),
          link: ctx.id && ctx.entita !== "nessuna" ? `/${ctx.entita}/${ctx.id}` : null,
        },
      });
      return "notifica creata";
    }

    case "azione.diario": {
      if (ctx.entita !== "progetto" || !ctx.id) return "saltata: nessun progetto";
      await registraEvento(ctx.id, "modifica", interpola(String(c.testo ?? ""), ctx), {
        autore: "workflow",
      });
      return "annotazione aggiunta";
    }

    case "azione.creaAttivita": {
      const progettoId =
        ctx.entita === "progetto" ? ctx.id : String(ctx.dati.progettoId ?? "");
      if (!progettoId) return "saltata: nessun progetto";
      await prisma.attivita.create({
        data: {
          progettoId,
          titolo: interpola(String(c.titolo ?? "Nuova attività"), ctx),
          stimaOre: Number(c.stimaOre ?? 0) || null,
        },
      });
      return "attività creata";
    }

    case "azione.creaProgetto": {
      if (ctx.entita !== "preventivo" || !ctx.id) return "saltata: nessun preventivo";
      const p = await prisma.preventivo.findUnique({
        where: { id: ctx.id },
        include: { voci: true, progetto: true },
      });
      if (!p) return "saltata: preventivo inesistente";
      // Un preventivo genera un solo progetto: se c'è già, non ne creiamo un altro.
      if (p.progetto) return "saltata: progetto già esistente";

      const oreVoci = p.voci
        .filter((v) => v.unita === "ORE")
        .reduce((s, v) => s + n(v.quantita), 0);

      const creato = await prisma.progetto.create({
        data: {
          nome: p.titolo,
          clienteId: p.clienteId,
          preventivoId: p.id,
          stato: "DA_AVVIARE",
          valore: p.imponibile,
          budgetOre: Number(c.budgetOre ?? 0) || oreVoci,
        },
      });
      await registraEvento(creato.id, "modifica", `Progetto creato da ${p.numero}`, {
        autore: "workflow",
      });
      return `progetto ${creato.nome} creato`;
    }

    case "azione.webhook": {
      const url = String(c.url ?? "");
      if (!url.startsWith("http")) return "saltata: URL non valido";
      try {
        // Timeout esplicito: un endpoint lento non deve bloccare l'esecuzione.
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 8000);
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evento: ctx.evento, entita: ctx.entita, id: ctx.id, dati: ctx.dati }),
          signal: controller.signal,
        });
        clearTimeout(t);
        return `webhook ${r.status}`;
      } catch {
        return "webhook non raggiungibile";
      }
    }

    case "azione.email": {
      const { inviaEmail, emailConfigurata } = await import("../email");
      if (!emailConfigurata()) return "saltata: SMTP non configurato";
      const a = String(c.a ?? "") || String(ctx.dati.emailReferente ?? "");
      if (!a) return "saltata: nessun destinatario";
      const esito = await inviaEmail({
        a,
        oggetto: interpola(String(c.oggetto ?? ""), ctx),
        corpo: interpola(String(c.corpo ?? ""), ctx),
      });
      return esito ? `email inviata a ${a}` : "invio email fallito";
    }

    default:
      return `tipo sconosciuto: ${b.tipo}`;
  }
}

/**
 * Esegue un workflow su un contesto.
 *
 * Se una condizione non è soddisfatta il workflow si ferma senza errore: non
 * è un fallimento, semplicemente non era il caso di agire.
 */
export async function esegui(
  workflowId: string,
  schema: SchemaWorkflow,
  ctx: Contesto,
): Promise<EsitoEsecuzione> {
  const condizioni = schema.blocchi.filter((b) => b.tipo.startsWith("condizione."));
  const azioni = schema.blocchi.filter((b) => b.tipo.startsWith("azione."));

  for (const cond of condizioni) {
    if (!valutaCondizione(cond, ctx)) {
      const esito = `condizione non soddisfatta (${cond.tipo})`;
      await registra(workflowId, true, esito, ctx);
      return { successo: true, esito, azioniEseguite: [] };
    }
  }

  const eseguite: string[] = [];
  let successo = true;

  for (const az of azioni) {
    try {
      eseguite.push(await eseguiAzione(az, ctx));
    } catch (e) {
      successo = false;
      eseguite.push(`errore in ${az.tipo}: ${e instanceof Error ? e.message : "sconosciuto"}`);
    }
  }

  const esito = eseguite.length ? eseguite.join(" · ") : "nessuna azione configurata";
  await registra(workflowId, successo, esito, ctx);

  await prisma.workflow.update({
    where: { id: workflowId },
    data: { esecuzioni: { increment: 1 }, ultimaEsecuzione: new Date() },
  }).catch(() => {});

  return { successo, esito, azioniEseguite: eseguite };
}

async function registra(
  workflowId: string,
  successo: boolean,
  esito: string,
  ctx: Contesto,
) {
  try {
    await prisma.registroWorkflow.create({
      data: {
        workflowId,
        successo,
        esito,
        dettaglio: { evento: ctx.evento, entita: ctx.entita, id: ctx.id ?? null },
      },
    });
  } catch {
    /* il registro è accessorio */
  }
}

/**
 * Punto d'ingresso dal resto dell'app: cerca i workflow attivi per l'evento
 * e li esegue, poi notifica i webhook iscritti. Non solleva mai: un'auto-
 * mazione che fallisce non deve far fallire l'operazione che l'ha innescata.
 */
export async function scatena(evento: string, ctx: Omit<Contesto, "evento">) {
  try {
    const attivi = await prisma.workflow.findMany({
      where: { attivo: true, innesco: "EVENTO", eventoChiave: evento, eliminataIl: null },
    });
    for (const w of attivi) {
      await esegui(w.id, w.azioni as unknown as SchemaWorkflow ?? { blocchi: [], collegamenti: [] }, {
        ...ctx,
        evento,
      });
    }
  } catch {
    /* nessun impatto sull'operazione chiamante */
  }

  await notificaWebhook(evento, ctx);
}

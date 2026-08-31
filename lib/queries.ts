import { prisma } from "./prisma";
import { cached } from "./redis";
import { n } from "./format";
import { etichettaRevisione } from "./revisioni";

const TTL = 30; // secondi: i dati cambiano spesso, la cache serve a smorzare i picchi

/**
 * Dati della dashboard.
 *
 * Raccoglie ciò che richiede una decisione oggi — scadenze, criticità,
 * incassi in ritardo — invece dei soli totali: una dashboard serve a dire
 * cosa fare adesso, non solo com'è andata.
 */
export async function getDashboard() {
  return cached("dashboard", TTL, async () => {
    const oggi = new Date();
    const traSetteGiorni = new Date(Date.now() + 7 * 86400000);
    const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
    const inizioAnno = new Date(oggi.getFullYear(), 0, 1);

    const [
      progetti, attivita, ticket, fatture, oreSettimana, oreMese,
      preventivi, problemi, milestone, incassiMese, clienti,
    ] = await Promise.all([
      prisma.progetto.findMany({
        where: { stato: { in: ["IN_CORSO", "DA_AVVIARE"] }, eliminataIl: null },
        include: { cliente: true, registrazioni: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.attivita.findMany({
        where: { stato: { in: ["DA_FARE", "IN_CORSO", "BLOCCATA"] }, eliminataIl: null },
        include: { progetto: { include: { cliente: true } }, registrazioni: true },
        orderBy: [{ scadenzaIl: "asc" }],
      }),
      prisma.ticket.findMany({
        where: { stato: { notIn: ["RISOLTO", "CHIUSO"] }, eliminataIl: null },
        include: { cliente: true, registrazioni: true },
        orderBy: { apertoIl: "asc" },
      }),
      prisma.fattura.findMany({ where: { eliminataIl: null }, include: { cliente: true, incassi: true } }),
      prisma.registrazioneOre.findMany({ where: { data: { gte: inizioSettimana() }, eliminataIl: null } }),
      prisma.registrazioneOre.findMany({ where: { data: { gte: inizioMese }, eliminataIl: null } }),
      prisma.preventivo.findMany({
        where: { stato: { in: ["BOZZA", "INVIATO"] }, eliminataIl: null },
        include: { cliente: true },
        orderBy: { scadeIl: "asc" },
      }),
      prisma.problema.findMany({
        where: { stato: { in: ["APERTO", "IN_GESTIONE"] } },
        include: { progetto: true },
        orderBy: [{ gravita: "desc" }, { apertoIl: "asc" }],
      }),
      prisma.milestone.findMany({
        where: { completata: false, scadenzaIl: { not: null } },
        include: { progetto: { include: { cliente: true } } },
        orderBy: { scadenzaIl: "asc" },
        take: 6,
      }),
      prisma.incasso.findMany({ where: { data: { gte: inizioMese } } }),
      prisma.cliente.count({ where: { eliminataIl: null } }),
    ]);

    const emesso = fatture
      .filter((f) => f.stato !== "DA_EMETTERE")
      .reduce((s, f) => s + n(f.imponibile), 0);
    const incassato = fatture.reduce(
      (s, f) => s + f.incassi.reduce((x, i) => x + n(i.importo), 0),
      0,
    );
    const scadute = fatture.filter((f) => f.stato === "SCADUTA");

    // Ore non ancora legate a una riga di fattura: è denaro non richiesto.
    const daFatturareTutte = await prisma.registrazioneOre.findMany({
      where: { fatturabile: true, rigaFatturaId: null, eliminataIl: null },
      include: {
        progetto: { include: { cliente: true } },
        ticket: { include: { cliente: true } },
      },
    });
    const valoreDaFatturare = daFatturareTutte.reduce((s, r) => {
      const c = r.progetto?.cliente ?? r.ticket?.cliente;
      return s + n(r.ore) * n(c?.tariffaOraria ?? 0);
    }, 0);

    const mappaProgetti = progetti.map((p) => {
      const oreFatte = p.registrazioni.reduce((s, r) => s + n(r.ore), 0);
      const budget = n(p.budgetOre);
      return {
        id: p.id,
        nome: p.nome,
        cliente: p.cliente.ragioneSociale,
        stato: p.stato,
        valore: n(p.valore),
        budgetOre: budget,
        oreFatte,
        oltreBudget: oreFatte > budget,
        consegnaIl: p.consegnaIl,
        // Margine residuo alla tariffa del cliente: dice se il progetto regge.
        margine: n(p.valore) - oreFatte * n(p.cliente.tariffaOraria),
      };
    });

    const inScadenza = [
      ...attivita
        .filter((a) => a.scadenzaIl && new Date(a.scadenzaIl) <= traSetteGiorni)
        .map((a) => ({
          tipo: "attivita" as const,
          id: a.id,
          titolo: a.titolo,
          contesto: a.progetto?.nome ?? "Interna",
          scadenza: a.scadenzaIl!,
          bloccata: a.stato === "BLOCCATA",
        })),
      ...milestone
        .filter((m) => m.scadenzaIl && new Date(m.scadenzaIl) <= traSetteGiorni)
        .map((m) => ({
          tipo: "milestone" as const,
          id: m.progettoId,
          titolo: m.titolo,
          contesto: m.progetto.nome,
          scadenza: m.scadenzaIl!,
          bloccata: false,
        })),
      ...preventivi
        .filter((p) => p.scadeIl && new Date(p.scadeIl) <= traSetteGiorni)
        .map((p) => ({
          tipo: "preventivo" as const,
          id: p.id,
          titolo: `${p.numero} · ${p.titolo}`,
          contesto: p.cliente.ragioneSociale,
          scadenza: p.scadeIl!,
          bloccata: false,
        })),
    ].sort((a, b) => new Date(a.scadenza).getTime() - new Date(b.scadenza).getTime());

    return {
      // --- indicatori
      oreSettimana: oreSettimana.reduce((s, r) => s + n(r.ore), 0),
      oreMese: oreMese.reduce((s, r) => s + n(r.ore), 0),
      daFatturare: daFatturareTutte.reduce((s, r) => s + n(r.ore), 0),
      valoreDaFatturare,
      emesso,
      incassato,
      daIncassare: emesso - incassato,
      scaduto: scadute.reduce((s, f) => s + n(f.imponibile), 0),
      incassatoMese: incassiMese.reduce((s, i) => s + n(i.importo), 0),
      inTrattativa: preventivi.reduce((s, p) => s + n(p.imponibile), 0),
      clienti,

      // --- elenchi operativi
      progetti: mappaProgetti,
      progettiOltreBudget: mappaProgetti.filter((p) => p.oltreBudget).length,
      attivita: attivita.slice(0, 6).map((a) => ({
        id: a.id,
        titolo: a.titolo,
        progetto: a.progetto?.nome ?? "Interna",
        stato: a.stato,
        stimaOre: n(a.stimaOre),
        oreFatte: a.registrazioni.reduce((s, r) => s + n(r.ore), 0),
        scadenzaIl: a.scadenzaIl,
      })),
      attivitaAperte: attivita.length,
      bloccate: attivita.filter((a) => a.stato === "BLOCCATA").length,
      ticket: ticket.slice(0, 5).map((t) => ({
        id: t.id,
        numero: t.numero,
        titolo: t.titolo,
        cliente: t.cliente.ragioneSociale,
        stato: t.stato,
        priorita: t.priorita,
        apertoIl: t.apertoIl,
      })),
      ticketAperti: ticket.length,
      fattureScadute: scadute.map((f) => ({
        id: f.id,
        numero: f.numero,
        cliente: f.cliente.ragioneSociale,
        imponibile: n(f.imponibile),
        scadeIl: f.scadeIl,
      })),
      preventiviAperti: preventivi.slice(0, 5).map((p) => ({
        id: p.id,
        numero: p.numero,
        titolo: p.titolo,
        cliente: p.cliente.ragioneSociale,
        stato: p.stato,
        imponibile: n(p.imponibile),
        scadeIl: p.scadeIl,
      })),
      problemi: problemi.slice(0, 5).map((x) => ({
        id: x.progettoId,
        titolo: x.titolo,
        progetto: x.progetto.nome,
        gravita: x.gravita,
      })),
      problemiAperti: problemi.length,
      inScadenza: inScadenza.slice(0, 7),
      // Andamento ore delle ultime 8 settimane, per il grafico.
      settimane: await andamentoSettimane(),
    };
  });
}

/** Ore per settimana nelle ultime 8, escludendo i consuntivi storici. */
async function andamentoSettimane() {
  const righe = await prisma.registrazioneOre.findMany({
    where: {
      OR: [
        { descrizione: null },
        { descrizione: { not: "Consuntivo periodo precedente" } },
      ],
      eliminataIl: null,
    },
    select: { data: true, ore: true },
  });
  const out: { etichetta: string; ore: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const inizio = inizioSettimana();
    inizio.setUTCDate(inizio.getUTCDate() - i * 7);
    const fine = new Date(inizio);
    fine.setUTCDate(fine.getUTCDate() + 7);
    out.push({
      etichetta: `${inizio.getUTCDate()}/${inizio.getUTCMonth() + 1}`,
      ore: righe
        .filter((r) => new Date(r.data) >= inizio && new Date(r.data) < fine)
        .reduce((s, r) => s + n(r.ore), 0),
    });
  }
  return out;
}

export function inizioSettimana(base = new Date()) {
  const d = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()),
  );
  const giorno = (d.getUTCDay() + 6) % 7; // lunedì = 0
  d.setUTCDate(d.getUTCDate() - giorno);
  return d;
}

export async function getClienti() {
  return cached("clienti", TTL, async () => {
    const clienti = await prisma.cliente.findMany({
      where: { eliminataIl: null },
      include: {
        referenti: { where: { principale: true }, take: 1 },
        progetti: { select: { stato: true } },
        fatture: { select: { imponibile: true, stato: true } },
      },
      orderBy: { ragioneSociale: "asc" },
    });

    return clienti.map((c) => ({
      id: c.id,
      ragioneSociale: c.ragioneSociale,
      sigla: c.sigla,
      settore: c.settore,
      citta: c.citta,
      tariffaOraria: n(c.tariffaOraria),
      referente: c.referenti[0]
        ? `${c.referenti[0].nome[0]}. ${c.referenti[0].cognome}`
        : "—",
      attivi: c.progetti.filter((p) => p.stato === "IN_CORSO" || p.stato === "DA_AVVIARE").length,
      conclusi: c.progetti.filter((p) => p.stato === "CONCLUSO").length,
      fatturato: c.fatture
        .filter((f) => f.stato !== "DA_EMETTERE")
        .reduce((s, f) => s + n(f.imponibile), 0),
      syncedAt: c.syncedAt,
    }));
  });
}

export async function getCliente(id: string) {
  const c = await prisma.cliente.findUnique({
    where: { id },
    include: {
      referenti: true,
      progetti: { include: { registrazioni: true } },
      ticket: { orderBy: { apertoIl: "desc" }, take: 5 },
      fatture: { include: { incassi: true }, orderBy: { emessaIl: "desc" } },
      preventivi: { orderBy: { createdAt: "desc" } },
    },
  });
  return c;
}

export async function getPreventivi() {
  return cached("preventivi", TTL, async () => {
    const p = await prisma.preventivo.findMany({
      where: { eliminataIl: null },
      include: { cliente: true, voci: true },
      orderBy: { numero: "desc" },
    });
    return p.map((x) => ({
      id: x.id,
      numero: x.numero,
      revisione: etichettaRevisione(x.revisioneCorrente),
      titolo: x.titolo,
      cliente: x.cliente.ragioneSociale,
      stato: x.stato,
      imponibile: n(x.imponibile),
      voci: x.voci.length,
      scadeIl: x.scadeIl,
      inviatoIl: x.inviatoIl,
    }));
  });
}

export async function getProgetti() {
  return cached("progetti", TTL, async () => {
    const p = await prisma.progetto.findMany({
      where: { eliminataIl: null },
      include: {
        cliente: true,
        registrazioni: true,
        milestone: { where: { completata: false }, take: 1 },
        preventivo: { select: { numero: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return p.map((x) => ({
      id: x.id,
      nome: x.nome,
      cliente: x.cliente.ragioneSociale,
      stato: x.stato,
      valore: n(x.valore),
      budgetOre: n(x.budgetOre),
      oreFatte: x.registrazioni.reduce((s, r) => s + n(r.ore), 0),
      note: x.note,
      inizioIl: x.inizioIl,
      consegnaIl: x.consegnaIl,
      preventivo: x.preventivo?.numero ?? null,
      milestone: x.milestone[0] ?? null,
    }));
  });
}

export async function getAttivita() {
  return cached("attivita", TTL, async () => {
    const a = await prisma.attivita.findMany({
      where: { eliminataIl: null },
      include: { progetto: true, registrazioni: true },
      orderBy: [{ scadenzaIl: "asc" }, { createdAt: "asc" }],
    });
    return a.map((x) => ({
      id: x.id,
      titolo: x.titolo,
      progetto: x.progetto?.nome ?? "Interno",
      stato: x.stato,
      stimaOre: n(x.stimaOre),
      oreFatte: x.registrazioni.reduce((s, r) => s + n(r.ore), 0),
      scadenzaIl: x.scadenzaIl,
      bloccoNota: x.bloccoNota,
      completataIl: x.completataIl,
    }));
  });
}

export async function getTicket() {
  return cached("ticket", TTL, async () => {
    const t = await prisma.ticket.findMany({
      where: { eliminataIl: null },
      include: { cliente: true, progetto: true, registrazioni: true },
      orderBy: { numero: "desc" },
    });
    return t.map((x) => ({
      id: x.id,
      numero: x.numero,
      titolo: x.titolo,
      cliente: x.cliente.ragioneSociale,
      progetto: x.progetto?.nome ?? null,
      stato: x.stato,
      priorita: x.priorita,
      conContratto: x.conContratto,
      apertoIl: x.apertoIl,
      ore: x.registrazioni.reduce((s, r) => s + n(r.ore), 0),
      daFatturare: x.registrazioni
        .filter((r) => r.fatturabile && !r.rigaFatturaId)
        .reduce((s, r) => s + n(r.ore), 0),
    }));
  });
}

export async function getSettimana(offset = 0) {
  const inizio = inizioSettimana();
  inizio.setUTCDate(inizio.getUTCDate() + offset * 7);
  const fine = new Date(inizio);
  fine.setUTCDate(fine.getUTCDate() + 7);

  const righe = await prisma.registrazioneOre.findMany({
    where: { data: { gte: inizio, lt: fine }, eliminataIl: null },
    include: {
      progetto: true,
      attivita: true,
      ticket: true,
    },
    orderBy: { data: "asc" },
  });

  // Raggruppa per attività/ticket: una riga per la griglia settimanale.
  const gruppi = new Map<
    string,
    { etichetta: string; contesto: string; giorni: number[]; totale: number }
  >();

  for (const r of righe) {
    const chiave = r.attivitaId ?? r.ticketId ?? r.progettoId ?? "altro";
    const etichetta =
      r.attivita?.titolo ??
      (r.ticket ? `#${r.ticket.numero} ${r.ticket.titolo}` : null) ??
      r.progetto?.nome ??
      "Altro";
    const contesto = r.progetto?.nome ?? "—";

    if (!gruppi.has(chiave)) {
      gruppi.set(chiave, {
        etichetta,
        contesto,
        giorni: [0, 0, 0, 0, 0, 0, 0],
        totale: 0,
      });
    }
    const g = gruppi.get(chiave)!;
    const idx = Math.floor(
      (new Date(r.data).getTime() - inizio.getTime()) / 86400000,
    );
    if (idx >= 0 && idx < 7) g.giorni[idx] += n(r.ore);
    g.totale += n(r.ore);
  }

  return {
    inizio,
    fine,
    righe: [...gruppi.values()],
    totale: righe.reduce((s, r) => s + n(r.ore), 0),
    daFatturare: righe
      .filter((r) => r.fatturabile && !r.rigaFatturaId)
      .reduce((s, r) => s + n(r.ore), 0),
  };
}

export async function getFatture() {
  return cached("fatture", TTL, async () => {
    const f = await prisma.fattura.findMany({
      where: { eliminataIl: null },
      include: { cliente: true, incassi: true, righe: true },
      orderBy: { numero: "desc" },
    });
    return f.map((x) => ({
      id: x.id,
      numero: x.numero,
      cliente: x.cliente.ragioneSociale,
      stato: x.stato,
      imponibile: n(x.imponibile),
      incassato: x.incassi.reduce((s, i) => s + n(i.importo), 0),
      emessaIl: x.emessaIl,
      scadeIl: x.scadeIl,
    }));
  });
}

export async function getIncassi() {
  return cached("incassi", TTL, async () => {
    const [incassi, fatture] = await Promise.all([
      prisma.incasso.findMany({
        include: { fattura: { include: { cliente: true } } },
        orderBy: { data: "desc" },
      }),
      prisma.fattura.findMany({ where: { eliminataIl: null }, include: { incassi: true } }),
    ]);

    const emesso = fatture
      .filter((f) => f.stato !== "DA_EMETTERE")
      .reduce((s, f) => s + n(f.imponibile), 0);
    const incassato = incassi.reduce((s, i) => s + n(i.importo), 0);

    // Serie mensile per il grafico fatturato vs incassato.
    const mesi = Array.from({ length: 12 }, () => ({ fatturato: 0, incassato: 0 }));
    for (const f of fatture) {
      if (f.emessaIl) mesi[new Date(f.emessaIl).getMonth()].fatturato += n(f.imponibile);
    }
    for (const i of incassi) {
      mesi[new Date(i.data).getMonth()].incassato += n(i.importo);
    }

    return {
      emesso,
      incassato,
      daIncassare: emesso - incassato,
      scaduto: fatture
        .filter((f) => f.stato === "SCADUTA")
        .reduce((s, f) => s + n(f.imponibile), 0),
      mesi,
      movimenti: incassi.map((i) => ({
        id: i.id,
        data: i.data,
        fattura: i.fattura.numero,
        cliente: i.fattura.cliente.ragioneSociale,
        metodo: i.metodo,
        conto: i.conto,
        importo: n(i.importo),
        nota: i.nota,
      })),
    };
  });
}

export async function getImpostazioni() {
  const [imp, clienti, referenti] = await Promise.all([
    prisma.impostazioni.findUnique({ where: { id: 1 } }),
    prisma.cliente.count({ where: { eliminataIl: null } }),
    prisma.referente.count(),
  ]);
  return { imp, clienti, referenti };
}

/** Elenco minimo per i menu a tendina dei form. */
export async function getClientiPerSelezione() {
  const c = await prisma.cliente.findMany({
    where: { eliminataIl: null },
    select: {
      id: true,
      ragioneSociale: true,
      tariffaOraria: true,
      terminiPagamento: true,
      // Servono per scegliere il destinatario del preventivo.
      referenti: {
        select: { id: true, nome: true, cognome: true, ruolo: true },
        orderBy: [{ principale: "desc" }, { cognome: "asc" }],
      },
    },
    orderBy: { ragioneSociale: "asc" },
  });
  return c.map((x) => ({ ...x, tariffaOraria: n(x.tariffaOraria) }));
}

/** Predefiniti per il calcolo delle trasferte. */
export async function getPredefinitiTrasferta() {
  const imp = await prisma.impostazioni.findUnique({ where: { id: 1 } });
  return {
    modalita: imp?.modalitaTrasferta ?? "CHILOMETRICA",
    tariffaChilometrica: n(imp?.tariffaChilometrica ?? 0.5),
    forfait: n(imp?.forfaitTrasferta ?? 30),
  };
}

export async function getTariffaListino() {
  const imp = await prisma.impostazioni.findUnique({ where: { id: 1 } });
  return n(imp?.tariffaListino ?? 65);
}

/**
 * Tutto ciò che serve alla scheda di un progetto.
 *
 * Oltre ai dati grezzi calcola gli indicatori che rendono la pagina utile:
 * quanto è stato fatturato rispetto al valore, quanto vale il lavoro svolto,
 * e il margine che resta. Sono i numeri che dicono se il progetto sta andando
 * bene, non solo cosa contiene.
 */
export async function getProgettoCompleto(id: string) {
  const p = await prisma.progetto.findUnique({
    where: { id },
    include: {
      cliente: { include: { referenti: { where: { principale: true }, take: 1 } } },
      preventivo: { select: { id: true, numero: true, imponibile: true } },
      milestone: { orderBy: [{ completata: "asc" }, { scadenzaIl: "asc" }] },
      attivita: {
        include: { registrazioni: true },
        orderBy: [{ stato: "asc" }, { scadenzaIl: "asc" }],
      },
      ticket: { orderBy: { apertoIl: "desc" } },
      documenti: { orderBy: { createdAt: "desc" } },
      noteProgetto: { orderBy: { createdAt: "desc" } },
      problemi: { orderBy: [{ stato: "asc" }, { apertoIl: "desc" }] },
      eventi: { orderBy: { createdAt: "desc" }, take: 40 },
      registrazioni: {
        include: { attivita: { select: { titolo: true } }, ticket: { select: { numero: true } } },
        orderBy: { data: "desc" },
      },
    },
  });
  if (!p) return null;

  const oreFatte = p.registrazioni.reduce((s, r) => s + n(r.ore), 0);
  const budgetOre = n(p.budgetOre);
  const valore = n(p.valore);
  const tariffa = n(p.cliente.tariffaOraria);

  // Le ore già inserite in una fattura, contro quelle ancora da fatturare.
  const oreFatturate = p.registrazioni
    .filter((r) => r.rigaFatturaId)
    .reduce((s, r) => s + n(r.ore), 0);
  const oreDaFatturare = p.registrazioni
    .filter((r) => r.fatturabile && !r.rigaFatturaId)
    .reduce((s, r) => s + n(r.ore), 0);

  // Costo del lavoro svolto alla tariffa del cliente: serve a capire quanto
  // del valore concordato è già stato "consumato".
  const valoreLavorato = oreFatte * tariffa;

  // Andamento delle ultime 8 settimane, per vedere se il progetto è fermo.
  //
  // I consuntivi importati da periodi precedenti sono registrati con una data
  // singola ma rappresentano mesi di lavoro: inclusi nel grafico produrrebbero
  // una barra fuori scala che appiattisce tutte le altre. Li escludiamo,
  // restano comunque nel totale delle ore.
  const CONSUNTIVO = "Consuntivo periodo precedente";
  const settimane: { etichetta: string; ore: number }[] = [];
  const oggi = new Date();
  for (let i = 7; i >= 0; i--) {
    const inizio = inizioSettimana(oggi);
    inizio.setUTCDate(inizio.getUTCDate() - i * 7);
    const fine = new Date(inizio);
    fine.setUTCDate(fine.getUTCDate() + 7);
    const ore = p.registrazioni
      .filter((r) => {
        if (r.descrizione === CONSUNTIVO) return false;
        const d = new Date(r.data);
        return d >= inizio && d < fine;
      })
      .reduce((s, r) => s + n(r.ore), 0);
    settimane.push({
      etichetta: `${inizio.getUTCDate()}/${inizio.getUTCMonth() + 1}`,
      ore,
    });
  }

  const attivita = p.attivita.map((a) => ({
    id: a.id,
    titolo: a.titolo,
    stato: a.stato,
    stimaOre: n(a.stimaOre),
    oreFatte: a.registrazioni.reduce((s, r) => s + n(r.ore), 0),
    scadenzaIl: a.scadenzaIl,
    bloccoNota: a.bloccoNota,
  }));

  const problemi = p.problemi.map((x) => ({
    id: x.id,
    titolo: x.titolo,
    descrizione: x.descrizione,
    gravita: x.gravita,
    stato: x.stato,
    risoluzione: x.risoluzione,
    impattoOre: x.impattoOre === null ? null : n(x.impattoOre),
    segnalatoDa: x.segnalatoDa,
    apertoIl: x.apertoIl,
  }));

  return {
    id: p.id,
    nome: p.nome,
    stato: p.stato,
    note: p.note,
    repoGithub: p.repoGithub,
    branchGithub: p.branchGithub,
    problemi,
    problemiAperti: problemi.filter(
      (x) => x.stato === "APERTO" || x.stato === "IN_GESTIONE",
    ).length,
    eventi: p.eventi,
    inizioIl: p.inizioIl,
    consegnaIl: p.consegnaIl,
    cliente: {
      id: p.cliente.id,
      ragioneSociale: p.cliente.ragioneSociale,
      tariffaOraria: tariffa,
      referente: p.cliente.referenti[0]
        ? `${p.cliente.referenti[0].nome} ${p.cliente.referenti[0].cognome}`
        : null,
    },
    preventivo: p.preventivo
      ? { ...p.preventivo, imponibile: n(p.preventivo.imponibile) }
      : null,
    valore,
    budgetOre,
    oreFatte,
    oreFatturate,
    oreDaFatturare,
    valoreLavorato,
    margine: valore - valoreLavorato,
    daFatturare: oreDaFatturare * tariffa,
    settimane,
    attivita,
    milestone: p.milestone,
    ticket: p.ticket.map((t) => ({
      id: t.id,
      numero: t.numero,
      titolo: t.titolo,
      stato: t.stato,
      apertoIl: t.apertoIl,
    })),
    documenti: p.documenti,
    noteProgetto: p.noteProgetto,
    registrazioni: p.registrazioni.slice(0, 12).map((r) => ({
      id: r.id,
      data: r.data,
      ore: n(r.ore),
      descrizione:
        r.descrizione ??
        r.attivita?.titolo ??
        (r.ticket ? `Ticket #${r.ticket.numero}` : "—"),
      fatturata: Boolean(r.rigaFatturaId),
    })),
  };
}

/**
 * Scheda completa di un'attività.
 *
 * Oltre ai suoi campi porta le ore registrate e il contesto (progetto,
 * cliente): sono le informazioni che servono per capire a che punto è.
 */
export async function getAttivitaCompleta(id: string) {
  const a = await prisma.attivita.findUnique({
    where: { id },
    include: {
      progetto: { include: { cliente: true } },
      registrazioni: { orderBy: { data: "desc" } },
      note: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!a) return null;

  const oreFatte = a.registrazioni.reduce((s, r) => s + n(r.ore), 0);
  const stima = n(a.stimaOre);
  const tariffa = a.progetto ? n(a.progetto.cliente.tariffaOraria) : 0;

  return {
    id: a.id,
    titolo: a.titolo,
    stato: a.stato,
    stimaOre: stima,
    oreFatte,
    scadenzaIl: a.scadenzaIl,
    bloccoNota: a.bloccoNota,
    completataIl: a.completataIl,
    createdAt: a.createdAt,
    progetto: a.progetto
      ? {
          id: a.progetto.id,
          nome: a.progetto.nome,
          cliente: a.progetto.cliente.ragioneSociale,
          clienteId: a.progetto.clienteId,
        }
      : null,
    valoreLavorato: oreFatte * tariffa,
    oreDaFatturare: a.registrazioni
      .filter((r) => r.fatturabile && !r.rigaFatturaId)
      .reduce((s, r) => s + n(r.ore), 0),
    registrazioni: a.registrazioni.map((r) => ({
      id: r.id,
      data: r.data,
      ore: n(r.ore),
      descrizione: r.descrizione,
      fatturata: Boolean(r.rigaFatturaId),
    })),
    note: a.note,
  };
}

/** Scheda completa di un ticket. */
export async function getTicketCompleto(id: string) {
  const t = await prisma.ticket.findUnique({
    where: { id },
    include: {
      cliente: { include: { referenti: { where: { principale: true }, take: 1 } } },
      progetto: true,
      registrazioni: { orderBy: { data: "desc" } },
      costi: { orderBy: { data: "desc" } },
      note: { orderBy: { createdAt: "desc" } },
      documenti: { orderBy: { createdAt: "desc" } },
      contratto: true,
    },
  });
  if (!t) return null;

  const oreFatte = t.registrazioni.reduce((s, r) => s + n(r.ore), 0);
  const tariffa = n(t.cliente.tariffaOraria);
  const daFatturare = t.registrazioni
    .filter((r) => r.fatturabile && !r.rigaFatturaId)
    .reduce((s, r) => s + n(r.ore), 0);
  // Ripartizione utile a capire quanto del tempo è recuperabile.
  const oreFatturabili = t.registrazioni
    .filter((r) => r.fatturabile)
    .reduce((s, r) => s + n(r.ore), 0);
  const costiRimborsabili = t.costi
    .filter((c) => c.rimborsabile && !c.rigaFatturaId)
    .reduce((s, c) => s + n(c.importo), 0);
  const costiTotali = t.costi.reduce((s, c) => s + n(c.importo), 0);

  return {
    id: t.id,
    numero: t.numero,
    titolo: t.titolo,
    descrizione: t.descrizione,
    stato: t.stato,
    priorita: t.priorita,
    conContratto: t.conContratto,
    apertoIl: t.apertoIl,
    risoltoIl: t.risoltoIl,
    cliente: {
      id: t.cliente.id,
      ragioneSociale: t.cliente.ragioneSociale,
      tariffaOraria: tariffa,
      referente: t.cliente.referenti[0]
        ? `${t.cliente.referenti[0].nome} ${t.cliente.referenti[0].cognome}`
        : null,
    },
    progetto: t.progetto ? { id: t.progetto.id, nome: t.progetto.nome } : null,
    oreFatte,
    oreDaFatturare: daFatturare,
    valoreLavorato: oreFatte * tariffa,
    daFatturare: daFatturare * tariffa,
    registrazioni: t.registrazioni.map((r) => ({
      id: r.id,
      data: r.data,
      ore: n(r.ore),
      descrizione: r.descrizione,
      fatturata: Boolean(r.rigaFatturaId),
    })),
    oreFatturabili,
    oreNonFatturabili: oreFatte - oreFatturabili,
    costiTotali,
    costiRimborsabili,
    costi: t.costi.map((c) => ({
      id: c.id,
      data: c.data,
      tipo: c.tipo,
      descrizione: c.descrizione,
      importo: n(c.importo),
      quantita: c.quantita === null ? null : n(c.quantita),
      tariffa: c.tariffa === null ? null : n(c.tariffa),
      modalita: c.modalita,
      rimborsabile: c.rimborsabile,
      fatturato: Boolean(c.rigaFatturaId),
    })),
    note: t.note,
    documenti: t.documenti,
    contratto: t.contratto
      ? { id: t.contratto.id, numero: t.contratto.numero, titolo: t.contratto.titolo }
      : null,
  };
}

/** Elenco contratti con il consumo del periodo corrente. */
export async function getContratti() {
  const contratti = await prisma.contratto.findMany({
    where: { eliminataIl: null },
    include: { cliente: true, progetto: true },
    orderBy: [{ stato: "asc" }, { inizioIl: "desc" }],
  });

  const { consumoPeriodo, giorniAllaScadenza } = await import("./contratti");

  return Promise.all(
    contratti.map(async (c) => {
      const consumo =
        c.tipo === "ASSISTENZA_ORE" && c.stato === "ATTIVO"
          ? await consumoPeriodo(c.id)
          : null;
      return {
        id: c.id,
        numero: c.numero,
        titolo: c.titolo,
        cliente: c.cliente.ragioneSociale,
        clienteId: c.clienteId,
        progetto: c.progetto?.nome ?? null,
        tipo: c.tipo,
        stato: c.stato,
        canone: n(c.canone),
        periodicita: c.periodicita,
        monteOre: c.monteOre === null ? null : n(c.monteOre),
        inizioIl: c.inizioIl,
        scadeIl: c.scadeIl,
        rinnovoAutomatico: c.rinnovoAutomatico,
        giorniAllaScadenza: giorniAllaScadenza(c.scadeIl),
        consumo,
      };
    }),
  );
}

/** Scheda completa di un contratto. */
export async function getContrattoCompleto(id: string) {
  const c = await prisma.contratto.findUnique({
    where: { id },
    include: {
      cliente: { include: { referenti: { where: { principale: true }, take: 1 } } },
      progetto: true,
      documenti: { orderBy: { createdAt: "desc" } },
      periodi: { orderBy: { inizioIl: "desc" }, take: 12 },
      ticket: { orderBy: { apertoIl: "desc" }, include: { registrazioni: true } },
    },
  });
  if (!c) return null;

  const { consumoPeriodo, giorniAllaScadenza } = await import("./contratti");
  const consumo = c.tipo === "ASSISTENZA_ORE" ? await consumoPeriodo(id) : null;

  return {
    id: c.id,
    numero: c.numero,
    titolo: c.titolo,
    tipo: c.tipo,
    stato: c.stato,
    canone: n(c.canone),
    periodicita: c.periodicita,
    monteOre: c.monteOre === null ? null : n(c.monteOre),
    tariffaExtra: c.tariffaExtra === null ? null : n(c.tariffaExtra),
    inizioIl: c.inizioIl,
    scadeIl: c.scadeIl,
    rinnovoAutomatico: c.rinnovoAutomatico,
    preavvisoGiorni: c.preavvisoGiorni,
    note: c.note,
    giorniAllaScadenza: giorniAllaScadenza(c.scadeIl),
    cliente: {
      id: c.cliente.id,
      ragioneSociale: c.cliente.ragioneSociale,
      tariffaOraria: n(c.cliente.tariffaOraria),
      referente: c.cliente.referenti[0]
        ? `${c.cliente.referenti[0].nome} ${c.cliente.referenti[0].cognome}`
        : null,
    },
    progetto: c.progetto ? { id: c.progetto.id, nome: c.progetto.nome } : null,
    consumo,
    documenti: c.documenti,
    periodi: c.periodi.map((p) => ({
      id: p.id,
      inizioIl: p.inizioIl,
      fineIl: p.fineIl,
      monteOre: p.monteOre === null ? null : n(p.monteOre),
      fatturato: Boolean(p.fatturaId),
    })),
    ticket: c.ticket.map((t) => ({
      id: t.id,
      numero: t.numero,
      titolo: t.titolo,
      stato: t.stato,
      ore: t.registrazioni.reduce((s, r) => s + n(r.ore), 0),
      apertoIl: t.apertoIl,
    })),
  };
}

/** Opzioni per il selettore di inserimento ore. */
export async function getRiferimentiOre() {
  const [progetti, attivita, ticket] = await Promise.all([
    prisma.progetto.findMany({
      where: { stato: { in: ["IN_CORSO", "DA_AVVIARE", "IN_PAUSA"] }, eliminataIl: null },
      include: { cliente: true },
      orderBy: { nome: "asc" },
    }),
    prisma.attivita.findMany({
      where: { stato: { not: "FATTA" }, eliminataIl: null },
      include: { progetto: true },
      orderBy: { titolo: "asc" },
    }),
    prisma.ticket.findMany({
      where: { stato: { notIn: ["RISOLTO", "CHIUSO"] }, eliminataIl: null },
      include: { cliente: true },
      orderBy: { numero: "desc" },
    }),
  ]);

  return {
    progetti: progetti.map((p) => ({
      id: p.id,
      etichetta: `${p.nome} · ${p.cliente.ragioneSociale}`,
    })),
    attivita: attivita.map((a) => ({
      id: a.id,
      etichetta: a.progetto ? `${a.titolo} · ${a.progetto.nome}` : a.titolo,
    })),
    ticket: ticket.map((t) => ({
      id: t.id,
      etichetta: `#${t.numero} ${t.titolo} · ${t.cliente.ragioneSociale}`,
    })),
  };
}

/** Fatture emesse con un residuo da incassare. */
export async function getFattureDaIncassare() {
  const fatture = await prisma.fattura.findMany({
    where: { stato: { in: ["EMESSA", "SCADUTA"] }, eliminataIl: null },
    include: { cliente: true, incassi: true },
    orderBy: { scadeIl: "asc" },
  });

  return fatture
    .map((f) => ({
      id: f.id,
      numero: f.numero,
      cliente: f.cliente.ragioneSociale,
      residuo: n(f.imponibile) - f.incassi.reduce((s, i) => s + n(i.importo), 0),
    }))
    // Una fattura già coperta non deve comparire tra quelle da incassare.
    .filter((f) => f.residuo > 0.01);
}

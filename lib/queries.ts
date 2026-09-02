import { prisma } from "./prisma";
import { cached } from "./redis";
import { n } from "./format";
import { etichettaRevisione } from "./revisioni";
import { calcolaFiscale, type CalcoloFiscale, type RegimeCalcolo } from "./tasse";
import { assicuraRegimeForfettarioDefault } from "./regimi-fiscali";

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
        cliente: p.cliente?.ragioneSociale ?? "Interno",
        stato: p.stato,
        valore: n(p.valore),
        budgetOre: budget,
        oreFatte,
        oltreBudget: oreFatte > budget,
        consegnaIl: p.consegnaIl,
        // Margine residuo alla tariffa del cliente: dice se il progetto regge.
        // Un progetto interno non ha una tariffa cliente da confrontare: il
        // margine coincide col valore assegnato, che qui rappresenta il
        // budget interno più che un ricavo.
        margine: n(p.valore) - oreFatte * n(p.cliente?.tariffaOraria ?? 0),
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

export function inizioMese(offset = 0, base = new Date()) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1));
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
      progetti: { include: { registrazioni: true }, orderBy: { updatedAt: "desc" } },
      ticket: { orderBy: { apertoIl: "desc" } },
      fatture: { include: { incassi: true }, orderBy: { emessaIl: "desc" } },
      preventivi: { orderBy: { createdAt: "desc" } },
      contratti: { orderBy: { createdAt: "desc" } },
      // Ore registrate direttamente sul cliente, non su un progetto/ticket:
      // lavoro generico che non appartiene a nient'altro.
      registrazioni: { where: { eliminataIl: null }, orderBy: { data: "desc" } },
      documenti: { where: { eliminataIl: null }, orderBy: { createdAt: "desc" } },
      licenze: {
        where: { eliminataIl: null },
        include: {
          prodotto: { select: { id: true, nome: true, modalitaLicenza: true, chiavePubblicaMaster: true } },
          piano: { select: { nome: true } },
        },
        orderBy: { createdAt: "desc" },
      },
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
      cliente: x.cliente?.ragioneSociale ?? "Interno",
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
      cliente: true,
    },
    orderBy: { data: "asc" },
  });

  // Raggruppa per attività/ticket/cliente: una riga per la griglia settimanale.
  const gruppi = new Map<
    string,
    { etichetta: string; contesto: string; giorni: number[]; totale: number }
  >();

  for (const r of righe) {
    const chiave = r.attivitaId ?? r.ticketId ?? r.progettoId ?? r.clienteId ?? "altro";
    const etichetta =
      r.attivita?.titolo ??
      (r.ticket ? `#${r.ticket.numero} ${r.ticket.titolo}` : null) ??
      r.progetto?.nome ??
      r.cliente?.ragioneSociale ??
      "Altro";
    const contesto = r.progetto?.nome ?? (r.cliente ? "lavoro generico" : "—");

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

/** Scheda completa di una fattura: righe, cliente, azienda emittente, incassi. */
export async function getFatturaCompleta(id: string) {
  const f = await prisma.fattura.findUnique({
    where: { id },
    include: {
      cliente: true,
      azienda: true,
      righe: { orderBy: { ordine: "asc" } },
      incassi: { include: { conto: true }, orderBy: { data: "desc" } },
    },
  });
  if (!f) return null;

  const incassato = f.incassi.reduce((s, i) => s + n(i.importo), 0);
  const imponibile = n(f.imponibile);

  return {
    id: f.id,
    numero: f.numero,
    stato: f.stato,
    imponibile,
    aliquotaIva: n(f.aliquotaIva),
    emessaIl: f.emessaIl,
    scadeIl: f.scadeIl,
    createdAt: f.createdAt,
    cliente: { id: f.cliente.id, ragioneSociale: f.cliente.ragioneSociale },
    azienda: f.azienda ? { id: f.azienda.id, ragioneSociale: f.azienda.ragioneSociale } : null,
    righe: f.righe.map((r) => ({
      id: r.id,
      descrizione: r.descrizione,
      quantita: n(r.quantita),
      prezzo: n(r.prezzo),
      totale: n(r.quantita) * n(r.prezzo),
    })),
    incassato,
    residuo: imponibile - incassato,
    incassi: f.incassi.map((i) => ({
      id: i.id,
      data: i.data,
      importo: n(i.importo),
      metodo: i.metodo,
      conto: i.conto?.nome ?? null,
      nota: i.nota,
    })),
  };
}

export async function getIncassi() {
  return cached("incassi", TTL, async () => {
    const [incassi, fatture] = await Promise.all([
      prisma.incasso.findMany({
        include: { fattura: { include: { cliente: true } }, conto: true },
        orderBy: { data: "desc" },
      }),
      prisma.fattura.findMany({ where: { eliminataIl: null }, include: { incassi: true } }),
    ]);

    // Quanto è arrivato su ciascun conto: un incasso senza conto assegnato
    // finisce nel gruppo "Non specificato", visibile invece di sparire.
    const perContoMappa = new Map<string, number>();
    for (const i of incassi) {
      const chiave = i.conto?.nome ?? "Non specificato";
      perContoMappa.set(chiave, (perContoMappa.get(chiave) ?? 0) + n(i.importo));
    }
    const perConto = Array.from(perContoMappa, ([nome, importo]) => ({ nome, importo }))
      .sort((a, b) => b.importo - a.importo);

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
      perConto,
      movimenti: incassi.map((i) => ({
        id: i.id,
        data: i.data,
        fattura: i.fattura.numero,
        cliente: i.fattura.cliente.ragioneSociale,
        metodo: i.metodo,
        conto: i.conto?.nome ?? null,
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

/** Progetti non chiusi, per collegare un ticket a un progetto in corso. */
export async function getProgettiPerSelezione() {
  const p = await prisma.progetto.findMany({
    where: { eliminataIl: null, stato: { not: "CONCLUSO" } },
    select: { id: true, nome: true, clienteId: true },
    orderBy: { nome: "asc" },
  });
  return p;
}

/** Contratti attivi, per collegare una licenza al contratto che ne copre il canone. */
export async function getContrattiPerSelezione() {
  const c = await prisma.contratto.findMany({
    where: { eliminataIl: null, stato: "ATTIVO" },
    select: { id: true, numero: true, clienteId: true },
    orderBy: { numero: "desc" },
  });
  return c;
}

/** Catalogo prodotti, per collegarli a un contratto. */
export async function getProdottiPerSelezione() {
  const p = await prisma.prodotto.findMany({
    where: { eliminataIl: null },
    select: {
      id: true,
      nome: true,
      piani: {
        where: { eliminataIl: null },
        select: { id: true, nome: true, canone: true },
        orderBy: { canone: "asc" },
      },
    },
    orderBy: { nome: "asc" },
  });
  return p.map((x) => ({
    id: x.id,
    nome: x.nome,
    piani: x.piani.map((pi) => ({ id: pi.id, nome: pi.nome, canone: n(pi.canone) })),
  }));
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
  // Un progetto interno non ha una tariffa cliente contro cui misurare il
  // lavoro svolto: il "valore lavorato" resta 0, non ha un prezzo di mercato.
  const tariffa = n(p.cliente?.tariffaOraria ?? 0);

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
    cliente: p.cliente
      ? {
          id: p.cliente.id,
          ragioneSociale: p.cliente.ragioneSociale,
          tariffaOraria: tariffa,
          referente: p.cliente.referenti[0]
            ? `${p.cliente.referenti[0].nome} ${p.cliente.referenti[0].cognome}`
            : null,
        }
      : null,
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
  const tariffa = a.progetto?.cliente ? n(a.progetto.cliente.tariffaOraria) : 0;

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
          cliente: a.progetto.cliente?.ragioneSociale ?? "Interno",
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
      licenze: { where: { eliminataIl: null }, include: { prodotto: true } },
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
    prodotti: c.licenze.map((l) => ({
      licenzaId: l.id,
      id: l.prodotto.id,
      nome: l.prodotto.nome,
      stato: l.stato,
    })),
  };
}

/** Opzioni per il selettore di inserimento ore. */
export async function getRiferimentiOre() {
  const [progetti, attivita, ticket, clienti] = await Promise.all([
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
    // Per registrare ore direttamente su un cliente, senza passare da un
    // progetto/attività/ticket: lavoro generico che non appartiene a nient'altro.
    prisma.cliente.findMany({
      where: { eliminataIl: null },
      select: { id: true, ragioneSociale: true },
      orderBy: { ragioneSociale: "asc" },
    }),
  ]);

  return {
    progetti: progetti.map((p) => ({
      id: p.id,
      etichetta: p.cliente ? `${p.nome} · ${p.cliente.ragioneSociale}` : `${p.nome} · Interno`,
    })),
    attivita: attivita.map((a) => ({
      id: a.id,
      etichetta: a.progetto ? `${a.titolo} · ${a.progetto.nome}` : a.titolo,
    })),
    ticket: ticket.map((t) => ({
      id: t.id,
      etichetta: `#${t.numero} ${t.titolo} · ${t.cliente.ragioneSociale}`,
    })),
    clienti: clienti.map((c) => ({
      id: c.id,
      etichetta: c.ragioneSociale,
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
      scadeIl: f.scadeIl,
      residuo: n(f.imponibile) - f.incassi.reduce((s, i) => s + n(i.importo), 0),
    }))
    // Una fattura già coperta non deve comparire tra quelle da incassare.
    .filter((f) => f.residuo > 0.01);
}

/** Catalogo prodotti (software propri venduti a più clienti), con licenze attive. */
export async function getProdotti() {
  const p = await prisma.prodotto.findMany({
    where: { eliminataIl: null },
    include: {
      progetto: { select: { nome: true } },
      licenze: { where: { eliminataIl: null } },
      piani: { where: { eliminataIl: null } },
    },
    orderBy: { nome: "asc" },
  });
  return p.map((x) => ({
    id: x.id,
    nome: x.nome,
    descrizione: x.descrizione,
    prezzoListino: x.prezzoListino === null ? null : n(x.prezzoListino),
    progetto: x.progetto?.nome ?? null,
    piani: x.piani.length,
    licenzeAttive: x.licenze.filter((l) => l.stato === "ATTIVA").length,
    licenzeTotali: x.licenze.length,
  }));
}

/** Scheda completa di un prodotto, con i piani e le licenze per cliente. */
export async function getProdottoCompleto(id: string) {
  const p = await prisma.prodotto.findUnique({
    where: { id },
    include: {
      progetto: { select: { id: true, nome: true } },
      piani: { where: { eliminataIl: null }, orderBy: { canone: "asc" } },
      licenze: {
        where: { eliminataIl: null },
        include: { cliente: true, contratto: { select: { id: true, numero: true } }, piano: true },
        orderBy: { createdAt: "desc" },
      },
      documenti: { where: { eliminataIl: null }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!p) return null;

  return {
    id: p.id,
    nome: p.nome,
    descrizione: p.descrizione,
    prezzoListino: p.prezzoListino === null ? null : n(p.prezzoListino),
    progetto: p.progetto,
    documenti: p.documenti,
    modalitaLicenza: p.modalitaLicenza,
    // Mai la privata (nemmeno cifrata): questa query arriva a un Server
    // Component che la passa a Client Component, e non deve mai finire
    // serializzata nel payload React verso il browser.
    chiavePubblicaMaster: p.chiavePubblicaMaster,
    chiaveMasterGenerataIl: p.chiaveMasterGenerataIl,
    piani: p.piani.map((pi) => ({
      id: pi.id,
      nome: pi.nome,
      descrizione: pi.descrizione,
      canone: n(pi.canone),
      periodicita: pi.periodicita,
      terminiPagamento: pi.terminiPagamento,
      monteOre: pi.monteOre === null ? null : n(pi.monteOre),
      tariffaExtra: pi.tariffaExtra === null ? null : n(pi.tariffaExtra),
    })),
    licenze: p.licenze.map((l) => ({
      id: l.id,
      cliente: { id: l.cliente.id, ragioneSociale: l.cliente.ragioneSociale },
      contratto: l.contratto ? { id: l.contratto.id, numero: l.contratto.numero } : null,
      piano: l.piano ? { id: l.piano.id, nome: l.piano.nome } : null,
      stato: l.stato,
      attivataIl: l.attivataIl,
      scadeIl: l.scadeIl,
      // Il canone effettivo viene dal piano quando c'è: la licenza smette di
      // averne uno proprio nel momento in cui sceglie un piano.
      canone: l.piano ? n(l.piano.canone) : l.canone === null ? null : n(l.canone),
      note: l.note,
      chiavePubblicaLicenza: l.chiavePubblicaLicenza,
      fileLicenzaGeneratoIl: l.fileLicenzaGeneratoIl,
    })),
  };
}

/** Milestone di progetto non ancora completate, senza filtro sulla scadenza. */
export async function getMilestoneAperte() {
  return cached("milestone-aperte", TTL, async () => {
    const m = await prisma.milestone.findMany({
      where: { completata: false, progetto: { eliminataIl: null } },
      include: { progetto: { include: { cliente: true } } },
      orderBy: { scadenzaIl: "asc" },
    });
    return m.map((x) => ({
      id: x.id,
      titolo: x.titolo,
      scadenzaIl: x.scadenzaIl,
      progettoId: x.progettoId,
      progetto: x.progetto.nome,
      cliente: x.progetto.cliente?.ragioneSociale ?? "Interno",
    }));
  });
}

export type EventoCalendario = {
  tipo: "progetto" | "attivita" | "milestone" | "contratto" | "fattura";
  id: string;
  titolo: string;
  inizio: Date;
  fine: Date | null;
  contesto: string;
  link: string;
};

/** Eventi unificati per la vista Calendario/Gantt: progetti, attività, milestone, contratti, fatture da incassare. */
export async function getCalendario() {
  return cached("calendario", TTL, async () => {
    const [progetti, attivita, milestone, contratti, fattureDaIncassare] = await Promise.all([
      getProgetti(),
      getAttivita(),
      getMilestoneAperte(),
      getContratti(),
      getFattureDaIncassare(),
    ]);

    const eventi: EventoCalendario[] = [];

    for (const p of progetti) {
      if (!p.inizioIl && !p.consegnaIl) continue;
      eventi.push({
        tipo: "progetto",
        id: p.id,
        titolo: p.nome,
        inizio: p.inizioIl ?? p.consegnaIl!,
        fine: p.consegnaIl,
        contesto: p.cliente,
        link: `/progetti/${p.id}`,
      });
    }

    for (const a of attivita) {
      if (!a.scadenzaIl) continue;
      eventi.push({
        tipo: "attivita",
        id: a.id,
        titolo: a.titolo,
        inizio: a.scadenzaIl,
        fine: null,
        contesto: a.progetto,
        link: `/attivita/${a.id}`,
      });
    }

    for (const m of milestone) {
      if (!m.scadenzaIl) continue;
      eventi.push({
        tipo: "milestone",
        id: m.id,
        titolo: m.titolo,
        inizio: m.scadenzaIl,
        fine: null,
        contesto: m.progetto,
        link: `/progetti/${m.progettoId}`,
      });
    }

    for (const c of contratti) {
      eventi.push({
        tipo: "contratto",
        id: c.id,
        titolo: `${c.numero} · ${c.titolo}`,
        inizio: c.inizioIl,
        fine: c.scadeIl,
        contesto: c.cliente,
        link: `/contratti/${c.id}`,
      });
    }

    for (const f of fattureDaIncassare) {
      if (!f.scadeIl) continue;
      eventi.push({
        tipo: "fattura",
        id: f.id,
        titolo: `Fattura ${f.numero}`,
        inizio: f.scadeIl,
        fine: null,
        contesto: f.cliente,
        link: `/fatture`,
      });
    }

    return eventi;
  });
}

export type RisultatoTasse = {
  anno: number;
  calcoli: (CalcoloFiscale & { aziendaId: string; aziendaNome: string })[];
  aggregato: {
    incassatoAnno: number;
    contributiInpsDovuti: number;
    impostaSostitutivaDovuta: number;
    totaleDaAccantonare: number;
    nettoResiduo: number;
  } | null;
  nonCalcolabile: { incassato: number; aziende: { id: string; nome: string }[] } | null;
};

/**
 * Calcolo fiscale sull'incassato dell'anno (filtro su Incasso.data, non su
 * Fattura.emessaIl: il forfettario tassa per cassa). aziendaId=null aggrega
 * su tutte le aziende — MAI sommando "redditi lordi forfettari" tra aziende
 * con coefficienti/aliquote diversi prima di applicare le aliquote (produrrebbe
 * un numero fiscalmente insensato): si calcola ogni azienda separatamente e
 * si sommano solo i risultati finali per i KPI aggregati.
 *
 * Non passa da cached(): i suoi input (incassi appena registrati, regime
 * appena cambiato in Impostazioni) sono troppo sensibili a un TTL di 30s per
 * una pagina che l'utente guarda apposta per una cifra da accantonare ora.
 */
export async function getTasse(anno?: number, aziendaId?: string | null): Promise<RisultatoTasse> {
  await assicuraRegimeForfettarioDefault();
  const annoCalcolo = anno ?? new Date().getFullYear();
  const inizio = new Date(Date.UTC(annoCalcolo, 0, 1));
  const fine = new Date(Date.UTC(annoCalcolo + 1, 0, 1));

  const incassi = await prisma.incasso.findMany({
    where: {
      data: { gte: inizio, lt: fine },
      fattura: { eliminataIl: null, ...(aziendaId ? { aziendaId } : {}) },
    },
    select: {
      importo: true,
      fattura: {
        select: {
          azienda: {
            select: {
              id: true,
              ragioneSociale: true,
              regimeFiscaleRel: {
                select: {
                  nome: true,
                  coefficienteRedditivita: true,
                  aliquotaSostitutiva: true,
                  aliquotaInps: true,
                  minimaleInps: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const perAzienda = new Map<string, { nome: string; incassato: number; regime: RegimeCalcolo | null }>();
  let incassatoSenzaAzienda = 0;

  for (const i of incassi) {
    const importo = n(i.importo);
    const azienda = i.fattura.azienda;
    if (!azienda) {
      incassatoSenzaAzienda += importo;
      continue;
    }
    const voce = perAzienda.get(azienda.id) ?? {
      nome: azienda.ragioneSociale,
      incassato: 0,
      regime: azienda.regimeFiscaleRel
        ? {
            nome: azienda.regimeFiscaleRel.nome,
            coefficienteRedditivita: n(azienda.regimeFiscaleRel.coefficienteRedditivita),
            aliquotaSostitutiva: n(azienda.regimeFiscaleRel.aliquotaSostitutiva),
            aliquotaInps: n(azienda.regimeFiscaleRel.aliquotaInps),
            minimaleInps: azienda.regimeFiscaleRel.minimaleInps !== null ? n(azienda.regimeFiscaleRel.minimaleInps) : null,
          }
        : null,
    };
    voce.incassato += importo;
    perAzienda.set(azienda.id, voce);
  }

  const calcoli: RisultatoTasse["calcoli"] = [];
  const nonCalcolabile = { incassato: incassatoSenzaAzienda, aziende: [] as { id: string; nome: string }[] };

  for (const [id, v] of perAzienda) {
    if (!v.regime) {
      nonCalcolabile.incassato += v.incassato;
      nonCalcolabile.aziende.push({ id, nome: v.nome });
      continue;
    }
    calcoli.push({ aziendaId: id, aziendaNome: v.nome, ...calcolaFiscale(v.incassato, v.regime) });
  }

  const aggregato = calcoli.length > 0
    ? {
        incassatoAnno: calcoli.reduce((s, c) => s + c.incassatoAnno, 0),
        contributiInpsDovuti: calcoli.reduce((s, c) => s + c.contributiInpsDovuti, 0),
        impostaSostitutivaDovuta: calcoli.reduce((s, c) => s + c.impostaSostitutivaDovuta, 0),
        totaleDaAccantonare: calcoli.reduce((s, c) => s + c.totaleDaAccantonare, 0),
        nettoResiduo: calcoli.reduce((s, c) => s + c.nettoResiduo, 0),
      }
    : null;

  return {
    anno: annoCalcolo,
    calcoli,
    aggregato,
    nonCalcolabile: nonCalcolabile.incassato > 0 ? nonCalcolabile : null,
  };
}

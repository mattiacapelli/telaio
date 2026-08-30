// Seed con i dati mostrati nel design (Studio Ferrero, agosto 2026).
// Idempotente: se ci sono già clienti non fa nulla, così l'entrypoint Docker
// può eseguirlo a ogni avvio senza duplicare.
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);
const d = (s) => new Date(`${s}T00:00:00.000Z`);

/** Stesso formato usato da lib/auth.ts: scrypt:<sale>:<hash>. */
async function hashPassword(password) {
  const sale = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, sale, 64);
  return `scrypt:${sale}:${hash.toString("hex")}`;
}

/** Data relativa a oggi, per avere sempre dati freschi alla riesecuzione. */
function fraGiorni(n) {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() + n);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

async function main() {
  // L'idempotenza guarda gli utenti, non i clienti: l'anagrafica può
  // arrivare dal sync con Twenty su un database senza account, e in quel caso
  // il seed deve comunque creare l'utente di accesso.
  if ((await prisma.utente.count()) > 0) {
    console.log("Database già popolato: seed saltato.");
    return;
  }

  // Utente di accesso: senza, l'applicazione non è utilizzabile.
  // La password va cambiata al primo accesso con scripts/utente.mjs.
  await prisma.utente.create({
    data: {
      email: "marco@studioferrero.it",
      nome: "Marco Ferrero",
      passwordHash: await hashPassword(process.env.SEED_PASSWORD ?? "Telaio2026!"),
    },
  });

  await prisma.impostazioni.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      ragioneSociale: "Marco Ferrero",
      partitaIva: "IT 03118420127",
      iban: "IT60 X054 2811 1010 0000 0123 456",
      tariffaListino: 65,
      terminiPagamento: 30,
      twentyWorkspace: "ferrero.twenty.com",
      twentySyncedAt: new Date(),
      twentyFrequenza: 15,
    },
  });

  const clienti = [
    { k: "bonaldi", ragioneSociale: "Vetrerie Bonaldi S.r.l.", sigla: "VB", settore: "Manifattura", citta: "Brescia", partitaIva: "IT 02914770981", tariffaOraria: 68, referente: ["Luca", "Bonaldi", "Titolare"] },
    { k: "alpe", ragioneSociale: "Alpe Logistica", sigla: "AL", settore: "Trasporti", citta: "Bolzano", tariffaOraria: 65, referente: ["Stefan", "Weger", "Responsabile IT"] },
    { k: "ferrante", ragioneSociale: "Studio Ferrante Architetti", sigla: "SF", settore: "Servizi", citta: "Torino", tariffaOraria: 58, referente: ["Giulia", "Ferrante", "Socia"] },
    { k: "nuvolab", ragioneSociale: "Nuvolab", sigla: "NL", settore: "Software", citta: "Milano", tariffaOraria: 75, referente: ["Carlo", "Tinelli", "CTO"] },
    { k: "riva", ragioneSociale: "Farmacie Riva", sigla: "FR", settore: "Retail", citta: "Como", tariffaOraria: 70, referente: ["Elena", "Riva", "Titolare"] },
    { k: "sanrocco", ragioneSociale: "Poliambulatorio San Rocco", sigla: "PS", settore: "Sanità", citta: "Bergamo", tariffaOraria: 62, referente: ["Anna", "Zappa", "Direzione"] },
  ];

  const C = {};
  for (const c of clienti) {
    const { k, referente, ...dati } = c;
    C[k] = await prisma.cliente.create({
      data: {
        ...dati,
        syncedAt: new Date(),
        referenti: {
          create: {
            nome: referente[0],
            cognome: referente[1],
            ruolo: referente[2],
            principale: true,
          },
        },
      },
    });
  }

  // ------------------------------------------------------------ preventivi
  const preventivi = [
    { numero: "PRE-2026/021", titolo: "Restyling area clienti", cliente: "nuvolab", stato: "BOZZA", imponibile: 9000 },
    { numero: "PRE-2026/022", titolo: "Integrazione fatturazione", cliente: "sanrocco", stato: "BOZZA", imponibile: 4200 },
    { numero: "PRE-2026/018", titolo: "Gestionale turni farmacie", cliente: "riva", stato: "INVIATO", imponibile: 9400, inviatoIl: d("2026-08-21"), scadeIl: d("2026-09-02") },
    { numero: "PRE-2026/019", titolo: "API tracking spedizioni", cliente: "alpe", stato: "INVIATO", imponibile: 11600, inviatoIl: d("2026-08-24") },
    { numero: "PRE-2026/020", titolo: "Sito vetrina + CMS", cliente: "ferrante", stato: "INVIATO", imponibile: 6300, inviatoIl: d("2026-08-19") },
    { numero: "PRE-2026/017", titolo: "App inventario magazzino", cliente: "bonaldi", stato: "ACCETTATO", imponibile: 13000, inviatoIl: d("2026-08-05") },
    { numero: "PRE-2026/016", titolo: "Portale Vetrerie Bonaldi", cliente: "bonaldi", stato: "ACCETTATO", imponibile: 18500, inviatoIl: d("2026-06-10") },
  ];

  const P = {};
  for (const p of preventivi) {
    const { cliente, ...dati } = p;
    P[p.numero] = await prisma.preventivo.create({
      data: {
        ...dati,
        clienteId: C[cliente].id,
        voci: {
          create: [
            { descrizione: "Analisi e progettazione", quantita: 16, prezzo: 65, ordine: 0 },
            { descrizione: "Sviluppo", quantita: 60, prezzo: 65, ordine: 1 },
            { descrizione: "Test e rilascio", quantita: 12, prezzo: 65, ordine: 2 },
          ],
        },
      },
    });
  }

  // -------------------------------------------------------------- progetti
  const progetti = [
    { k: "inventario", nome: "App inventario magazzino", cliente: "bonaldi", stato: "DA_AVVIARE", valore: 13000, budgetOre: 90, inizioIl: d("2026-09-02"), preventivo: "PRE-2026/017", note: "Da PRE-2026/017" },
    { k: "portale", nome: "Portale Vetrerie Bonaldi", cliente: "bonaldi", stato: "IN_CORSO", valore: 18500, budgetOre: 160, preventivo: "PRE-2026/016" },
    { k: "areaclienti", nome: "Area riservata clienti", cliente: "alpe", stato: "IN_CORSO", valore: 11600, budgetOre: 120, consegnaIl: d("2026-09-15") },
    { k: "cicd", nome: "CI/CD e monitoraggio", cliente: "nuvolab", stato: "IN_CORSO", valore: 6500, budgetOre: 100, note: "Budget ore superato" },
    { k: "sito", nome: "Sito vetrina + CMS", cliente: "ferrante", stato: "IN_PAUSA", valore: 8750, budgetOre: 95, note: "In attesa contenuti dal cliente" },
    { k: "prenotazioni", nome: "Prenotazioni ambulatorio", cliente: "sanrocco", stato: "CONCLUSO", valore: 5400, budgetOre: 80 },
  ];

  const PR = {};
  for (const p of progetti) {
    const { k, cliente, preventivo, ...dati } = p;
    PR[k] = await prisma.progetto.create({
      data: {
        ...dati,
        clienteId: C[cliente].id,
        preventivoId: preventivo ? P[preventivo].id : null,
      },
    });
  }

  await prisma.milestone.createMany({
    data: [
      { progettoId: PR.portale.id, titolo: "Milestone 2", scadenzaIl: d("2026-08-31") },
      { progettoId: PR.areaclienti.id, titolo: "Consegna", scadenzaIl: d("2026-09-15") },
    ],
  });

  // -------------------------------------------------------------- attività
  const attivita = [
    { k: "dashboard", titolo: "Dashboard ordini rivenditori", progetto: "portale", stato: "DA_FARE", stimaOre: 24, scadenzaIl: d("2026-08-31") },
    { k: "listini", titolo: "Export listini in PDF", progetto: "portale", stato: "DA_FARE", stimaOre: 12, scadenzaIl: d("2026-09-05") },
    { k: "ci", titolo: "Setup CI su staging", progetto: "cicd", stato: "DA_FARE", stimaOre: 4, scadenzaIl: d("2026-08-28") },
    { k: "mappatura", titolo: "Mappatura campi Twenty", progetto: null, stato: "DA_FARE", stimaOre: 2 },
    { k: "pagamenti", titolo: "Migrazione endpoint pagamenti", progetto: "portale", stato: "IN_CORSO", stimaOre: 18 },
    { k: "bozzaarea", titolo: "Bozza area riservata", progetto: "areaclienti", stato: "IN_CORSO", stimaOre: 3 },
    { k: "collaudo", titolo: "Collaudo con il cliente", progetto: "portale", stato: "BLOCCATA", stimaOre: 8, bloccoNota: "In attesa ambiente di test" },
    { k: "repo", titolo: "Setup repository e ambienti", progetto: "portale", stato: "FATTA", stimaOre: 8, completataIl: d("2026-07-04") },
    { k: "import", titolo: "Import anagrafiche legacy", progetto: "portale", stato: "FATTA", stimaOre: 10, completataIl: d("2026-07-18") },
  ];

  const A = {};
  for (const a of attivita) {
    const { k, progetto, ...dati } = a;
    A[k] = await prisma.attivita.create({
      data: { ...dati, progettoId: progetto ? PR[progetto].id : null },
    });
  }

  // ---------------------------------------------------------------- ticket
  const ticket = [
    { numero: 128, titolo: "Export listini genera PDF vuoto", cliente: "bonaldi", progetto: "portale", stato: "APERTO", priorita: "MEDIA", conContratto: true, apertoIl: d("2026-08-24") },
    { numero: 131, titolo: "Lentezza in fase di login", cliente: "alpe", progetto: "areaclienti", stato: "APERTO", priorita: "ALTA", conContratto: false, apertoIl: d("2026-08-26") },
    { numero: 129, titolo: "Errore invio email conferma", cliente: "riva", progetto: null, stato: "IN_LAVORAZIONE", priorita: "ALTA", conContratto: true, apertoIl: d("2026-08-25") },
    { numero: 126, titolo: "Richiesta nuovo campo anagrafica", cliente: "nuvolab", progetto: "cicd", stato: "ATTESA_CLIENTE", priorita: "BASSA", conContratto: true, apertoIl: d("2026-08-22") },
    { numero: 124, titolo: "Aggiornamento certificato SSL", cliente: "ferrante", progetto: null, stato: "RISOLTO", priorita: "MEDIA", conContratto: false, apertoIl: d("2026-08-18"), risoltoIl: d("2026-08-20") },
  ];

  const T = {};
  for (const t of ticket) {
    const { cliente, progetto, ...dati } = t;
    T[t.numero] = await prisma.ticket.create({
      data: {
        ...dati,
        clienteId: C[cliente].id,
        progettoId: progetto ? PR[progetto].id : null,
      },
    });
  }

  // ------------------------------------------------------- ore (24–30 ago)
  const ore = [
    { data: d("2026-08-24"), ore: 4, attivita: "pagamenti", progetto: "portale" },
    { data: d("2026-08-25"), ore: 6, attivita: "pagamenti", progetto: "portale" },
    { data: d("2026-08-26"), ore: 1.15, attivita: "pagamenti", progetto: "portale" },
    { data: d("2026-08-25"), ore: 2.5, attivita: "dashboard", progetto: "portale" },
    { data: d("2026-08-27"), ore: 2, attivita: "dashboard", progetto: "portale" },
    { data: d("2026-08-24"), ore: 3, attivita: "bozzaarea", progetto: "areaclienti" },
    { data: d("2026-08-26"), ore: 4.5, attivita: "ci", progetto: "cicd" },
    { data: d("2026-08-27"), ore: 3.5, attivita: "ci", progetto: "cicd" },
    { data: d("2026-08-26"), ore: 2, ticket: 128, fatturabile: true },
    { data: d("2026-08-27"), ore: 1.5, ticket: 129, fatturabile: true },
    { data: d("2026-08-28"), ore: 4.6, attivita: "listini", progetto: "portale" },
  ];

  for (const r of ore) {
    const { attivita: att, progetto, ticket: tk, ...dati } = r;
    await prisma.registrazioneOre.create({
      data: {
        ...dati,
        attivitaId: att ? A[att].id : null,
        progettoId: progetto ? PR[progetto].id : null,
        ticketId: tk ? T[tk].id : null,
      },
    });
  }

  // Ore già consuntivate sui progetti (storico, fuori settimana corrente).
  const storico = [
    { progetto: "portale", ore: 100, data: d("2026-07-15") },
    { progetto: "areaclienti", ore: 59, data: d("2026-07-20") },
    { progetto: "cicd", ore: 96, data: d("2026-07-22") },
    { progetto: "sito", ore: 34, data: d("2026-06-30") },
    { progetto: "prenotazioni", ore: 78, data: d("2026-05-20") },
  ];
  for (const s of storico) {
    await prisma.registrazioneOre.create({
      data: {
        data: s.data,
        ore: s.ore,
        progettoId: PR[s.progetto].id,
        descrizione: "Consuntivo periodo precedente",
        fatturabile: false,
      },
    });
  }

  // -------------------------------------------------------------- fatture
  const fatture = [
    { numero: "2026/044", cliente: "bonaldi", stato: "EMESSA", imponibile: 6200, emessaIl: d("2026-08-13"), scadeIl: d("2026-09-12") },
    { numero: "2026/043", cliente: "ferrante", stato: "EMESSA", imponibile: 3140, emessaIl: d("2026-08-06"), scadeIl: d("2026-09-05") },
    { numero: "2026/041", cliente: "alpe", stato: "SCADUTA", imponibile: 6100, emessaIl: d("2026-07-16"), scadeIl: d("2026-08-15") },
    { numero: "2026/040", cliente: "nuvolab", stato: "PAGATA", imponibile: 3100, emessaIl: d("2026-07-10"), scadeIl: d("2026-08-09") },
    { numero: "2026/039", cliente: "sanrocco", stato: "PAGATA", imponibile: 5400, emessaIl: d("2026-06-28"), scadeIl: d("2026-07-28") },
    { numero: "2026/038", cliente: "bonaldi", stato: "PAGATA", imponibile: 7300, emessaIl: d("2026-06-12"), scadeIl: d("2026-07-12") },
  ];

  const F = {};
  for (const f of fatture) {
    const { cliente, ...dati } = f;
    F[f.numero] = await prisma.fattura.create({
      data: {
        ...dati,
        clienteId: C[cliente].id,
        righe: {
          create: [
            { descrizione: "Attività di sviluppo", quantita: 40, prezzo: 65, ordine: 0 },
            { descrizione: "Assistenza e manutenzione", quantita: 8, prezzo: 65, ordine: 1 },
          ],
        },
      },
    });
  }

  await prisma.incasso.createMany({
    data: [
      { fatturaId: F["2026/040"].id, data: d("2026-08-20"), importo: 1550, metodo: "BONIFICO", conto: "Banca Sella · principale", nota: "acconto 50%" },
      { fatturaId: F["2026/040"].id, data: d("2026-08-04"), importo: 1550, metodo: "BONIFICO", conto: "Banca Sella · principale" },
      { fatturaId: F["2026/039"].id, data: d("2026-07-24"), importo: 5400, metodo: "BONIFICO", conto: "Banca Sella · principale" },
      { fatturaId: F["2026/038"].id, data: d("2026-07-08"), importo: 7300, metodo: "BONIFICO", conto: "Banca Sella · principale" },
    ],
  });

  // ------------------------------------------------------------- contratti
  const contratti = [
    {
      numero: "CON-2026/001",
      titolo: "Assistenza sistemistica",
      cliente: "bonaldi",
      tipo: "ASSISTENZA_ORE",
      stato: "ATTIVO",
      canone: 900,
      periodicita: "MENSILE",
      monteOre: 20,
      inizioIl: d("2026-01-01"),
      scadeIl: d("2026-12-31"),
      rinnovoAutomatico: true,
    },
    {
      numero: "CON-2026/002",
      titolo: "Hosting e manutenzione",
      cliente: "nuvolab",
      tipo: "CANONE_FISSO",
      stato: "ATTIVO",
      canone: 250,
      periodicita: "TRIMESTRALE",
      inizioIl: d("2026-03-01"),
      // Scadenza vicina, per vedere l'avviso di preavviso in azione.
      scadeIl: fraGiorni(25),
      rinnovoAutomatico: false,
      preavvisoGiorni: 30,
    },
    {
      numero: "CON-2026/003",
      titolo: "Assistenza farmacie",
      cliente: "riva",
      tipo: "ASSISTENZA_ORE",
      stato: "BOZZA",
      canone: 400,
      periodicita: "MENSILE",
      monteOre: 8,
      inizioIl: fraGiorni(10),
      rinnovoAutomatico: true,
    },
  ];

  const K = {};
  for (const c of contratti) {
    const { cliente, ...dati } = c;
    K[c.numero] = await prisma.contratto.create({
      data: { ...dati, clienteId: C[cliente].id },
    });
  }

  // I ticket del cliente con contratto attivo ne sono coperti.
  await prisma.ticket.updateMany({
    where: { clienteId: C.bonaldi.id, stato: { notIn: ["RISOLTO", "CHIUSO"] } },
    data: { contrattoId: K["CON-2026/001"].id, conContratto: true },
  });

  // -------------------------------------------------------------- criticità
  await prisma.problema.createMany({
    data: [
      {
        progettoId: PR.portale.id,
        titolo: "Ambiente di test non disponibile",
        descrizione: "Il cliente non ha ancora predisposto il server di collaudo.",
        gravita: "ALTA",
        stato: "APERTO",
        impattoOre: 8,
        segnalatoDa: "marco@studioferrero.it",
        apertoIl: fraGiorni(-6),
      },
      {
        progettoId: PR.cicd.id,
        titolo: "Budget ore superato",
        descrizione: "La migrazione ha richiesto più lavoro del previsto.",
        gravita: "MEDIA",
        stato: "IN_GESTIONE",
        impattoOre: 4,
        segnalatoDa: "marco@studioferrero.it",
        apertoIl: fraGiorni(-12),
      },
    ],
  });

  // ------------------------------------------------------------------ note
  await prisma.notaProgetto.createMany({
    data: [
      {
        progettoId: PR.portale.id,
        testo: "Concordata con il cliente la formazione per il 20 settembre.",
        autore: "marco@studioferrero.it",
      },
      {
        progettoId: PR.areaclienti.id,
        testo: "Il referente ha chiesto di anticipare la consegna di una settimana.",
        autore: "marco@studioferrero.it",
      },
    ],
  });

  await prisma.notaOperativa.create({
    data: {
      ticketId: T[128].id,
      testo: "Riprodotto in staging: succede solo con listini oltre 200 righe.",
      autore: "marco@studioferrero.it",
    },
  });

  // ---------------------------------------------------------------- eventi
  // Diario del progetto principale, per popolare la timeline.
  await prisma.eventoProgetto.createMany({
    data: [
      {
        progettoId: PR.portale.id,
        tipo: "stato",
        testo: "Stato → in corso",
        autore: "marco@studioferrero.it",
        createdAt: fraGiorni(-40),
      },
      {
        progettoId: PR.portale.id,
        tipo: "milestone",
        testo: "Milestone raggiunta: analisi conclusa",
        autore: "marco@studioferrero.it",
        createdAt: fraGiorni(-25),
      },
      {
        progettoId: PR.portale.id,
        tipo: "problema",
        testo: "Criticità aperta: Ambiente di test non disponibile",
        dettaglio: "gravità alta",
        autore: "marco@studioferrero.it",
        createdAt: fraGiorni(-6),
      },
    ],
  });

  // -------------------------------------------------------------- workflow
  await prisma.workflow.create({
    data: {
      nome: "Apri progetto da preventivo accettato",
      descrizione:
        "Quando un preventivo sopra i 5.000 euro viene accettato, crea il progetto e avvisa.",
      attivo: true,
      innesco: "EVENTO",
      eventoChiave: "preventivo.accettato",
      condizioni: [],
      azioni: {
        blocchi: [
          { id: "b1", tipo: "innesco.evento", config: { evento: "preventivo.accettato" }, pos: { x: 40, y: 40 } },
          { id: "b2", tipo: "condizione.valore", config: { campo: "imponibile", operatore: "maggiore", soglia: 5000 }, pos: { x: 260, y: 40 } },
          { id: "b3", tipo: "azione.creaProgetto", config: { budgetOre: 0 }, pos: { x: 480, y: 40 } },
          { id: "b4", tipo: "azione.notifica", config: { titolo: "Progetto aperto da {numero}", testo: "Cliente {cliente} · {imponibile} EUR", livello: "info" }, pos: { x: 480, y: 150 } },
        ],
        collegamenti: [
          { da: "b1", a: "b2" },
          { da: "b2", a: "b3" },
          { da: "b2", a: "b4" },
        ],
      },
    },
  });

  await prisma.workflow.create({
    data: {
      nome: "Promemoria fatture scadute",
      descrizione: "Ogni giorno segnala le fatture non ancora incassate oltre la scadenza.",
      attivo: true,
      innesco: "PIANIFICATO",
      eventoChiave: "giornaliero",
      condizioni: [],
      azioni: {
        blocchi: [
          { id: "b1", tipo: "innesco.pianificato", config: { frequenza: "giornaliero" }, pos: { x: 40, y: 40 } },
          { id: "b2", tipo: "azione.notifica", config: { titolo: "Controlla le fatture scadute", testo: "Verifica i solleciti da inviare.", livello: "attenzione" }, pos: { x: 260, y: 40 } },
        ],
        collegamenti: [{ da: "b1", a: "b2" }],
      },
    },
  });

  // ------------------------------------------------------- testi standard
  await prisma.testoStandard.createMany({
    data: [
      {
        ambito: "ENTRAMBI",
        campo: "condizioniPagamento",
        titolo: "Pagamento 30 giorni data fattura",
        testo:
          "Il corrispettivo è dovuto entro 30 giorni dalla data della fattura, " +
          "mediante bonifico bancario sulle coordinate indicate. In caso di " +
          "ritardo si applicano gli interessi di mora previsti dal D.Lgs. 231/2002.",
        predefinito: true,
        ordine: 0,
      },
      {
        ambito: "PREVENTIVO",
        campo: "premessa",
        titolo: "Premessa standard preventivi",
        testo:
          "Il presente preventivo definisce le attività concordate e il relativo " +
          "corrispettivo. Eventuali richieste non comprese saranno quotate a parte " +
          "e concordate prima dell'esecuzione.",
        predefinito: true,
        ordine: 0,
      },
      {
        ambito: "PREVENTIVO",
        campo: "tempiConsegna",
        titolo: "Tempi indicativi",
        testo:
          "I tempi di consegna decorrono dalla data di accettazione e dalla " +
          "ricezione dei materiali necessari. Ritardi nella fornitura di contenuti " +
          "o accessi da parte del committente prolungano i termini di pari durata.",
        predefinito: true,
        ordine: 0,
      },
      {
        ambito: "CONTRATTO",
        campo: "oggetto",
        titolo: "Oggetto assistenza sistemistica",
        testo:
          "Il prestatore si impegna a fornire assistenza tecnica e manutenzione " +
          "correttiva sui sistemi del committente, entro il monte ore concordato. " +
          "Le ore eccedenti sono fatturate a consuntivo alla tariffa indicata.",
        predefinito: true,
        ordine: 0,
      },
      {
        ambito: "CONTRATTO",
        campo: "condizioniServizio",
        titolo: "Orari e tempi di risposta",
        testo:
          "Il servizio è erogato nei giorni lavorativi dalle 9:00 alle 18:00. " +
          "Presa in carico entro 8 ore lavorative dalla segnalazione. Gli interventi " +
          "fuori orario sono concordati di volta in volta.",
        predefinito: true,
        ordine: 0,
      },
      {
        ambito: "CONTRATTO",
        campo: "premessa",
        titolo: "Premessa standard contratti",
        testo:
          "Le parti, come sopra individuate, convengono e stipulano quanto segue, " +
          "riconoscendo le premesse parte integrante del presente accordo.",
        predefinito: true,
        ordine: 0,
      },
    ],
  });

  console.log("Seed completato.");
  console.log("  accesso: marco@studioferrero.it / " + (process.env.SEED_PASSWORD ?? "Telaio2026!"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

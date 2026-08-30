// Seed con i dati mostrati nel design (Studio Ferrero, agosto 2026).
// Idempotente: se ci sono già clienti non fa nulla, così l'entrypoint Docker
// può eseguirlo a ogni avvio senza duplicare.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const d = (s) => new Date(`${s}T00:00:00.000Z`);

async function main() {
  if ((await prisma.cliente.count()) > 0) {
    console.log("Database già popolato: seed saltato.");
    return;
  }

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

  console.log("Seed completato.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

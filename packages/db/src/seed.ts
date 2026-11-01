import { eq } from "drizzle-orm";
import { creaAdmin } from "./admin";
import { createDb } from "./client";
import {
  clientiRef,
  conti,
  listini,
  listinoBasi,
  listinoModuli,
  moduloBasi,
  ragioniSociali,
} from "./schema";

const { db, client } = createDb();

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "mattia@telaio.local";
  const creato = await creaAdmin(db, {
    email,
    password: process.env.SEED_ADMIN_PASSWORD ?? "telaio-dev-2026",
    name: process.env.SEED_ADMIN_NAME ?? "Mattia",
  });
  console.log(creato ? `Utente creato: ${email}` : `Utente ${email} già presente`);
}

async function seedRagioniSociali() {
  const [esiste] = await db.select({ id: ragioniSociali.id }).from(ragioniSociali).limit(1);
  if (esiste) return console.log("Ragioni sociali già presenti");

  const [ditta, srl, assoc] = await db
    .insert(ragioniSociali)
    .values([
      {
        nome: "Mattia Capelli · Ditta individuale",
        tipo: "ditta_individuale",
        citta: "Bergamo",
        provincia: "BG",
        formatoPreventivo: "P-{AAAA}-{NNN}",
        formatoFattura: "F-{AAAA}-{NNN}",
        ivaAttiva: true,
        aliquotaIvaBp: 2200,
      },
      {
        nome: "MC Digital S.r.l.",
        tipo: "srl",
        citta: "Bergamo",
        provincia: "BG",
        formatoPreventivo: "MCD {N}/{AAAA}",
        formatoFattura: "MCD F{N}/{AAAA}",
        ivaAttiva: true,
        aliquotaIvaBp: 2200,
        splitPayment: true,
      },
      {
        nome: "Capelli Formazione",
        tipo: "associazione",
        citta: "Bergamo",
        provincia: "BG",
        formatoPreventivo: "CF-P-{AAAA}-{NNN}",
        formatoFattura: "CF-{AAAA}-{NNN}",
        ivaAttiva: false,
        aliquotaIvaBp: 0,
        naturaSenzaIva: "N2.2",
        diciturSenzaIva: "Operazione non soggetta a IVA ai sensi dell'art. 4 DPR 633/72",
        bolloAutomatico: true,
      },
    ])
    .returning();
  if (!ditta || !srl || !assoc) throw new Error("Seed ragioni sociali fallito");

  const contiCreati = await db
    .insert(conti)
    .values([
      { ragioneSocialeId: ditta.id, nome: "C/C Ditta individuale", tipo: "bonifico" },
      { ragioneSocialeId: srl.id, nome: "C/C MC Digital", tipo: "bonifico" },
      { ragioneSocialeId: assoc.id, nome: "C/C Capelli Formazione", tipo: "bonifico" },
      { nome: "Cassa contanti", tipo: "contante" },
      { nome: "Stripe · carte", tipo: "carta" },
    ])
    .returning();
  for (const [rs, nome] of [
    [ditta, "C/C Ditta individuale"],
    [srl, "C/C MC Digital"],
    [assoc, "C/C Capelli Formazione"],
  ] as const) {
    const conto = contiCreati.find((c) => c.nome === nome);
    if (conto)
      await db
        .update(ragioniSociali)
        .set({ contoPredefinitoId: conto.id })
        .where(eq(ragioniSociali.id, rs.id));
  }

  // Listino "Sviluppo Web Custom": prezzi netti in centesimi
  const [listino] = await db
    .insert(listini)
    .values([
      { ragioneSocialeId: ditta.id, nome: "Sviluppo Web Custom" },
      { ragioneSocialeId: srl.id, nome: "IT Management" },
    ])
    .returning();
  if (!listino) throw new Error("Seed listini fallito");

  const basi = await db
    .insert(listinoBasi)
    .values([
      {
        listinoId: listino.id,
        nome: "Sito Web",
        unaTantumCent: 55000,
        canoneAnnuoCent: 2500,
        canoneMensileCent: 0,
        ordine: 1,
      },
      {
        listinoId: listino.id,
        nome: "CMS custom",
        unaTantumCent: 100000,
        canoneAnnuoCent: 45000,
        canoneMensileCent: 4500,
        ordine: 2,
      },
    ])
    .returning();
  const sito = basi.find((b) => b.nome === "Sito Web");
  const cms = basi.find((b) => b.nome === "CMS custom");
  if (!sito || !cms) throw new Error("Seed basi fallito");

  const moduli = [
    { nome: "MC CMS", prezzi: [45000, 25000, 2500], basi: [sito] },
    { nome: "Prenotazione risorse", prezzi: [25000, 0, 0], basi: [sito, cms] },
    { nome: "Prenotazione appuntamenti", prezzi: [20000, 10000, 1000], basi: [sito, cms] },
    { nome: "Integrazione domotica", prezzi: [80000, 35000, 3500], basi: [cms] },
    { nome: "Hosting", prezzi: [2500, 5000, 500], basi: [sito, cms] },
  ];
  for (const [i, m] of moduli.entries()) {
    const [creato] = await db
      .insert(listinoModuli)
      .values({
        listinoId: listino.id,
        nome: m.nome,
        unaTantumCent: m.prezzi[0] ?? 0,
        canoneAnnuoCent: m.prezzi[1] ?? 0,
        canoneMensileCent: m.prezzi[2] ?? 0,
        ordine: i + 1,
      })
      .returning();
    if (creato)
      await db
        .insert(moduloBasi)
        .values(m.basi.map((b) => ({ moduloId: creato.id, baseId: b.id })));
  }

  console.log("Ragioni sociali, conti e listini creati");
}

async function seedClientiDemo() {
  const [esiste] = await db.select({ id: clientiRef.id }).from(clientiRef).limit(1);
  if (esiste) return;
  await db.insert(clientiRef).values([
    {
      twentyCompanyId: "demo-1",
      nome: "Trattoria Da Marco",
      partitaIva: "01234567890",
      codiceSdi: "KRRH6B9",
    },
    {
      twentyCompanyId: "demo-2",
      nome: "Comune di Esempio",
      codiceFiscale: "80012345678",
      pa: true,
      codiceSdi: "UFABC1",
    },
  ]);
}

await seedAdmin();
await seedRagioniSociali();
await seedClientiDemo();
await client.end();
console.log("Seed completato.");

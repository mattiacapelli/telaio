import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  accounts,
  conti,
  impostazioni,
  listini,
  ragioniSociali,
  sessions,
  users,
} from "../src/schema";
import {
  BozzaIncompleta,
  type BozzaSetup,
  bozzaPubblica,
  InstallazioneNonVuota,
  inizializza,
  leggiBozza,
  leggiStatoSetup,
  marcaSetupCompletato,
  SETUP_VERSION,
  SetupGiaCompletato,
  salvaBozza,
} from "../src/setup";
import { creaDbTemporaneo, type DbTemporaneo, URL_SERVER } from "./db-temporaneo";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
const PASSWORD = "una-password-molto-lunga-123";

let t: DbTemporaneo;
let hash: string;

async function bozzaValida(over: Partial<BozzaSetup> = {}): Promise<BozzaSetup> {
  return {
    passo: 6,
    azienda: {
      nome: "Studio Rossi",
      tipo: "ditta_individuale",
      partitaIva: "01234567897",
      paese: "IT",
      fusoOrario: "Europe/Rome",
      valuta: "EUR",
      lingua: "it",
      logo: PNG,
    },
    admin: {
      nome: "Mario",
      cognome: "Rossi",
      email: "mario@example.com",
      passwordHash: hash,
      lunghezzaPassword: PASSWORD.length,
    },
    sicurezza: { passwordMinima: 12, guidaSicurezza: true },
    preferenze: {
      ivaAttiva: true,
      aliquotaIva: 22,
      formatoPreventivo: "P-{AAAA}-{NNN}",
      formatoFattura: "F-{AAAA}-{NNN}",
    },
    ...over,
  };
}

async function contaTutto() {
  return {
    utenti: (await t.db.select().from(users)).length,
    account: (await t.db.select().from(accounts)).length,
    aziende: (await t.db.select().from(ragioniSociali)).length,
    setup: (await t.db.select().from(impostazioni).where(eq(impostazioni.chiave, "setup"))).length,
  };
}

describe.skipIf(!URL_SERVER)("prima configurazione (Postgres reale)", () => {
  beforeAll(async () => {
    hash = await hashPassword(PASSWORD);
  });
  beforeEach(async () => {
    await t?.elimina();
    t = await creaDbTemporaneo();
  });
  afterAll(async () => {
    await t?.elimina();
  });

  it("un database appena inizializzato è vuoto e non configurato", async () => {
    expect(await leggiStatoSetup(t.db)).toEqual({
      completato: false,
      versione: null,
      completatoAt: null,
    });
    expect(await contaTutto()).toEqual({ utenti: 0, account: 0, aziende: 0, setup: 0 });
    // nessun dato demo
    expect(await t.db.select().from(conti)).toHaveLength(0);
    expect(await t.db.select().from(listini)).toHaveLength(0);
    expect((await leggiBozza(t.db)).passo).toBe(1);
  });

  it("salva la bozza passo dopo passo e la ritrova (ripresa dopo un refresh)", async () => {
    const b = await bozzaValida();
    await salvaBozza(t.db, { passo: 2, azienda: b.azienda });
    await salvaBozza(t.db, { passo: 3, admin: b.admin });
    const letta = await leggiBozza(t.db);
    expect(letta.passo).toBe(3);
    expect(letta.azienda?.nome).toBe("Studio Rossi");
    expect(letta.admin?.email).toBe("mario@example.com");
    // tornare a un passo precedente non fa arretrare l'avanzamento
    await salvaBozza(t.db, { passo: 2, azienda: b.azienda });
    expect((await leggiBozza(t.db)).passo).toBe(3);
  });

  it("la bozza che va al browser non contiene mai l'hash né la password", async () => {
    const b = await bozzaValida();
    await salvaBozza(t.db, { passo: 3, admin: b.admin });
    const testo = JSON.stringify(bozzaPubblica(await leggiBozza(t.db)));
    expect(testo).not.toContain(hash);
    expect(testo).not.toContain(PASSWORD);
    expect(testo.toLowerCase()).not.toContain("hash");
    expect(testo).toContain("passwordImpostata");
    // nel database c'è solo l'hash, mai la password in chiaro
    const [riga] = await t.db
      .select()
      .from(impostazioni)
      .where(eq(impostazioni.chiave, "setup.bozza"));
    expect(JSON.stringify(riga?.valore)).not.toContain(PASSWORD);
  });

  it("completa la configurazione: azienda, amministratore, impostazioni e stato", async () => {
    await salvaBozza(t.db, await bozzaValida());
    const { adminId } = await inizializza(t.db, await leggiBozza(t.db));

    const [stato, azienda, utente, account] = await Promise.all([
      leggiStatoSetup(t.db),
      t.db.select().from(ragioniSociali),
      t.db.select().from(users),
      t.db.select().from(accounts),
    ]);
    expect(stato.completato).toBe(true);
    expect(stato.versione).toBe(SETUP_VERSION);
    expect(new Date(stato.completatoAt ?? "").getTime()).toBeGreaterThan(0);

    expect(azienda).toHaveLength(1);
    expect(azienda[0]).toMatchObject({
      nome: "Studio Rossi",
      partitaIva: "01234567897",
      aliquotaIvaBp: 2200,
      formatoPreventivo: "P-{AAAA}-{NNN}",
    });

    // il massimo ruolo già previsto, e il nome composto
    expect(utente).toHaveLength(1);
    expect(utente[0]).toMatchObject({
      id: adminId,
      role: "admin",
      name: "Mario Rossi",
      email: "mario@example.com",
      emailVerified: true,
    });
    // formato Better Auth: la password si verifica con le sue funzioni
    expect(account).toHaveLength(1);
    expect(account[0]?.providerId).toBe("credential");
    expect(await verifyPassword({ hash: account[0]?.password ?? "", password: PASSWORD })).toBe(
      true,
    );
    expect(await verifyPassword({ hash: account[0]?.password ?? "", password: "sbagliata" })).toBe(
      false,
    );

    const chiavi = (await t.db.select().from(impostazioni)).map((r) => r.chiave).sort();
    expect(chiavi).toEqual(["azienda.logo", "generali", "setup", "sicurezza"]);
    const [setup] = await t.db.select().from(impostazioni).where(eq(impostazioni.chiave, "setup"));
    expect(setup?.valore).toMatchObject({
      setup_completed: true,
      setup_version: 1,
      origine: "wizard",
    });
    // la bozza non resta in giro
    expect(chiavi).not.toContain("setup.bozza");
    // nessun dato demo
    expect(await t.db.select().from(conti)).toHaveLength(0);
    expect(await t.db.select().from(listini)).toHaveLength(0);
  });

  it("IVA disattivata: aliquota a zero", async () => {
    const b = await bozzaValida({
      preferenze: {
        ivaAttiva: false,
        aliquotaIva: 22,
        formatoPreventivo: "P-{NNN}",
        formatoFattura: "F-{NNN}",
      },
    });
    await inizializza(t.db, b);
    const [rs] = await t.db.select().from(ragioniSociali);
    expect(rs).toMatchObject({ ivaAttiva: false, aliquotaIvaBp: 0 });
  });

  it("senza logo non scrive la chiave del logo", async () => {
    const b = await bozzaValida();
    await inizializza(t.db, { ...b, azienda: { ...b.azienda!, logo: null } });
    const chiavi = (await t.db.select().from(impostazioni)).map((r) => r.chiave);
    expect(chiavi).not.toContain("azienda.logo");
  });

  it("richieste concorrenti: un solo bootstrap riesce, un solo amministratore", async () => {
    const b = await bozzaValida();
    const esiti = await Promise.allSettled(Array.from({ length: 10 }, () => inizializza(t.db, b)));
    const riusciti = esiti.filter((e) => e.status === "fulfilled");
    const respinti = esiti.filter((e): e is PromiseRejectedResult => e.status === "rejected");
    expect(riusciti).toHaveLength(1);
    expect(respinti).toHaveLength(9);
    for (const r of respinti) expect(r.reason).toBeInstanceOf(SetupGiaCompletato);
    expect(await contaTutto()).toEqual({ utenti: 1, account: 1, aziende: 1, setup: 1 });
  });

  it("concorrenza con amministratori diversi: comunque uno solo", async () => {
    const esiti = await Promise.allSettled(
      Array.from({ length: 6 }, async (_, i) => {
        const b = await bozzaValida();
        return inizializza(t.db, {
          ...b,
          admin: { ...b.admin!, email: `admin${i}@example.com` },
        });
      }),
    );
    expect(esiti.filter((e) => e.status === "fulfilled")).toHaveLength(1);
    expect((await contaTutto()).utenti).toBe(1);
  });

  it("un secondo bootstrap dopo il completamento viene rifiutato e non cambia nulla", async () => {
    const b = await bozzaValida();
    await inizializza(t.db, b);
    const prima = await contaTutto();
    await expect(
      inizializza(t.db, { ...b, admin: { ...b.admin!, email: "altro@example.com" } }),
    ).rejects.toBeInstanceOf(SetupGiaCompletato);
    // e nemmeno la bozza si può più modificare
    await expect(salvaBozza(t.db, { passo: 2 })).rejects.toBeInstanceOf(SetupGiaCompletato);
    expect(await contaTutto()).toEqual(prima);
    expect(
      await t.db.select().from(users).where(eq(users.email, "altro@example.com")),
    ).toHaveLength(0);
  });

  it("cancellare gli utenti non riapre il setup", async () => {
    const b = await bozzaValida();
    await inizializza(t.db, b);
    await t.db.delete(sessions);
    await t.db.delete(accounts);
    await t.db.delete(users);
    expect((await contaTutto()).utenti).toBe(0);
    expect((await leggiStatoSetup(t.db)).completato).toBe(true);
    await expect(inizializza(t.db, b)).rejects.toBeInstanceOf(SetupGiaCompletato);
    expect((await contaTutto()).utenti).toBe(0);
  });

  it("con utenti già presenti e senza stato non crea mai un secondo amministratore", async () => {
    await t.db
      .insert(users)
      .values({ id: "u-esistente", name: "Esistente", email: "e@example.com" });
    await expect(inizializza(t.db, await bozzaValida())).rejects.toBeInstanceOf(
      InstallazioneNonVuota,
    );
    expect(await contaTutto()).toEqual({ utenti: 1, account: 0, aziende: 0, setup: 0 });
  });

  it("un errore durante l'inizializzazione annulla tutto e lascia la bozza", async () => {
    const b = await bozzaValida();
    await salvaBozza(t.db, b);
    // Un conflitto sull'ultima scrittura ("generali" già presente) fa fallire la transazione dopo
    // che azienda e amministratore sono già stati inseriti.
    await t.db.insert(impostazioni).values({ chiave: "generali", valore: {} });
    await expect(inizializza(t.db, await leggiBozza(t.db))).rejects.toThrow();
    expect(await contaTutto()).toEqual({ utenti: 0, account: 0, aziende: 0, setup: 0 });
    expect((await leggiStatoSetup(t.db)).completato).toBe(false);
    expect((await leggiBozza(t.db)).azienda?.nome).toBe("Studio Rossi");
    // risolto il problema, si può riprovare
    await t.db.delete(impostazioni).where(eq(impostazioni.chiave, "generali"));
    await inizializza(t.db, await leggiBozza(t.db));
    expect((await leggiStatoSetup(t.db)).completato).toBe(true);
  });

  it("una bozza incompleta o non valida non tocca il database", async () => {
    const b = await bozzaValida();
    const casi: [string, BozzaSetup][] = [
      ["azienda", { ...b, azienda: undefined }],
      ["amministratore", { ...b, admin: undefined }],
      ["sicurezza", { ...b, sicurezza: undefined }],
      ["preferenze", { ...b, preferenze: undefined }],
      ["partita IVA errata", { ...b, azienda: { ...b.azienda!, partitaIva: "12345678901" } }],
      ["email errata", { ...b, admin: { ...b.admin!, email: "non-una-email" } }],
      ["hash mancante", { ...b, admin: { ...b.admin!, passwordHash: "" } }],
    ];
    for (const [, bozza] of casi)
      await expect(inizializza(t.db, bozza)).rejects.toBeInstanceOf(BozzaIncompleta);
    expect(await contaTutto()).toEqual({ utenti: 0, account: 0, aziende: 0, setup: 0 });
  });

  it("la password scelta deve rispettare la lunghezza minima impostata", async () => {
    const b = await bozzaValida();
    await expect(
      inizializza(t.db, {
        ...b,
        admin: { ...b.admin!, lunghezzaPassword: 12 },
        sicurezza: { passwordMinima: 16, guidaSicurezza: false },
      }),
    ).rejects.toBeInstanceOf(BozzaIncompleta);
    expect((await contaTutto()).utenti).toBe(0);
  });

  it("marcaSetupCompletato (sviluppo) è idempotente e non sovrascrive", async () => {
    await marcaSetupCompletato(t.db, "seed-sviluppo");
    const [prima] = await t.db.select().from(impostazioni).where(eq(impostazioni.chiave, "setup"));
    await marcaSetupCompletato(t.db, "altro");
    const [dopo] = await t.db.select().from(impostazioni).where(eq(impostazioni.chiave, "setup"));
    expect(dopo?.valore).toEqual(prima?.valore);
    expect((await leggiStatoSetup(t.db)).completato).toBe(true);
  });

  it("la migrazione segna come configurate le installazioni che avevano già utenti", async () => {
    const sql = readFileSync(
      fileURLToPath(new URL("../drizzle/0003_setup_installazioni_esistenti.sql", import.meta.url)),
      "utf8",
    );
    // database nuovo (senza utenti): la migrazione non ha scritto nulla
    expect((await leggiStatoSetup(t.db)).completato).toBe(false);
    await t.db.insert(users).values({ id: "u1", name: "Vecchio", email: "v@example.com" });
    await t.sql.unsafe(sql);
    const stato = await leggiStatoSetup(t.db);
    expect(stato.completato).toBe(true);
    const [riga] = await t.db.select().from(impostazioni).where(eq(impostazioni.chiave, "setup"));
    expect(riga?.valore).toMatchObject({ origine: "installazione-esistente" });
  });
});

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { accounts, impostazioni, ragioniSociali, users } from "../src/schema";
import { leggiStatoSetup } from "../src/setup";
import { creaDbTemporaneo, type DbTemporaneo, URL_SERVER } from "./db-temporaneo";

const CARTELLA = fileURLToPath(new URL("../drizzle", import.meta.url));
/** Quante migrazioni ci sono in tutto: cresce a ogni nuova migrazione, il test non va ritoccato. */
const MIGRAZIONI_TOTALI: number = JSON.parse(
  readFileSync(join(CARTELLA, "meta", "_journal.json"), "utf8"),
).entries.length;

/** Una copia della cartella delle migrazioni ferma alle prime `n`: com'era una installazione prima del wizard. */
function migrazioniFinoA(n: number): string {
  const dest = mkdtempSync(join(tmpdir(), "telaio-migrazioni-"));
  cpSync(join(CARTELLA, "meta"), join(dest, "meta"), { recursive: true });
  const giornale = JSON.parse(readFileSync(join(dest, "meta", "_journal.json"), "utf8"));
  giornale.entries = giornale.entries.slice(0, n);
  writeFileSync(join(dest, "meta", "_journal.json"), JSON.stringify(giornale));
  for (const e of giornale.entries)
    cpSync(join(CARTELLA, `${e.tag}.sql`), join(dest, `${e.tag}.sql`));
  return dest;
}

describe.skipIf(!URL_SERVER)("migrazioni su installazioni esistenti", () => {
  let t: DbTemporaneo;
  const cartelleTemp: string[] = [];
  beforeEach(async () => {
    await t?.elimina();
    t = await creaDbTemporaneo({ migra: false });
  });
  afterAll(async () => {
    await t?.elimina();
    for (const c of cartelleTemp) rmSync(c, { recursive: true, force: true });
  });

  async function installazioneVecchia(conUtente: boolean) {
    const vecchia = migrazioniFinoA(3); // 0000, 0001, 0002: tutto tranne il wizard
    cartelleTemp.push(vecchia);
    await migrate(t.db, { migrationsFolder: vecchia });
    expect((await t.sql`select count(*)::int as n from drizzle.__drizzle_migrations`)[0]?.n).toBe(
      3,
    );
    await t.db.insert(ragioniSociali).values({ nome: "Azienda Esistente" });
    if (conUtente) {
      await t.db
        .insert(users)
        .values({ id: "u-vecchio", name: "Vecchio Admin", email: "vecchio@example.com" });
      await t.db.insert(accounts).values({
        id: "a-vecchio",
        accountId: "u-vecchio",
        providerId: "credential",
        userId: "u-vecchio",
        password: "hash-esistente",
      });
    }
  }

  it("con un amministratore già presente, l'installazione risulta configurata e i dati restano", async () => {
    await installazioneVecchia(true);
    await migrate(t.db, { migrationsFolder: CARTELLA });

    const stato = await leggiStatoSetup(t.db);
    expect(stato.completato).toBe(true);
    const [riga] = await t.db.select().from(impostazioni).where(eq(impostazioni.chiave, "setup"));
    expect(riga?.valore).toMatchObject({
      setup_completed: true,
      origine: "installazione-esistente",
    });
    // nulla è stato toccato
    expect(await t.db.select().from(users)).toHaveLength(1);
    const [a] = await t.db.select().from(accounts);
    expect(a?.password).toBe("hash-esistente");
    expect((await t.db.select().from(ragioniSociali))[0]?.nome).toBe("Azienda Esistente");
    expect((await t.sql`select count(*)::int as n from drizzle.__drizzle_migrations`)[0]?.n).toBe(
      MIGRAZIONI_TOTALI,
    );
  });

  it("rieseguire le migrazioni non cambia nulla", async () => {
    await installazioneVecchia(true);
    await migrate(t.db, { migrationsFolder: CARTELLA });
    const [prima] = await t.db.select().from(impostazioni).where(eq(impostazioni.chiave, "setup"));
    await migrate(t.db, { migrationsFolder: CARTELLA });
    const [dopo] = await t.db.select().from(impostazioni).where(eq(impostazioni.chiave, "setup"));
    expect(dopo?.valore).toEqual(prima?.valore);
    expect((await t.sql`select count(*)::int as n from drizzle.__drizzle_migrations`)[0]?.n).toBe(
      MIGRAZIONI_TOTALI,
    );
  });

  it("senza utenti (anche con altri dati) la configurazione resta da fare", async () => {
    await installazioneVecchia(false);
    await migrate(t.db, { migrationsFolder: CARTELLA });
    expect((await leggiStatoSetup(t.db)).completato).toBe(false);
    expect(await t.db.select().from(impostazioni)).toHaveLength(0);
  });

  it("un database completamente vuoto arriva all'ultima migrazione senza stato di configurazione", async () => {
    await migrate(t.db, { migrationsFolder: CARTELLA });
    expect((await t.sql`select count(*)::int as n from drizzle.__drizzle_migrations`)[0]?.n).toBe(
      MIGRAZIONI_TOTALI,
    );
    expect((await leggiStatoSetup(t.db)).completato).toBe(false);
    const [{ n }] = await t.db.execute<{ n: number }>(sql`select count(*)::int as n from users`);
    expect(n).toBe(0);
  });

  it("preventivi già accettati: righe accettate e totali accettati = offerta; gli altri restano senza decisione; nessun abbonamento creato", async () => {
    // fino alla migrazione 0005 (prima dell'accettazione parziale)
    const prima = migrazioniFinoA(6);
    cartelleTemp.push(prima);
    await migrate(t.db, { migrationsFolder: prima });
    const [rs] = await t.sql`insert into ragioni_sociali (nome) values ('Azienda') returning id`;
    const insPrev = async (stato: string, num: string) =>
      (
        await t.sql`
          insert into preventivi (ragione_sociale_id, anno, stato, numero, oggetto, snapshot, imponibile_cent, iva_cent, bollo_cent, totale_cent)
          values (${rs?.id}, 2026, ${stato}::stato_preventivo, ${num}, 'Offerta', '{"emittente":{},"cliente":{},"regole":{}}'::jsonb, 100000, 22000, 0, 122000)
          returning id`
      )[0]?.id as string;
    const accettato = await insPrev("accettato", "P-1");
    const inviato = await insPrev("inviato", "P-2");
    for (const pid of [accettato, inviato]) {
      await t.sql`insert into preventivo_righe (preventivo_id, posizione, descrizione, tipo, prezzo_unitario_cent, importo_cent)
                  values (${pid}, 0, 'Sito', 'una_tantum', 100000, 100000), (${pid}, 1, 'Hosting', 'canone_mensile', 5000, 5000)`;
    }

    await migrate(t.db, { migrationsFolder: CARTELLA });

    const righe = await t.sql`select preventivo_id, accettata from preventivo_righe`;
    expect(
      righe.filter((r) => r.preventivo_id === accettato).every((r) => r.accettata === true),
    ).toBe(true);
    expect(
      righe.filter((r) => r.preventivo_id === inviato).every((r) => r.accettata === null),
    ).toBe(true);
    const [a] = await t.sql`select * from preventivi where id = ${accettato}`;
    expect(a).toMatchObject({
      imponibile_cent: 100000,
      totale_cent: 122000,
      imponibile_accettato_cent: 100000,
      iva_accettata_cent: 22000,
      totale_accettato_cent: 122000,
    });
    expect(a?.data_accettazione).not.toBeNull();
    const [b] = await t.sql`select * from preventivi where id = ${inviato}`;
    expect(b?.totale_accettato_cent).toBeNull();
    expect((await t.sql`select count(*)::int as n from abbonamenti`)[0]?.n).toBe(0);
    // rieseguire non cambia nulla
    await migrate(t.db, { migrationsFolder: CARTELLA });
    expect(
      (await t.sql`select count(*)::int as n from preventivo_righe where accettata`)[0]?.n,
    ).toBe(2);
  });
});

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
});

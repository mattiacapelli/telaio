import { createRequire } from "node:module";
import { expect, type Page, test } from "@playwright/test";

// Gira sul database di sviluppo con l'utente del seed, come le altre suite.
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {}
const postgres = createRequire(`${process.cwd()}/../../packages/db/package.json`)("postgres");
const sql = postgres(process.env.DATABASE_URL as string, { max: 2, onnotice: () => {} });

const email = process.env.SEED_ADMIN_EMAIL ?? "mattia@telaio.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "telaio-dev-2026";
const ANNO = new Date().getFullYear();
const NUMERO = "E2E-DATE-1";

test.describe.configure({ mode: "serial" });

let fatturaId = "";
let rataId = "";
let incassoId = "";

async function accedi(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
}

async function pulisci() {
  await sql`delete from movimenti where incasso_id in (select id from incassi where descrizione = 'E2E date')`;
  await sql`delete from incassi where descrizione = 'E2E date'`;
  await sql`update fatture set rata_id = null where numero = ${NUMERO}`;
  await sql`delete from rate where descrizione = ${`Fattura ${NUMERO}`}`;
  await sql`delete from fatture where numero = ${NUMERO}`;
}

test.beforeAll(async () => {
  await pulisci();
  const [rs] =
    await sql`select id from ragioni_sociali where deleted_at is null order by created_at limit 1`;
  const [conto] =
    await sql`select id from conti where deleted_at is null order by created_at limit 1`;
  const snapshot = {
    emittente: { nome: "Emittente E2E" },
    cliente: { nome: "Cliente E2E" },
    regole: {},
  };
  [{ id: fatturaId }] = await sql`
    insert into fatture (ragione_sociale_id, origine, numero, anno, stato, data_emissione, scadenza, snapshot)
    values (${rs.id}, 'libera', ${NUMERO}, ${ANNO}, 'emessa', ${`${ANNO}-03-10`}, ${`${ANNO}-04-09`}, ${sql.json(snapshot)})
    returning id`;
  [{ id: rataId }] = await sql`
    insert into rate (ragione_sociale_id, fattura_id, numero, descrizione, scadenza, importo_cent)
    values (${rs.id}, ${fatturaId}, 1, ${`Fattura ${NUMERO}`}, ${`${ANNO}-04-09`}, 10000)
    returning id`;
  await sql`update fatture set rata_id = ${rataId} where id = ${fatturaId}`;
  [{ id: incassoId }] = await sql`
    insert into incassi (conto_id, ragione_sociale_id, fattura_id, data, importo_cent, descrizione)
    values (${conto.id}, ${rs.id}, ${fatturaId}, ${`${ANNO}-03-20`}, 2500, 'E2E date')
    returning id`;
  await sql`
    insert into movimenti (tipo, data, importo_cent, conto_id, categoria, descrizione, incasso_id)
    values ('entrata', ${`${ANNO}-03-20`}, 2500, ${conto.id}, 'incasso', 'E2E date', ${incassoId})`;
});

test.afterAll(async () => {
  await pulisci();
  await sql.end();
});

test("la data di un incasso si modifica da Incassi, anche in prima nota", async ({ page }) => {
  await accedi(page);
  await page.goto("/incassi");
  await page.getByLabel("Cerca in Incassi").fill("E2E date");
  await page.getByRole("button", { name: "Azioni della riga" }).first().click();
  await page.getByRole("menuitem", { name: "Modifica data" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Data").fill(`${ANNO}-02-05`);
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo).toBeHidden();
  const [i] = await sql`select data::text from incassi where id = ${incassoId}`;
  const [m] = await sql`select data::text from movimenti where incasso_id = ${incassoId}`;
  expect(i.data).toBe(`${ANNO}-02-05`);
  expect(m.data).toBe(`${ANNO}-02-05`);
});

test("le date di una fattura emessa si modificano, la scadenza segue sullo scadenzario", async ({
  page,
}) => {
  await accedi(page);
  await page.goto(`/fatture/${fatturaId}`);
  await page.getByRole("button", { name: "Modifica date" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Data di emissione").fill(`${ANNO}-01-15`);
  await dialogo.getByLabel("Scadenza").fill(`${ANNO}-12-31`);
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo).toBeHidden();
  const [f] =
    await sql`select data_emissione::text e, scadenza::text s from fatture where id = ${fatturaId}`;
  expect(f).toEqual({ e: `${ANNO}-01-15`, s: `${ANNO}-12-31` });
  const [r] = await sql`select scadenza::text s, stato from rate where id = ${rataId}`;
  expect(r.s).toBe(`${ANNO}-12-31`);
  expect(r.stato).toBe("da_incassare");
});

test("la fattura non esce dall'anno del suo numero e la scadenza non precede l'emissione", async ({
  page,
}) => {
  await accedi(page);
  await page.goto(`/fatture/${fatturaId}`);
  await page.getByRole("button", { name: "Modifica date" }).click();
  const dialogo = page.getByRole("dialog");
  // il campo stesso limita all'anno: forzo comunque il valore per provare il controllo del server
  await dialogo.getByLabel("Data di emissione").evaluate((el: HTMLInputElement) => {
    el.removeAttribute("min");
    el.removeAttribute("max");
  });
  await dialogo.getByLabel("Data di emissione").fill(`${ANNO - 1}-12-31`);
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo.getByRole("alert")).toContainText(`La data deve restare nel ${ANNO}`);

  await dialogo.getByLabel("Data di emissione").fill(`${ANNO}-06-10`);
  await dialogo.getByLabel("Scadenza").fill(`${ANNO}-06-01`);
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo.getByRole("alert")).toContainText("La scadenza non può precedere");
  const [f] = await sql`select data_emissione::text e from fatture where id = ${fatturaId}`;
  expect(f.e).toBe(`${ANNO}-01-15`);
});

test("dal dettaglio della fattura si modifica la data di un suo incasso", async ({ page }) => {
  await accedi(page);
  await page.goto(`/fatture/${fatturaId}`);
  await page.getByRole("button", { name: "Modifica data" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Data").fill(`${ANNO}-03-01`);
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo).toBeHidden();
  const [i] = await sql`select data::text from incassi where id = ${incassoId}`;
  expect(i.data).toBe(`${ANNO}-03-01`);
});

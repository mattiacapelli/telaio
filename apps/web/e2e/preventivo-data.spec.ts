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
const OGGETTO = "E2E data preventivo";
const RS = "E2E data RS";
const PASSATO = new Date().getFullYear() - 1;

test.describe.configure({ mode: "serial" });

let rsId = "";
let id = "";

async function accedi(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
}

async function pulisci() {
  const ids = await sql`select id from preventivi where oggetto like ${`${OGGETTO}%`}`;
  for (const { id: pid } of ids) {
    await sql`delete from preventivo_righe where preventivo_id = ${pid}`;
    await sql`delete from preventivi where id = ${pid}`;
  }
  await sql`delete from numerazioni where ragione_sociale_id in (select id from ragioni_sociali where nome = ${RS})`;
  await sql`delete from ragioni_sociali where nome = ${RS}`;
}

test.beforeAll(async () => {
  await pulisci();
  // un'emittente dedicata: l'invio assegna un numero vero e non deve toccare i contatori di quelle reali
  [{ id: rsId }] = await sql`
    insert into ragioni_sociali (nome, formato_preventivo, formato_fattura)
    values (${RS}, 'EDATA-{AAAA}-{NNN}', 'FDATA-{AAAA}-{NNN}') returning id`;
});
test.afterAll(async () => {
  await pulisci();
  await sql.end({ timeout: 2 });
});

test("si crea un preventivo con una data passata: anno, scadenza e dettaglio la seguono", async ({
  page,
}) => {
  await accedi(page);
  await page.goto("/preventivi/nuovo");
  await page.getByRole("radio", { name: new RegExp(RS) }).click();
  await page.locator("input[name=oggetto]").fill(OGGETTO);
  await page.getByLabel("Descrizione prestazione 1").fill("Sito");
  await page.getByLabel("Prezzo prestazione 1").fill("500,00");
  // di default oggi; si può scegliere il passato
  await expect(page.locator("input[name=data]")).toHaveValue(
    new RegExp(`^${new Date().getFullYear()}-`),
  );
  await page.locator("input[name=data]").fill(`${PASSATO}-06-15`);
  await page.getByRole("button", { name: "Salva bozza" }).click();
  await expect(page).toHaveURL(/\/preventivi\/[0-9a-f-]{36}$/);
  id = page.url().split("/").pop() ?? "";

  const [p] =
    await sql`select anno, data_preventivo::text d, valido_fino::text v, ragione_sociale_id from preventivi where id = ${id}`;
  expect(p).toMatchObject({
    anno: PASSATO,
    d: `${PASSATO}-06-15`,
    v: `${PASSATO}-07-15`,
    ragione_sociale_id: rsId,
  });
  await expect(page.getByText("15/06/" + PASSATO)).toBeVisible();
});

test("la bozza si riapre con la data e si può cambiare, anche in un altro anno", async ({
  page,
}) => {
  await accedi(page);
  await page.goto(`/preventivi/${id}/modifica`);
  await expect(page.locator("input[name=data]")).toHaveValue(`${PASSATO}-06-15`);
  await page.locator("input[name=data]").fill(`${PASSATO - 1}-03-01`);
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page).toHaveURL(new RegExp(`/preventivi/${id}$`));
  expect(
    (
      await sql`select anno, data_preventivo::text d, valido_fino::text v from preventivi where id = ${id}`
    )[0],
  ).toEqual({
    anno: PASSATO - 1,
    d: `${PASSATO - 1}-03-01`,
    v: `${PASSATO - 1}-03-31`,
  });
  // in bozza la data torna a quella scelta per il resto della prova
  await page.goto(`/preventivi/${id}/modifica`);
  await page.locator("input[name=data]").fill(`${PASSATO}-06-15`);
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page).toHaveURL(new RegExp(`/preventivi/${id}$`));
  await expect(page.getByRole("button", { name: "Modifica data" })).toHaveCount(0);
});

test("all'invio il numero segue l'anno della data; dopo l'invio la data resta in quell'anno", async ({
  page,
}) => {
  await accedi(page);
  await page.goto(`/preventivi/${id}`);
  await page.getByRole("button", { name: "Segna come inviato" }).click();
  await expect
    .poll(async () => (await sql`select numero from preventivi where id = ${id}`)[0].numero)
    .toBe(`EDATA-${PASSATO}-001`);

  await page.reload();
  await page.getByRole("button", { name: "Modifica data" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByLabel("Data").fill(`${PASSATO}-06-25`);
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo).toBeHidden();
  // la scadenza si sposta di altrettanto (10 giorni)
  expect(
    (
      await sql`select data_preventivo::text d, valido_fino::text v from preventivi where id = ${id}`
    )[0],
  ).toEqual({
    d: `${PASSATO}-06-25`,
    v: `${PASSATO}-07-25`,
  });

  // un altro anno non si può: la numerazione è per anno (il campo lo limita; si forza per provare il server)
  await page.getByRole("button", { name: "Modifica data" }).click();
  await dialogo.getByLabel("Data").evaluate((el: HTMLInputElement) => {
    el.removeAttribute("min");
    el.removeAttribute("max");
  });
  await dialogo.getByLabel("Data").fill(`${PASSATO + 1}-01-10`);
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo.getByText(`La data deve restare nel ${PASSATO}`).first()).toBeVisible();
  expect((await sql`select data_preventivo::text d from preventivi where id = ${id}`)[0].d).toBe(
    `${PASSATO}-06-25`,
  );
});

test("l'elenco mostra la data del preventivo e il PDF la usa", async ({ page }) => {
  await accedi(page);
  await page.goto("/preventivi");
  await page.getByLabel(/Cerca/).first().fill(OGGETTO);
  await expect(page.getByRole("row").filter({ hasText: OGGETTO })).toContainText(
    `25/06/${PASSATO}`,
  );
  const pdf = await page.request.get(`/api/pdf/preventivi/${id}`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("pdf");
});

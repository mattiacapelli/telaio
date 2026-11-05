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
const OGGETTO = "E2E modifica bozza";

test.describe.configure({ mode: "serial" });

async function accedi(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
}

async function pulisci() {
  const ids = await sql`select id from preventivi where oggetto like ${`${OGGETTO}%`}`;
  for (const { id } of ids) {
    await sql`delete from preventivo_righe where preventivo_id = ${id}`;
    await sql`delete from preventivi where id = ${id}`;
  }
}

test.beforeAll(pulisci);
test.afterAll(async () => {
  await pulisci();
  await sql.end({ timeout: 2 });
});

let id = "";

test("la bozza ha il tasto Modifica e si riapre nell'editor con tutto compilato", async ({
  page,
}) => {
  await accedi(page);
  await page.goto("/preventivi/nuovo");
  await page.locator("input[name=oggetto]").fill(OGGETTO);
  await page.getByLabel("Descrizione prestazione 1").fill("Sito vetrina");
  await page.getByLabel("Prezzo prestazione 1").fill("1000,00");
  await page.getByRole("button", { name: /Aggiungi abbonamento/ }).click();
  await page.getByLabel("Descrizione abbonamento 1").fill("Hosting — canone mensile");
  await page.getByLabel("Periodicità abbonamento 1").selectOption("canone_mensile");
  await page.getByLabel("Prezzo abbonamento 1").fill("10");
  await page.getByRole("button", { name: /Aggiungi abbonamento/ }).click();
  await page.getByLabel("Descrizione abbonamento 2").fill("Hosting — canone annuo");
  await page.getByLabel("Periodicità abbonamento 2").selectOption("canone_annuo");
  await page.getByLabel("Prezzo abbonamento 2").fill("100");
  await page.getByLabel("Alternativa per abbonamento 2").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Salva bozza" }).click();
  await expect(page).toHaveURL(/\/preventivi\/[0-9a-f-]{36}$/);
  id = page.url().split("/").pop() ?? "";

  await page.getByRole("link", { name: "Modifica", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/preventivi/${id}/modifica$`));
  await expect(page.getByRole("heading", { name: "Modifica bozza" })).toBeVisible();
  await expect(page.locator("input[name=oggetto]")).toHaveValue(OGGETTO);
  await expect(page.getByLabel("Descrizione prestazione 1")).toHaveValue("Sito vetrina");
  await expect(page.getByLabel("Prezzo prestazione 1")).toHaveValue("1000,00");
  // le alternative annuale/mensile restano legate
  await expect(page.getByText("Alternativa: il cliente sceglie una periodicità")).toHaveCount(2);
});

test("le modifiche si salvano: righe e totali ricalcolati, stesso preventivo, nessun numero", async ({
  page,
}) => {
  await accedi(page);
  await page.goto(`/preventivi/${id}/modifica`);
  await page.locator("input[name=oggetto]").fill(`${OGGETTO} rivista`);
  await page.getByLabel("Prezzo prestazione 1").fill("1200,00");
  await page.getByLabel("Quantità prestazione 1").fill("2");
  await page.getByRole("button", { name: /Aggiungi prestazione/ }).click();
  await page.getByLabel("Descrizione prestazione 2").fill("Logo");
  await page.getByLabel("Prezzo prestazione 2").fill("300,00");
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page).toHaveURL(new RegExp(`/preventivi/${id}$`));

  const [p] =
    await sql`select oggetto, stato, numero, imponibile_cent from preventivi where id = ${id}`;
  expect(p).toMatchObject({
    oggetto: `${OGGETTO} rivista`,
    stato: "bozza",
    numero: null,
    imponibile_cent: 2 * 120000 + 30000,
  });
  const righe =
    await sql`select descrizione, tipo, gruppo_alternativa_id from preventivo_righe where preventivo_id = ${id} order by posizione`;
  expect(righe).toHaveLength(4);
  // le due alternative hanno ancora lo stesso gruppo
  const gruppi = righe.filter(
    (r: { gruppo_alternativa_id: string | null }) => r.gruppo_alternativa_id,
  );
  expect(gruppi).toHaveLength(2);
  expect(gruppi[0].gruppo_alternativa_id).toBe(gruppi[1].gruppo_alternativa_id);
  expect(
    (
      await sql`select count(*)::int n from audit_log where azione = 'preventivo.modificato' and entita_id = ${id}`
    )[0].n,
  ).toBe(1);
});

test("una riga incompleta blocca il salvataggio e togliere una riga la elimina", async ({
  page,
}) => {
  await accedi(page);
  await page.goto(`/preventivi/${id}/modifica`);
  await page.getByLabel("Descrizione prestazione 2").fill("");
  await expect(page.getByRole("button", { name: "Salva modifiche" })).toBeDisabled();
  await page.getByRole("button", { name: "Rimuovi prestazione 2" }).click();
  await expect(page.getByRole("button", { name: "Salva modifiche" })).toBeEnabled();
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page).toHaveURL(new RegExp(`/preventivi/${id}$`));
  expect(
    (await sql`select count(*)::int n from preventivo_righe where preventivo_id = ${id}`)[0].n,
  ).toBe(3);
});

test("dopo l'invio non si modifica più: niente tasto, e la pagina rimanda al dettaglio", async ({
  page,
}) => {
  await accedi(page);
  await sql`update preventivi set stato = 'inviato', numero = 'E2E-MOD-1' where id = ${id}`;
  await page.goto(`/preventivi/${id}`);
  await expect(page.getByRole("link", { name: "Modifica", exact: true })).toHaveCount(0);
  await page.goto(`/preventivi/${id}/modifica`);
  await expect(page).toHaveURL(new RegExp(`/preventivi/${id}$`));
  await expect(page.getByRole("heading", { name: "Modifica bozza" })).toHaveCount(0);
});

import { createRequire } from "node:module";
import { expect, type Page, test } from "@playwright/test";

// Come la suite esistente: gira sul database di sviluppo con l'utente del seed.
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {}
const postgres = createRequire(`${process.cwd()}/../../packages/db/package.json`)("postgres");
const sql = postgres(process.env.DATABASE_URL as string, { max: 2, onnotice: () => {} });

const email = process.env.SEED_ADMIN_EMAIL ?? "mattia@telaio.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "telaio-dev-2026";
const MAILPIT = "http://localhost:8026";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe.configure({ mode: "serial" });

let rsId = "";
let preventivoId = "";

async function accedi(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
}

test.beforeAll(async () => {
  [{ id: rsId }] =
    await sql`select id from ragioni_sociali where deleted_at is null order by created_at limit 1`;
  await sql`delete from impostazioni where chiave in ('email', 'pdf.modelli')`;
});

test.afterAll(async () => {
  await sql`delete from impostazioni where chiave in ('email', 'pdf.modelli')`;
  if (preventivoId) {
    await sql`delete from preventivo_righe where preventivo_id = ${preventivoId}`;
    await sql`delete from preventivi where id = ${preventivoId}`;
  }
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" }).catch(() => {});
  await sql.end({ timeout: 2 });
});

test("le sezioni non ancora pronte sono disattivate e non esistono come pagine", async ({
  page,
  request,
}) => {
  await accedi(page);
  await page.goto("/impostazioni/email");
  await expect(page.getByRole("link", { name: /^Pagamenti$/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Fatturazione elettronica$/ })).toHaveCount(0);
  await expect(page.locator('[aria-disabled="true"]')).toHaveCount(2);
  for (const s of ["pagamenti", "fatturazione-elettronica"]) {
    const r = await page.request.get(`/impostazioni/${s}`);
    expect(r.status(), s).toBe(404);
  }
  void request;
});

test("email: un errore di validazione non fa perdere quello che hai scritto negli altri campi", async ({
  page,
}) => {
  await accedi(page);
  await page.goto("/impostazioni/email");
  const riga = page
    .locator("li")
    .filter({ has: page.getByRole("button", { name: "Modifica" }) })
    .first();
  await riga.getByRole("button", { name: "Modifica" }).click();
  await page.getByLabel(/Nome mostrato/).fill("Fatturazione");
  await page.getByLabel(/Indirizzo email del mittente/).fill("utente@dominio");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByText("Email non valida")).toBeVisible();
  await expect(page.getByLabel(/Nome mostrato/)).toHaveValue("Fatturazione");
  const [{ n }] = await sql`select count(*)::int as n from impostazioni where chiave = 'email'`;
  expect(n).toBe(0);
});

test("email: mittente, firma e invio di prova", async ({ page }) => {
  const mailpit = await fetch(`${MAILPIT}/api/v1/messages`)
    .then((r) => r.ok)
    .catch(() => false);
  await accedi(page);
  await page.goto("/impostazioni/email");
  await page
    .locator("li")
    .filter({ has: page.getByRole("button", { name: "Modifica" }) })
    .first()
    .getByRole("button", { name: "Modifica" })
    .click();
  await page.getByLabel(/Nome mostrato/).fill("Fatturazione Studio");
  await page.getByLabel(/Indirizzo email del mittente/).fill("fatture@studio.example.com");
  await page.getByLabel(/Le risposte arrivano a/).fill("info@studio.example.com");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByText("Mittente salvato")).toBeVisible();
  await expect(page.getByText('"Fatturazione Studio" <fatture@studio.example.com>')).toBeVisible();

  await page.getByRole("button", { name: "Modifica" }).last().click();
  await page.getByLabel("Testo della firma").fill("Studio Esempio\nTel. 000 000");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByText("Firma salvata")).toBeVisible();

  if (!mailpit) {
    test.info().annotations.push({
      type: "nota",
      description: "Mailpit non raggiungibile: invio di prova saltato",
    });
    return;
  }
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
  await page.getByRole("button", { name: "Invia email di prova" }).click();
  await page.getByRole("button", { name: "Invia", exact: true }).click();
  await expect(page.getByText(/Email di prova inviata a/)).toBeVisible({ timeout: 20_000 });
  const lista = await (await fetch(`${MAILPIT}/api/v1/messages`)).json();
  expect(lista.total).toBe(1);
  const m = await (await fetch(`${MAILPIT}/api/v1/message/${lista.messages[0].ID}`)).json();
  expect(m.From.Address).toBe("fatture@studio.example.com");
  expect(m.From.Name).toBe("Fatturazione Studio");
  expect(m.ReplyTo[0].Address).toBe("info@studio.example.com");
  expect(m.Text.replace(/\r\n/g, "\n")).toMatch(/-- \nStudio Esempio\nTel\. 000 000\s*$/);
});

test("modelli PDF: salvataggio, logo non valido rifiutato, anteprime", async ({ page }) => {
  await accedi(page);
  await page.goto("/impostazioni/modelli-pdf");
  await page.getByRole("button", { name: "Modifica" }).first().click();
  await page.locator('input[name="colore"]').fill("#0a7d5a");
  await page.getByLabel(/Piè di pagina/).fill("REA BG-123");
  await page.getByLabel(/Note sui preventivi/).fill("Offerta valida 30 giorni.");
  await page
    .locator('input[name="logo"]')
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByText("Modello salvato")).toBeVisible();
  const [{ valore }] = await sql`select valore from impostazioni where chiave = 'pdf.modelli'`;
  expect(valore[rsId]).toMatchObject({ colore: "#0a7d5a", piePagina: "REA BG-123" });
  expect(valore[rsId].logo).toMatch(/^data:image\/png;base64,/);

  await page.getByRole("button", { name: "Modifica" }).first().click();
  await page.locator('input[name="logo"]').setInputFiles({
    name: "finto.png",
    mimeType: "image/png",
    buffer: Buffer.from("non è un'immagine"),
  });
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByText("Il file non è un'immagine valida")).toBeVisible();
  await page.keyboard.press("Escape");

  for (const tipo of ["preventivo", "fattura"]) {
    const r = await page.request.get(`/api/pdf/anteprima?rs=${rsId}&tipo=${tipo}`);
    expect(r.status(), tipo).toBe(200);
    expect(r.headers()["content-type"]).toBe("application/pdf");
    expect(r.headers()["cache-control"]).toContain("no-store");
    expect((await r.body()).subarray(0, 5).toString()).toBe("%PDF-");
  }
  expect((await page.request.get("/api/pdf/anteprima?rs=non-valido&tipo=fattura")).status()).toBe(
    400,
  );
});

test("PDF di un preventivo: si scarica dalla sua pagina, solo da autenticati", async ({
  page,
  browser,
}) => {
  [{ id: preventivoId }] = await sql`
    insert into preventivi (ragione_sociale_id, anno, numero, oggetto, snapshot, imponibile_cent, iva_cent, totale_cent)
    values (${rsId}, 2026, 'P-2026-901', 'Prova PDF', ${sql.json({ emittente: { id: rsId, nome: "Studio" }, cliente: { nome: "Cliente" }, regole: { ivaAttiva: true, aliquotaIvaBp: 2200 } })}, 100000, 22000, 122000)
    returning id`;
  await sql`insert into preventivo_righe (preventivo_id, posizione, descrizione, prezzo_unitario_cent, importo_cent) values (${preventivoId}, 0, 'Voce di prova', 100000, 100000)`;
  await accedi(page);
  await page.goto(`/preventivi/${preventivoId}`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Scarica PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("Preventivo-P-2026-901.pdf");

  expect(
    (await page.request.get("/api/pdf/preventivi/00000000-0000-4000-8000-000000000000")).status(),
  ).toBe(404);
  expect((await page.request.get(`/api/pdf/contratti/${preventivoId}`)).status()).toBe(404);

  const anonimo = await browser.newContext();
  const r = await anonimo.request.get(`/api/pdf/preventivi/${preventivoId}`, {
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  expect(r.status()).toBe(307);
  expect(r.headers().location).toContain("/login");
  await anonimo.close();
});

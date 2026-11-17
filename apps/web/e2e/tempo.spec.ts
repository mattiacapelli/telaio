import { createRequire } from "node:module";
import { expect, type Page, request as playwrightRequest, test } from "@playwright/test";

// Gira sul database di sviluppo con l'utente del seed (cliente di esempio «demo-1»).
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {}
const postgres = createRequire(`${process.cwd()}/../../packages/db/package.json`)("postgres");
const sql = postgres(process.env.DATABASE_URL as string, { max: 2, onnotice: () => {} });

const email = process.env.SEED_ADMIN_EMAIL ?? "mattia@telaio.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "telaio-dev-2026";
const NOME = "E2E-ORE Assistenza";

test.describe.configure({ mode: "serial" });

let contrattoUrl = "";

async function accedi(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
}

async function pulisciExtra(monteOreId: string) {
  const fatture =
    await sql`select fattura_id from monte_ore_extra where monte_ore_id = ${monteOreId}`;
  await sql`delete from monte_ore_extra where monte_ore_id = ${monteOreId}`;
  for (const { fattura_id: f } of fatture) {
    await sql`delete from fattura_righe where fattura_id = ${f}`;
    await sql`delete from fatture where id = ${f}`;
  }
  await sql`delete from voci_tempo where descrizione = 'e2e-ore extra'`;
}

async function pulisci() {
  const contratti = await sql`select id from monte_ore where nome = ${NOME}`;
  for (const { id } of contratti) await pulisciExtra(id);
  await sql`delete from voci_tempo where ticket_id in (select id from ticket where titolo = 'E2E-ORE ticket')`;
  await sql`delete from ticket where titolo = 'E2E-ORE ticket'`;
  await sql`delete from progetti where codice = 'E2E-ORE-001'`;
  await sql`delete from voci_tempo where monte_ore_id in (select id from monte_ore where nome = ${NOME}) or descrizione like 'e2e-ore%'`;
  await sql`delete from monte_ore where nome = ${NOME}`;
}

/** Una data di qualche giorno fa (anche a cavallo di mese), così il periodo in corso è il primo. */
function giorniFa(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test.beforeAll(pulisci);
test.afterAll(async () => {
  await pulisci();
  await sql.end();
});

test("nuovo contratto a ore: valori non validi rifiutati, poi creato con il saldo pieno", async ({
  page,
}) => {
  await accedi(page);
  await page.goto("/monte-ore");
  await page.getByRole("button", { name: "Nuovo monte ore" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo
    .locator('select[name="clienteRefId"]')
    .selectOption({ label: "Trattoria Da Marco" });
  await dialogo.locator('input[name="nome"]').fill(NOME);
  await dialogo.locator('input[name="oreIncluse"]').fill("abc");
  await dialogo.locator('input[name="dataInizio"]').fill(giorniFa(3));
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo.getByText(/Ore non valide/)).toBeVisible();

  await dialogo.locator('input[name="oreIncluse"]').fill("10");
  await dialogo.locator('input[name="tariffaExtra"]').fill("60,00");
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(page).toHaveURL(/\/monte-ore\/[0-9a-f-]{36}$/);
  contrattoUrl = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: NOME })).toBeVisible();
  await expect(page.getByText("Incluse nel periodo").locator("..")).toContainText("10 h");
  await expect(page.getByText("Rimanenti", { exact: true }).locator("..")).toContainText("10 h");
});

test("tempo registrato: arrotondato per eccesso a 15 minuti, il saldo scala; fuori contratto e durata errata rifiutati", async ({
  page,
}) => {
  await accedi(page);
  await page.goto(contrattoUrl);
  await page.getByRole("button", { name: "Registra tempo" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.locator('input[name="durata"]').fill("boh");
  await dialogo.locator('input[name="descrizione"]').fill("e2e-ore prima");
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo.getByText(/Durata non valida/)).toBeVisible();

  await dialogo.locator('input[name="data"]').fill("2001-01-01");
  await dialogo.locator('input[name="durata"]').fill("1:10");
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo.getByText(/fuori dal periodo/)).toBeVisible();

  await dialogo.locator('input[name="data"]').fill(giorniFa(1));
  await dialogo.getByRole("button", { name: "Salva" }).click();
  await expect(dialogo).toBeHidden();
  // 1 h 10 → conta 1 h 15; restano 8 h 45
  await expect(page.getByText("Usate", { exact: true }).locator("..")).toContainText("1 h 15 min");
  await expect(page.getByText("Rimanenti", { exact: true }).locator("..")).toContainText(
    "8 h 45 min",
  );
  await expect(page.getByText("lavorati 1 h 10 min")).toBeVisible();
});

test("timer: parte, uno solo alla volta, si ferma e conta un quarto d'ora; poi si elimina e il saldo torna", async ({
  page,
}) => {
  await accedi(page);
  await page.goto("/tempo");
  await page
    .locator('form select[name="monteOreId"]')
    .selectOption({ label: `Trattoria Da Marco · ${NOME}` });
  await page.getByLabel("Descrizione", { exact: true }).fill("e2e-ore timer");
  await page.getByRole("button", { name: "Avvia" }).click();
  await expect(page.getByText("Timer in corso")).toBeVisible();
  // niente secondo timer: il modulo di avvio non c'è più
  await expect(page.getByRole("button", { name: "Avvia" })).toHaveCount(0);

  await page.getByRole("button", { name: "Ferma" }).click();
  await expect(page.getByText("Registrati 15 min")).toBeVisible();
  await expect(page.getByText("Timer in corso")).toBeHidden();
  const riga = page.getByRole("row", { name: /e2e-ore timer/ });
  await expect(riga).toContainText("15 min");

  await page.goto(contrattoUrl);
  await expect(page.getByText("Usate", { exact: true }).locator("..")).toContainText("1 h 30 min");

  await page.getByRole("button", { name: "Elimina e2e-ore timer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Usate", { exact: true }).locator("..")).toContainText("1 h 15 min");
});

test("timer scartato non registra nulla", async ({ page }) => {
  await accedi(page);
  await page.goto("/tempo");
  await page
    .locator('form select[name="clienteRefId"]')
    .selectOption({ label: "Trattoria Da Marco" });
  await page.getByRole("button", { name: "Avvia" }).click();
  await expect(page.getByText("Timer in corso")).toBeVisible();
  await page.getByRole("button", { name: "Scarta" }).click();
  await expect(page.getByText("Timer in corso")).toBeHidden();
  const [{ n }] =
    await sql`select count(*)::int n from voci_tempo where avviato_at is not null and deleted_at is null`;
  expect(n).toBe(0);
});

test("sulla scheda cliente compare il contratto con il suo saldo", async ({ page }) => {
  await accedi(page);
  await page.goto("/clienti/demo-1");
  await expect(page.getByRole("heading", { name: "Monte ore" })).toBeVisible();
  await expect(page.getByRole("link", { name: NOME })).toBeVisible();
  await expect(page.getByText("1 h 15 min su 10 h")).toBeVisible();
});

test("timer semplificato: un tocco sul contratto avvia, la descrizione si scrive dopo, Ferma registra", async ({
  page,
}) => {
  await accedi(page);
  await page.goto("/timer");
  await page.getByRole("button", { name: `Avvia il timer su Trattoria Da Marco, ${NOME}` }).click();
  await expect(page.getByText("In corso", { exact: true })).toBeVisible();
  // l'indicatore resta in intestazione, anche su un'altra pagina
  await page.goto("/clienti");
  await expect(page.getByRole("link", { name: /Timer in corso/ })).toBeVisible();
  await page.goto("/timer");
  await page.getByLabel("Cosa stai facendo").fill("e2e-ore semplice");
  await page.getByLabel("Cosa stai facendo").blur();
  await expect
    .poll(
      async () =>
        (await sql`select descrizione from voci_tempo where avviato_at is not null`)[0]
          ?.descrizione,
    )
    .toBe("e2e-ore semplice");
  await page.getByRole("button", { name: "Ferma" }).click();
  await expect(page.getByText("Registrati 15 min")).toBeVisible();
  await expect(page.getByRole("link", { name: /Timer in corso/ })).toHaveCount(0);
  // compare tra quelli di oggi e tra gli ultimi lavori da riavviare
  await expect(page.getByRole("list").getByText("e2e-ore semplice")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Avvia di nuovo: .*e2e-ore semplice/ }),
  ).toBeVisible();
  await sql`delete from voci_tempo where descrizione = 'e2e-ore semplice'`;
});

test.describe("da telefono", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("la barra in basso ha Timer: si avvia da «ultimi lavori» e si ferma con un tocco", async ({
    page,
  }) => {
    await accedi(page);
    const barra = page.getByRole("navigation", { name: "Sezioni principali" });
    await barra.getByRole("link", { name: "Timer" }).click();
    await expect(page).toHaveURL(/\/timer$/);
    await page.getByRole("button", { name: /Avvia di nuovo: .*e2e-ore prima/ }).click();
    await expect(page.getByText("In corso", { exact: true })).toBeVisible();
    await expect(barra.getByRole("status", { name: "Timer in corso" })).toBeVisible();
    // il tasto Ferma è grande e raggiungibile col pollice
    const ferma = page.getByRole("button", { name: "Ferma" });
    const box = await ferma.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(56);
    await ferma.click();
    await expect(page.getByText("Registrati 15 min")).toBeVisible();
    // nessuno scorrimento orizzontale
    const sfora = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(sfora).toBeLessThanOrEqual(0);
    await sql`delete from voci_tempo where descrizione = 'e2e-ore prima' and minuti_effettivi < 5`;
  });
});

test("ore extra: avviso in dashboard, fattura in bozza una volta sola, estratto PDF", async ({
  page,
}) => {
  const [{ id }] = await sql`select id from monte_ore where nome = ${NOME}`;
  // 75 minuti già contati + 10 ore: 600 inclusi → 1 h 15 min extra a 60 €/h = 75,00 €
  await sql`insert into voci_tempo (cliente_ref_id, monte_ore_id, data, minuti_effettivi, minuti, descrizione)
    select cliente_ref_id, id, ${giorniFa(1)}, 600, 600, 'e2e-ore extra' from monte_ore where id = ${id}`;
  await accedi(page);

  await page.goto("/");
  await expect(page.getByText("Monte ore in esaurimento")).toBeVisible();
  await expect(page.getByText("Ore extra da fatturare")).toBeVisible();

  await page.goto(contrattoUrl);
  await expect(page.getByText("Ore extra da fatturare: 1 h 15 min")).toBeVisible();
  await expect(page.getByText(/75,00.*60,00.*\/h/).first()).toBeVisible();
  await page.getByRole("button", { name: "Crea la fattura" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Crea la bozza" }).click();
  await expect(page).toHaveURL(/\/fatture\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/Ore extra/).first()).toBeVisible();
  await expect(page.getByText(/75,00/).first()).toBeVisible();

  // fatturate: non tornano da fatturare, né in pagina né in dashboard
  await page.goto(contrattoUrl);
  await expect(page.getByText(/Ore extra da fatturare/)).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByText("Ore extra da fatturare")).toHaveCount(0);
  const [{ n }] = await sql`select count(*)::int n from monte_ore_extra where monte_ore_id = ${id}`;
  expect(n).toBe(1);

  // estratto PDF: solo da autenticati, con il periodo scelto
  const pdf = await page.request.get(`/api/pdf/ore/${id}`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect((await page.request.get(`/api/pdf/ore/${id}?ciclo=99`)).status()).toBe(404);
  expect((await page.request.get(`/api/pdf/ore/${id}?ciclo=abc`)).status()).toBe(404);
  const anonimo = await playwrightRequest.newContext({ baseURL: "http://localhost:3000" });
  expect((await anonimo.get(`/api/pdf/ore/${id}`, { maxRedirects: 0 })).status()).toBe(307);
  await anonimo.dispose();

  await pulisciExtra(id);
});

test("dal ticket: il timer parte con il cliente del progetto e il tempo compare sul ticket", async ({
  page,
}) => {
  const [{ id: cliente }] =
    await sql`select id from clienti_ref where twenty_company_id = 'demo-1'`;
  const [{ id: progetto }] =
    await sql`insert into progetti (codice, nome, cliente_ref_id) values ('E2E-ORE-001', 'E2E-ORE progetto', ${cliente}) returning id`;
  await sql`insert into ticket (progetto_id, numero, titolo, posizione) values (${progetto}, 1, 'E2E-ORE ticket', 1000)`;
  await sql`update progetti set ultimo_ticket = 1 where id = ${progetto}`;
  await accedi(page);
  await page.goto(`/progetti/${progetto}/ticket/1`);
  await page.getByRole("button", { name: "Avvia timer" }).click();
  await expect(page.getByRole("link", { name: /Timer in corso/ })).toBeVisible();
  await page.goto("/timer");
  await expect(page.getByText("Trattoria Da Marco").first()).toBeVisible();
  await page.getByRole("button", { name: "Ferma" }).click();
  await expect(page.getByText(/Registrati/)).toBeVisible();
  await page.goto(`/progetti/${progetto}/ticket/1`);
  await expect(page.getByText(/registrati su questo ticket/)).toBeVisible();
  const [v] =
    await sql`select progetto_id, cliente_ref_id from voci_tempo where ticket_id in (select id from ticket where titolo = 'E2E-ORE ticket')`;
  expect(v).toMatchObject({ progetto_id: progetto, cliente_ref_id: cliente });
});

test("concluso non accetta tempo; con tempo registrato non si elimina; svuotato sì", async ({
  page,
}) => {
  await accedi(page);
  await page.goto(contrattoUrl);
  await page.getByRole("button", { name: "Concludi" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Concludi" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "Registra tempo" })).toHaveCount(0);
  await expect(page.getByText("Concluso", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Elimina", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByRole("dialog").getByText(/si conclude/)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Elimina e2e-ore prima" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elimina" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "Elimina", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elimina" }).click();
  await expect(page).toHaveURL(/\/monte-ore$/);
  await expect(page.getByText(NOME)).toHaveCount(0);
});

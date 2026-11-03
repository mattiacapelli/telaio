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
const PREFISSO = "E2E progetto";
const OGGETTO_PREVENTIVO = "E2E progetto da preventivo";

test.describe.configure({ mode: "serial" });

let preventivoId = "";
let preventivoBozzaId = "";

async function accedi(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
}

async function pulisci() {
  const ids = await sql`select id from progetti where nome like ${`${PREFISSO}%`}`;
  for (const { id } of ids) {
    await sql`delete from audit_log where entita_id = ${String(id)}`;
    await sql`delete from progetti where id = ${id}`;
  }
  const prev = await sql`select id from preventivi where oggetto like ${`${OGGETTO_PREVENTIVO}%`}`;
  for (const { id } of prev) {
    await sql`delete from progetti where preventivo_id = ${id}`;
    await sql`delete from preventivo_righe where preventivo_id = ${id}`;
    await sql`delete from preventivi where id = ${id}`;
  }
}

async function creaPreventivo(stato: string, oggetto: string): Promise<string> {
  const [rs] =
    await sql`select id from ragioni_sociali where deleted_at is null order by created_at limit 1`;
  const [p] = await sql`
    insert into preventivi (ragione_sociale_id, anno, stato, oggetto, snapshot)
    values (${rs.id}, 2026, ${stato}::stato_preventivo, ${oggetto}, ${sql.json({ emittente: {}, cliente: {}, regole: {} })})
    returning id`;
  return p.id;
}

test.beforeAll(async () => {
  await pulisci();
  preventivoId = await creaPreventivo("accettato", OGGETTO_PREVENTIVO);
  preventivoBozzaId = await creaPreventivo("bozza", `${OGGETTO_PREVENTIVO} bozza`);
});
test.afterAll(async () => {
  await pulisci();
  await sql.end({ timeout: 2 });
});

test("le pagine dei progetti richiedono l'accesso", async ({ page }) => {
  for (const url of ["/progetti", "/progetti/nuovo"]) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("creazione manuale, modifica e cambio di stato", async ({ page }) => {
  await accedi(page);
  await page.getByRole("link", { name: "Progetti" }).first().click();
  await expect(page.getByRole("heading", { name: "Progetti", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Nuovo progetto" }).click();
  await expect(page).toHaveURL(/\/progetti\/nuovo$/);

  // errore lato server: il nome mancante o le date incoerenti non cancellano gli altri campi
  await page.locator("input[name=nome]").fill(`${PREFISSO} manuale`);
  await page.locator("select[name=categoria]").selectOption("sito_web");
  await page.locator("select[name=priorita]").selectOption("alta");
  await page.locator("textarea[name=descrizione]").fill("Descrizione di prova");
  await page.locator("input[name=dataInizioPrevista]").fill("2026-12-10");
  await page.locator("input[name=dataFinePrevista]").fill("2026-12-01");
  await expect(page.getByText("La fine non può precedere l'inizio")).toBeVisible();
  await expect(page.getByRole("button", { name: "Crea progetto" })).toBeDisabled();
  await page.locator("input[name=dataFinePrevista]").fill("2027-01-31");
  await page.getByRole("button", { name: "Crea progetto" }).click();

  await expect(page).toHaveURL(/\/progetti\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`${PREFISSO} manuale`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/PRJ-\d{4}-\d{3}/);
  await expect(page.getByText("Descrizione di prova")).toBeVisible();
  await expect(page.getByText("Nessuna risorsa")).toBeVisible();

  // modifica
  await page.getByRole("link", { name: "Modifica", exact: true }).click();
  await expect(page.locator("input[aria-label='Codice progetto']")).toBeDisabled();
  await page.locator("input[name=nome]").fill(`${PREFISSO} manuale modificato`);
  await page.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("manuale modificato");

  // cambio di stato → date effettive
  await page.getByRole("button", { name: "Cambia stato" }).click();
  await page.locator("select[name=stato]").selectOption("in_corso");
  await page.getByRole("button", { name: "Aggiorna" }).click();
  await expect(page.getByText("Stato aggiornato")).toBeVisible();
  await expect(page.getByText("In corso").first()).toBeVisible();

  const [p] = await sql`select * from progetti where nome = ${`${PREFISSO} manuale modificato`}`;
  expect(p).toMatchObject({ stato: "in_corso", categoria: "sito_web", priorita: "alta" });
  expect(p.data_inizio_effettiva).not.toBeNull();
  const azioni =
    await sql`select azione from audit_log where entita_id = ${p.id} order by created_at`;
  expect(azioni.map((a: { azione: string }) => a.azione)).toEqual([
    "progetto.creato",
    "progetto.modificato",
    "progetto.stato",
  ]);
});

test("risorse: aggiunta, URL non valido rifiutato, modifica ed eliminazione", async ({ page }) => {
  await accedi(page);
  const [p] = await sql`select id from progetti where nome = ${`${PREFISSO} manuale modificato`}`;
  await page.goto(`/progetti/${p.id}`);

  await page.getByRole("button", { name: "Aggiungi risorsa" }).click();
  await page.locator("select[name=tipo]").selectOption("repository");
  await page.locator("input[name=titolo]").fill("Repo principale");
  // type=url blocca già molti casi lato browser: javascript: lo supera, ci pensa il server
  await page.locator("input[name=url]").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await expect(page.getByText("Usa un indirizzo http o https")).toBeVisible();
  await expect(page.locator("input[name=titolo]")).toHaveValue("Repo principale");
  expect(
    (await sql`select count(*)::int as n from progetto_risorse where progetto_id = ${p.id}`)[0].n,
  ).toBe(0);

  await page.locator("input[name=url]").fill("https://github.com/mc/repo");
  await page.locator("select[name=ambiente]").selectOption("development");
  await page.locator("input[name=principale]").check();
  await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await expect(page.getByText("Repo principale")).toBeVisible();
  await expect(page.getByText("Principale", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Apri Repo principale" })).toHaveAttribute(
    "href",
    "https://github.com/mc/repo",
  );
  await expect(page.getByRole("link", { name: "Apri Repo principale" })).toHaveAttribute(
    "rel",
    /noopener/,
  );

  await page.getByRole("button", { name: "Modifica Repo principale" }).click();
  await page.locator("input[name=titolo]").fill("Repo rinominato");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByText("Repo rinominato")).toBeVisible();

  await page.getByRole("button", { name: "Elimina Repo rinominato" }).click();
  await page.getByRole("button", { name: "Elimina", exact: true }).click();
  await expect(page.getByText("Nessuna risorsa")).toBeVisible();
  const azioni = await sql`
    select azione from audit_log where azione like 'progetto_risorsa.%' and dettagli->>'progettoId' = ${p.id}
    order by created_at`;
  expect(azioni.map((a: { azione: string }) => a.azione)).toEqual([
    "progetto_risorsa.creata",
    "progetto_risorsa.modificata",
    "progetto_risorsa.eliminata",
  ]);
  await sql`delete from audit_log where azione like 'progetto_risorsa.%' and dettagli->>'progettoId' = ${p.id}`;
});

test("dal preventivo accettato: si possono creare più progetti", async ({ page }) => {
  await accedi(page);
  // un preventivo non accettato non offre l'azione
  await page.goto(`/preventivi/${preventivoBozzaId}`);
  await expect(page.getByRole("button", { name: "Crea progetto" })).toHaveCount(0);

  await page.goto(`/preventivi/${preventivoId}`);
  await page.getByRole("button", { name: "Crea progetto" }).click();
  await expect(page.locator("input[name=nome]")).toHaveValue(OGGETTO_PREVENTIVO);
  await page.locator("input[name=nome]").fill(`${PREFISSO} da preventivo`);
  await page.locator("select[name=categoria]").selectOption("ecommerce");
  await page.getByRole("button", { name: "Crea progetto" }).last().click();
  await expect(page).toHaveURL(/\/progetti\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`${PREFISSO} da preventivo`);
  await expect(page.getByRole("link", { name: new RegExp(OGGETTO_PREVENTIVO) })).toBeVisible();

  // il preventivo elenca il progetto e propone ancora di crearne un altro
  await page.goto(`/preventivi/${preventivoId}`);
  await expect(
    page.getByRole("link", { name: new RegExp(`PRJ-.*${PREFISSO} da preventivo`) }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Crea progetto" }).click();
  await page.locator("input[name=nome]").fill(`${PREFISSO} secondo da preventivo`);
  await page.getByRole("button", { name: "Crea progetto" }).last().click();
  await expect(page).toHaveURL(/\/progetti\/[0-9a-f-]{36}$/);

  const progetti = await sql`
    select * from progetti where preventivo_id = ${preventivoId} order by created_at`;
  expect(progetti).toHaveLength(2);
  expect(progetti[0]).toMatchObject({
    categoria: "ecommerce",
    stato: "pianificato",
    priorita: "normale",
  });
  expect(progetti[0].codice).not.toBe(progetti[1].codice);

  await page.goto(`/preventivi/${preventivoId}`);
  await expect(page.getByText("2 progetti collegati")).toBeVisible();
  for (const pr of progetti) {
    const azioni = await sql`select azione from audit_log where entita_id = ${pr.id}`;
    expect(azioni.map((a: { azione: string }) => a.azione)).toEqual([
      "progetto.creato_da_preventivo",
    ]);
  }
});

test("l'elenco filtra e cerca", async ({ page }) => {
  await accedi(page);
  await page.goto("/progetti");
  await page.getByPlaceholder("Nome o codice…").fill(`${PREFISSO} da preventivo`);
  await expect(page.getByText(`${PREFISSO} da preventivo`).first()).toBeVisible();
  await expect(page.getByText(`${PREFISSO} manuale modificato`)).toHaveCount(0);
});

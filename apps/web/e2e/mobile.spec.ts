import { devices, expect, type Page, test } from "@playwright/test";

// Telefono: stesso browser degli altri test, con lo schermo e il tocco di un iPhone.
const { defaultBrowserType: _, ...iphone } = devices["iPhone 14"];
test.use(iphone);

const email = process.env.SEED_ADMIN_EMAIL ?? "mattia@telaio.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "telaio-dev-2026";

async function accedi(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
}

const sforamento = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test("nessuna pagina principale sfora la larghezza dello schermo", async ({ page }) => {
  await accedi(page);
  for (const url of [
    "/",
    "/clienti",
    "/preventivi",
    "/fatture",
    "/incassi",
    "/scadenzario",
    "/abbonamenti",
    "/impostazioni/ragioni-sociali",
    "/impostazioni/email",
    "/impostazioni/modelli-pdf",
    "/preventivi/nuovo",
  ]) {
    await page.goto(url);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(await sforamento(page), url).toBeLessThanOrEqual(0);
  }
});

test("la barra in basso porta alle sezioni principali e apre il menu completo", async ({
  page,
}) => {
  await accedi(page);
  const barra = page.getByRole("navigation", { name: "Sezioni principali" });
  await expect(barra).toBeVisible();
  await expect(barra.getByRole("link")).toHaveCount(4);
  await expect(barra.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  await barra.getByRole("link", { name: "Clienti" }).click();
  await expect(page).toHaveURL(/\/clienti$/);
  await expect(barra.getByRole("link", { name: "Clienti" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await barra.getByRole("button", { name: "Menu" }).click();
  const menu = page.getByRole("dialog");
  await expect(menu.getByRole("link", { name: "Scadenzario" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Impostazioni" })).toBeVisible();
  await menu.getByRole("button", { name: "Chiudi il menu" }).click();
  await expect(menu).toBeHidden();
});

test("su telefono l'intestazione è solo ricerca: niente menu, percorso o Nuovo", async ({
  page,
}) => {
  await accedi(page);
  const intestazione = page.locator("header").first();
  await expect(intestazione.getByRole("button", { name: /Cerca/ })).toBeVisible();
  await expect(intestazione.getByRole("button", { name: "Apri il menu" })).toHaveCount(0);
  await expect(intestazione.getByRole("navigation", { name: "Percorso" })).toBeHidden();
  await expect(intestazione.getByRole("button", { name: /Nuovo/ })).toBeHidden();
});

test("la barra in basso non c'è sul desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await accedi(page);
  await expect(page.getByRole("navigation", { name: "Sezioni principali" })).toBeHidden();
});

test("le liste diventano schede: niente intestazioni di tabella, titolo e coppie etichetta-valore", async ({
  page,
}) => {
  await accedi(page);
  await page.goto("/clienti");
  await expect(page.locator("thead")).toBeHidden();
  const riga = page.locator("tbody tr").first();
  await expect(riga).toBeVisible();
  // ogni cella non titolo mostra la sua etichetta
  const etichette = await riga
    .locator("td[data-label]")
    .evaluateAll((celle) => celle.map((c) => getComputedStyle(c, "::before").content));
  expect(etichette.some((e) => e.length > 2 && e !== "none")).toBe(true);
  const larghezza = await riga.evaluate((r) => r.getBoundingClientRect().width);
  expect(larghezza).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
});

test("il menu delle impostazioni è una riga scorrevole che parte dalla voce attiva", async ({
  page,
}) => {
  await accedi(page);
  await page.goto("/impostazioni/sicurezza");
  const menu = page.getByRole("navigation", { name: "Sezioni delle impostazioni" });
  await expect(menu.getByRole("link", { name: "Profilo e sicurezza" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(menu.getByRole("link", { name: "Profilo e sicurezza" })).toBeInViewport();
  // le intestazioni dei gruppi non occupano righe
  await expect(menu.getByText("Azienda", { exact: true })).toBeHidden();
  expect(await sforamento(page)).toBeLessThanOrEqual(0);
});

test("campi e pulsanti sono comodi da toccare e non fanno zoomare iOS", async ({ page }) => {
  await accedi(page);
  await page.goto("/preventivi/nuovo");
  const campo = page
    .locator("input:not([type=hidden]):not([type=checkbox]):not([type=radio])")
    .first();
  await expect(campo).toBeVisible();
  expect(
    Number.parseFloat(await campo.evaluate((e) => getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  const alt = await campo.evaluate((e) => e.getBoundingClientRect().height);
  expect(alt).toBeGreaterThanOrEqual(40);
  const bottone = page.getByRole("button", { name: "Salva bozza" });
  expect((await bottone.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);
});

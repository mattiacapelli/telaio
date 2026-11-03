import { expect, type Page, test } from "@playwright/test";

const email = process.env.SEED_ADMIN_EMAIL ?? "mattia@telaio.local";
const password = process.env.SEED_ADMIN_PASSWORD ?? "telaio-dev-2026";

async function accedi(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
}

async function apri(page: Page) {
  // la scorciatoia si registra a idratazione finita: si riprova finché la finestra si apre
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder(/Cerca clienti/)).toBeVisible({ timeout: 1000 });
  }).toPass();
  return page.getByPlaceholder(/Cerca clienti/);
}

test("⌘K apre la ricerca, Esc la chiude e la stessa scorciatoia la richiude", async ({ page }) => {
  await accedi(page);
  const campo = await apri(page);
  await expect(page.getByRole("option", { name: /Registra incasso/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(campo).toBeHidden();
  await page.keyboard.press("Control+k");
  await expect(campo).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(campo).toBeHidden();
});

test("filtra azioni, pagine e impostazioni; Invio apre la prima voce", async ({ page }) => {
  await accedi(page);
  const campo = await apri(page);
  await campo.fill("incasso");
  await expect(page.getByRole("option", { name: /Registra incasso/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Incassi/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Nuovo progetto/ })).toBeHidden();

  // sinonimo: «smtp» porta alle impostazioni email
  await campo.fill("smtp");
  await expect(page.getByRole("option", { name: /Email e mittenti/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/impostazioni\/email$/);
  await expect(campo).toBeHidden();
});

test("trova anche i contenuti: clienti e progetti, e senza risultati lo dice", async ({ page }) => {
  await accedi(page);
  const campo = await apri(page);
  await campo.fill("comune");
  await expect(page.getByRole("option", { name: /Comune di Esempio/ }).first()).toBeVisible();
  await page
    .getByRole("option", { name: /Comune di Esempio/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/clienti\//);

  const campo2 = await apri(page);
  await campo2.fill("zzqxwv");
  await expect(page.getByText("Nessun risultato per «zzqxwv»")).toBeVisible();
});

test("cambia il tema dalla ricerca", async ({ page }) => {
  await accedi(page);
  const campo = await apri(page);
  await campo.fill("tema scuro");
  await page.keyboard.press("Enter");
  await expect(campo).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  // ripristina il tema del dispositivo
  const campo2 = await apri(page);
  await campo2.fill("tema del dispositivo");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});

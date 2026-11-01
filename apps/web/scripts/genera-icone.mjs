// Genera le icone della PWA da `public/icons/logo.svg` (e dalla geometria della «T»).
// Uso: pnpm --filter @telaio/web icone
// Per il logo definitivo basta sostituire logo.svg (e, se serve, il glifo qui sotto) e rilanciare.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const cartella = new URL("../public/icons/", import.meta.url);
const logo = readFileSync(new URL("logo.svg", cartella), "utf8");
const glifo = logo.match(/<path[^>]*\sd="([^"]+)"/)?.[1] ?? "";
const SFONDO = "#202124";

// Varianti: «any» con angoli arrotondati (il file logo.svg), «piena» a tutto campo (maskable e Apple),
// «monocromatica» con il solo glifo scuro su trasparente.
const svg = {
  any: logo,
  piena: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${SFONDO}"/><path fill="#fff" d="${glifo}"/></svg>`,
  mono: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#000" d="${glifo}"/></svg>`,
};

const uscite = [
  ["icon-192.png", "any", 192, false],
  ["icon-512.png", "any", 512, false],
  ["icon-maskable-512.png", "piena", 512, false],
  ["icon-monochrome-512.png", "mono", 512, true],
  ["apple-touch-icon.png", "piena", 180, false],
];

const browser = await chromium.launch();
const pagina = await browser.newPage();
for (const [nome, variante, lato, trasparente] of uscite) {
  await pagina.setViewportSize({ width: lato, height: lato });
  await pagina.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${lato}px;height:${lato}px}</style>${svg[variante]}`,
  );
  await pagina.screenshot({
    path: new URL(nome, cartella).pathname,
    omitBackground: true,
    clip: { x: 0, y: 0, width: lato, height: lato },
  });
  console.log("scritto", nome, trasparente ? "(trasparente)" : "");
}
await browser.close();

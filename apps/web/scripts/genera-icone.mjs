// Genera le icone della PWA da `public/icons/logo.png` (il logo di Telaio, con angoli arrotondati e trasparenti).
// Uso: pnpm --filter @telaio/web icone
// Per cambiare logo basta sostituire logo.png e rilanciare. Le coordinate del ritaglio centrale
// (la placca nera interna, senza alone) vanno riviste solo se cambia la proporzione del disegno.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const cartella = new URL("../public/icons/", import.meta.url);
const sorgente = `data:image/png;base64,${readFileSync(new URL("logo.png", cartella)).toString("base64")}`;

// Quadrato centrale interamente dentro la placca nera: serve per le varianti a tutto campo e monocromatica.
const RITAGLIO = { x: 127, y: 134, lato: 640 };

// Varianti: «any» il logo com'è, «piena» a tutto campo (maskable e Apple, con margine di sicurezza),
// «mono» il solo glifo scuro su trasparente.
const uscite = [
  ["icon-192.png", "any", 192],
  ["icon-512.png", "any", 512],
  ["icon-maskable-512.png", "piena", 512],
  ["icon-monochrome-512.png", "mono", 512],
  ["apple-touch-icon.png", "piena", 180],
];

const browser = await chromium.launch();
const pagina = await browser.newPage();
await pagina.setContent("<canvas id=c></canvas>");
for (const [nome, variante, lato] of uscite) {
  await pagina.setViewportSize({ width: lato, height: lato });
  const png = await pagina.evaluate(
    async ({ sorgente, variante, lato, r }) => {
      const img = new Image();
      img.src = sorgente;
      await img.decode();
      const c = document.getElementById("c");
      c.width = c.height = lato;
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      if (variante === "any") {
        g.drawImage(img, 0, 0, lato, lato);
      } else if (variante === "piena") {
        g.fillStyle = "#000";
        g.fillRect(0, 0, lato, lato);
        const d = lato * 0.86;
        g.drawImage(img, r.x, r.y, r.lato, r.lato, (lato - d) / 2, (lato - d) / 2, d, d);
      } else {
        g.drawImage(img, r.x, r.y, r.lato, r.lato, 0, 0, lato, lato);
        const dati = g.getImageData(0, 0, lato, lato);
        for (let i = 0; i < dati.data.length; i += 4) {
          const luce = dati.data[i] * 0.299 + dati.data[i + 1] * 0.587 + dati.data[i + 2] * 0.114;
          dati.data[i] = dati.data[i + 1] = dati.data[i + 2] = 0;
          dati.data[i + 3] = Math.round(luce);
        }
        g.putImageData(dati, 0, 0);
      }
      return c.toDataURL("image/png").split(",")[1];
    },
    { sorgente, variante, lato, r: RITAGLIO },
  );
  const { writeFileSync } = await import("node:fs");
  writeFileSync(new URL(nome, cartella), Buffer.from(png, "base64"));
  console.log("scritto", nome);
}
await browser.close();

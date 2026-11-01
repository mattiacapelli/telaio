import type { MetadataRoute } from "next";

/**
 * Web App Manifest: rende Telaio installabile (Chrome, Edge e browser compatibili).
 * Servito a /manifest.webmanifest, anche prima del login (vedi il matcher di proxy.ts).
 * Le icone sono provvisorie: si rigenerano da public/icons/logo.svg (vedi docs/pwa.md).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Telaio",
    short_name: "Telaio",
    description:
      "Il gestionale commerciale di Mattia Capelli: clienti, preventivi, fatture, incassi e scadenze.",
    lang: "it",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-monochrome-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "monochrome",
      },
    ],
    shortcuts: [
      {
        name: "Nuovo preventivo",
        short_name: "Preventivo",
        url: "/preventivi/nuovo",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Registra incasso",
        short_name: "Incasso",
        url: "/incassi",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Scadenzario",
        short_name: "Scadenze",
        url: "/scadenzario",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}

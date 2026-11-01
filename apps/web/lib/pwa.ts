/** Utilità PWA lato browser. Nessuna di queste funzioni tocca dati dell'utente. */

const PREFISSO_CACHE = "telaio-";

/**
 * Svuota le cache dell'applicazione (e chiede al Service Worker di fare lo stesso).
 * Si chiama a logout e a login: le cache contengono solo risorse statiche, ma così non resta nulla
 * che possa essere condiviso tra due account sullo stesso dispositivo.
 */
export async function pulisciCache() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.active) {
      // Il Service Worker svuota e ripristina la sola pagina offline.
      reg.active.postMessage({ type: "PULISCI_CACHE" });
    } else if ("caches" in window) {
      for (const chiave of await caches.keys())
        if (chiave.startsWith(PREFISSO_CACHE)) await caches.delete(chiave);
    }
    // Il numero sull'icona dell'app appartiene alla sessione che si chiude.
    await (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.();
  } catch {
    // Funzioni non disponibili (browser, modalità privata): non è un errore.
  }
}

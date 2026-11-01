/** Tema chiaro/scuro. «sistema» (predefinito) segue il dispositivo; la scelta esplicita sta in localStorage. */

export type Tema = "sistema" | "chiaro" | "scuro";

const CHIAVE = "telaio-tema";
const COLORE = { chiaro: "#ffffff", scuro: "#191a1c" } as const;

/** Eseguito nell'<head> prima del primo rendering, per evitare il lampo del tema sbagliato. */
export const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem("${CHIAVE}");if(t==="chiaro"||t==="scuro"){document.documentElement.dataset.theme=t==="scuro"?"dark":"light";var c=t==="scuro"?"${COLORE.scuro}":"${COLORE.chiaro}";document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",c)})}}catch(e){}})();`;

export function leggiTema(): Tema {
  try {
    const t = localStorage.getItem(CHIAVE);
    return t === "chiaro" || t === "scuro" ? t : "sistema";
  } catch {
    return "sistema";
  }
}

export function impostaTema(tema: Tema) {
  try {
    if (tema === "sistema") localStorage.removeItem(CHIAVE);
    else localStorage.setItem(CHIAVE, tema);
  } catch {
    // Archiviazione non disponibile: il tema vale solo per questa pagina.
  }
  const html = document.documentElement;
  if (tema === "sistema") delete html.dataset.theme;
  else html.dataset.theme = tema === "scuro" ? "dark" : "light";
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scuroMedia = m.media.includes("dark");
    m.content = tema === "sistema" ? COLORE[scuroMedia ? "scuro" : "chiaro"] : COLORE[tema];
  }
}

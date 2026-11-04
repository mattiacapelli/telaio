/** Le richieste che scrivono, fatte con il cookie di sessione, devono venire dalla stessa origine dell'app. */
export function stessaOrigine(request: Request): boolean {
  const origine = request.headers.get("origin");
  if (!origine) return true; // chiamate non da browser (nessun cookie di terzi in gioco)
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return new URL(origine).host === host;
  } catch {
    return false;
  }
}

/** Content-Disposition con il nome in UTF-8 e un ripiego ASCII per i browser vecchi. */
export function intestazioneAllegato(nome: string, inline: boolean): string {
  const ascii = nome.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

/** Tipi che il browser può mostrare senza rischi (niente HTML, SVG o script). */
export const ANTEPRIMA_SICURA = /^(application\/pdf|image\/(png|jpe?g|gif|webp))$/;

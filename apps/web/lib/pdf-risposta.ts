/** Risposta HTTP per un PDF generato: mai in cache (contiene dati contabili) e mai interpretato come altro. */
export function rispostaPdf(pdf: Uint8Array, nomeFile: string, inline: boolean) {
  const nome = nomeFile.replace(/[^A-Za-z0-9._-]/g, "-");
  return new Response(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${nome}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

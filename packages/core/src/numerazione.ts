/**
 * Token supportati: {AAAA} anno a 4 cifre, {AA} anno a 2 cifre,
 * {N} numero, {NN}/{NNN}/{NNNN} numero con zeri a sinistra.
 */
export function formattaNumero(formato: string, numero: number, anno: number): string {
  return formato
    .replace(/\{AAAA\}/g, String(anno))
    .replace(/\{AA\}/g, String(anno).slice(-2))
    .replace(/\{(N+)\}/g, (_, n: string) => String(numero).padStart(n.length, "0"));
}

export function formatoValido(formato: string): boolean {
  return /\{N+\}/.test(formato);
}

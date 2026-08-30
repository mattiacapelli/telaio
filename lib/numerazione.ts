import { prisma } from "./prisma";

/**
 * Numerazione progressiva annuale, nel formato del design:
 * preventivi `PRE-2026/021`, fatture `2026/044`.
 *
 * Il progressivo riparte da 1 ogni anno e considera solo i documenti
 * dell'anno corrente, così il contatore non eredita quelli vecchi.
 */
function progressivo(numeri: string[], anno: number) {
  const max = numeri
    .map((n) => {
      const m = n.match(/(\d{4})\/(\d+)/);
      if (!m || Number(m[1]) !== anno) return 0;
      return Number(m[2]);
    })
    .reduce((a, b) => Math.max(a, b), 0);
  return String(max + 1).padStart(3, "0");
}

export async function prossimoNumeroPreventivo() {
  const anno = new Date().getFullYear();
  const esistenti = await prisma.preventivo.findMany({
    where: { numero: { contains: `${anno}/` } },
    select: { numero: true },
  });
  return `PRE-${anno}/${progressivo(esistenti.map((e) => e.numero), anno)}`;
}

export async function prossimoNumeroFattura() {
  const anno = new Date().getFullYear();
  const esistenti = await prisma.fattura.findMany({
    where: { numero: { startsWith: `${anno}/` } },
    select: { numero: true },
  });
  return `${anno}/${progressivo(esistenti.map((e) => e.numero), anno)}`;
}

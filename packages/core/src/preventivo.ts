export type StatoPreventivo =
  | "bozza"
  | "inviato"
  | "in_revisione"
  | "accettato"
  | "rifiutato"
  | "scaduto";

const TRANSIZIONI_PREVENTIVO: Record<StatoPreventivo, StatoPreventivo[]> = {
  bozza: ["inviato"],
  inviato: ["in_revisione", "accettato", "rifiutato", "scaduto"],
  in_revisione: ["inviato", "accettato", "rifiutato", "scaduto"],
  scaduto: ["in_revisione"],
  accettato: [],
  rifiutato: [],
};

export function transizioniPreventivo(da: StatoPreventivo): StatoPreventivo[] {
  return TRANSIZIONI_PREVENTIVO[da];
}

export function puoTransirePreventivo(da: StatoPreventivo, a: StatoPreventivo): boolean {
  return TRANSIZIONI_PREVENTIVO[da].includes(a);
}

export interface VoceListino {
  id: string;
  tipo: "base" | "modulo";
  nome: string;
  unaTantumCent: number;
  canoneAnnuoCent: number;
  canoneMensileCent: number;
  /** solo per i moduli: id delle basi compatibili */
  baseIds?: string[];
}

/** Moduli proponibili per una base: solo quelli assegnati a quella base. */
export function moduliCompatibili(base: string, moduli: VoceListino[]): VoceListino[] {
  return moduli.filter((m) => m.tipo === "modulo" && (m.baseIds ?? []).includes(base));
}

export interface TotaliConfiguratore {
  unaTantumCent: number;
  canoneAnnuoCent: number;
  canoneMensileCent: number;
}

export function totaliConfiguratore(voci: VoceListino[]): TotaliConfiguratore {
  return voci.reduce<TotaliConfiguratore>(
    (t, v) => ({
      unaTantumCent: t.unaTantumCent + v.unaTantumCent,
      canoneAnnuoCent: t.canoneAnnuoCent + v.canoneAnnuoCent,
      canoneMensileCent: t.canoneMensileCent + v.canoneMensileCent,
    }),
    { unaTantumCent: 0, canoneAnnuoCent: 0, canoneMensileCent: 0 },
  );
}

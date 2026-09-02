export type RegimeCalcolo = {
  nome: string;
  coefficienteRedditivita: number;
  aliquotaSostitutiva: number;
  aliquotaInps: number;
  minimaleInps: number | null;
};

export type CalcoloFiscale = {
  incassatoAnno: number;
  redditoLordoForfettario: number;
  contributiInpsDovuti: number;
  redditoImponibileFiscale: number;
  impostaSostitutivaDovuta: number;
  totaleDaAccantonare: number;
  nettoResiduo: number;
  regime: RegimeCalcolo;
};

/**
 * Calcolo fiscale del regime forfettario, per cassa sull'incassato di un
 * anno solare. Ordine delle operazioni non arbitrario: ognuna dipende dal
 * risultato della precedente, come nella dichiarazione dei redditi reale.
 */
export function calcolaFiscale(incassatoAnno: number, regime: RegimeCalcolo): CalcoloFiscale {
  // 1) Il forfettario non tassa l'incassato: il coefficiente stima quanto è
  //    "reddito", assumendo il resto assorbito da costi senza doverli
  //    documentare.
  const redditoLordoForfettario = incassatoAnno * (regime.coefficienteRedditivita / 100);

  // 2) I contributi INPS si calcolano sul reddito lordo forfettario, non
  //    sull'incassato grezzo: è un tributo previdenziale a parte, non
  //    un'imposta sul reddito netto. Il minimale (se presente) è una soglia
  //    assoluta sotto la quale l'INPS è comunque dovuto sul minimale.
  const baseContributiva = regime.minimaleInps !== null
    ? Math.max(redditoLordoForfettario, regime.minimaleInps)
    : redditoLordoForfettario;
  const contributiInpsDovuti = baseContributiva * (regime.aliquotaInps / 100);

  // 3) Approssimazione dichiarata: il calcolo corretto sottrarrebbe i
  //    contributi EFFETTIVAMENTE VERSATI nell'anno (spesso riferiti
  //    all'anno precedente, per l'acconto/saldo INPS). Un calcolatore
  //    realtime senza storico dei versamenti usa i contributi DOVUTI
  //    sull'anno corrente come proxy — sovrastima leggermente l'imposta nei
  //    primi anni, ma è un'approssimazione onesta, non un errore silente.
  const redditoImponibileFiscale = Math.max(0, redditoLordoForfettario - contributiInpsDovuti);

  // 4) L'imposta sostitutiva rimpiazza IRPEF + addizionali + IRAP in
  //    un'unica aliquota (15% standard, 5% primi 5 anni).
  const impostaSostitutivaDovuta = redditoImponibileFiscale * (regime.aliquotaSostitutiva / 100);

  const totaleDaAccantonare = contributiInpsDovuti + impostaSostitutivaDovuta;
  const nettoResiduo = incassatoAnno - totaleDaAccantonare;

  return {
    incassatoAnno,
    redditoLordoForfettario,
    contributiInpsDovuti,
    redditoImponibileFiscale,
    impostaSostitutivaDovuta,
    totaleDaAccantonare,
    nettoResiduo,
    regime,
  };
}

/** Eventi che Telaio emette verso i webhook configurati in Impostazioni → API e webhook. */
export const EVENTI_WEBHOOK = [
  { nome: "preventivo.creato", descrizione: "Nuova bozza di preventivo" },
  {
    nome: "preventivo.stato",
    descrizione: "Cambio di stato di un preventivo (inviato, accettato…)",
  },
  { nome: "fattura.emessa", descrizione: "Fattura emessa, con numero e totali" },
  { nome: "incasso.registrato", descrizione: "Incasso registrato su un conto" },
  { nome: "abbonamento.creato", descrizione: "Nuovo abbonamento" },
] as const;

export type EventoWebhook = (typeof EVENTI_WEBHOOK)[number]["nome"];

/** A chi si allega: un progetto (o un suo ticket), un preventivo o un cliente (`clienti_ref`). */
export type Destinazione =
  | { progettoId: string; ticketId?: string }
  | { preventivoId: string }
  | { clienteRefId: string };

/** Dove si caricano i file di questa destinazione. */
export function indirizzoCaricamento(d: Destinazione): string {
  if ("progettoId" in d) return `/api/progetti/${d.progettoId}/documenti`;
  if ("preventivoId" in d) return `/api/preventivi/${d.preventivoId}/documenti`;
  return `/api/clienti/${d.clienteRefId}/documenti`;
}

/** I campi del form che dicono alle azioni a chi allegare. */
export function campiDestinazione(d: Destinazione, dati: FormData) {
  if ("progettoId" in d) {
    dati.set("progettoId", d.progettoId);
    if (d.ticketId) dati.set("ticketId", d.ticketId);
  } else if ("preventivoId" in d) dati.set("preventivoId", d.preventivoId);
  else dati.set("clienteRefId", d.clienteRefId);
  return dati;
}

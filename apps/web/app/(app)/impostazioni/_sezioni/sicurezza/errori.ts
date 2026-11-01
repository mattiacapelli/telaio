/** Better Auth risponde in inglese: l'interfaccia mostra sempre un messaggio italiano. */
export function messaggioErrore(
  errore: { status?: number; message?: string } | null | undefined,
  predefinito = "Operazione non riuscita",
) {
  if (!errore) return predefinito;
  if (errore.status === 401 || /password/i.test(errore.message ?? "")) {
    return "Password non corretta";
  }
  if (errore.status === 429) return "Troppi tentativi: riprova tra poco";
  return predefinito;
}

/**
 * Gestore di invio che non svuota i campi: con `action=` React li azzera sempre, anche dopo un
 * errore, e chi ha sbagliato la password dovrebbe riscrivere tutto.
 */
export const alInvio =
  (fn: (dati: FormData) => Promise<unknown>) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void fn(new FormData(e.currentTarget));
  };

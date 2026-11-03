/** Vero se l'errore (o la sua causa, che i driver annidano) è la violazione di un vincolo univoco con questo nome. */
export function violazioneUnivoco(e: unknown, vincolo: string): boolean {
  const c = e as { code?: string; constraint_name?: string; cause?: unknown } | null;
  if (!c) return false;
  if (c.code === "23505" && (c.constraint_name ?? "").includes(vincolo)) return true;
  return c.cause ? violazioneUnivoco(c.cause, vincolo) : false;
}

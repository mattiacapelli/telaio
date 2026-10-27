/** Job dichiarati ma non ancora implementati: la coda e la schedulazione sono già pronte. */
export async function nonImplementato(nome: string) {
  console.log(`[worker] job "${nome}" non ancora implementato`);
  return { saltato: true };
}

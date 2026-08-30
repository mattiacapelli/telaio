/**
 * Nome del cookie di sessione, isolato dal resto di `lib/auth`.
 *
 * Il middleware gira sul runtime edge, dove `node:crypto` non esiste:
 * importare da qui evita di trascinarci dentro l'intero modulo di auth.
 */
export const COOKIE = "telaio_sessione";

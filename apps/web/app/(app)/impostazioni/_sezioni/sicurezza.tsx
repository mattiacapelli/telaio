import { DueFattori } from "./sicurezza/due-fattori";
import { Passkey, type PasskeyRiga } from "./sicurezza/passkey";
import { Profilo } from "./sicurezza/profilo";
import { type SessioneRiga, Sessioni } from "./sicurezza/sessioni";

/** Profilo e sicurezza dell'utente: password, verifica in due passaggi, passkey e dispositivi. */
export function SezioneSicurezza({
  nome,
  email,
  dueFattori,
  passkey,
  sessioni,
  passwordMinima,
}: {
  nome: string;
  email: string;
  dueFattori: boolean;
  passkey: PasskeyRiga[];
  sessioni: SessioneRiga[];
  passwordMinima: number;
}) {
  return (
    <>
      <Profilo nome={nome} email={email} passwordMinima={passwordMinima} />
      <DueFattori attivo={dueFattori} />
      <Passkey elenco={passkey} />
      <Sessioni elenco={sessioni} />
    </>
  );
}

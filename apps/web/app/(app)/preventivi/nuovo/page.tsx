import { StubPage } from "@/components/domain/stub-page";

export const metadata = { title: "Nuovo preventivo" };

export default function Page() {
  return (
    <StubPage
      numero="02"
      sezione="Commerciale"
      titolo="Nuovo preventivo"
      descrizione="Parti dal configuratore per scegliere base e moduli."
      vuoto={{
        titolo: "Usa il configuratore",
        testo: "La creazione manuale di un preventivo con righe libere arriverà dopo.",
      }}
    />
  );
}

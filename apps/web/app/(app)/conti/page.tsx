import { StubPage } from "@/components/domain/stub-page";

export const metadata = { title: "Conti" };

export default function Page() {
  return (
    <StubPage
      numero="11"
      sezione="Amministrazione"
      titolo="Conti"
      descrizione="Conti correnti, cassa contanti e carte, con saldo iniziale."
      vuoto={{
        titolo: "Nessun conto da mostrare",
        testo: "I conti del seed compariranno qui con i loro saldi.",
      }}
    />
  );
}

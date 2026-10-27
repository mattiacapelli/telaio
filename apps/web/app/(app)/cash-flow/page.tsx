import { StubPage } from "@/components/domain/stub-page";

export const metadata = { title: "Cash flow" };

export default function Page() {
  return (
    <StubPage
      numero="12"
      sezione="Analisi"
      titolo="Cash flow"
      descrizione="Previsione di cassa a 6 mesi."
      vuoto={{
        titolo: "Previsione non ancora disponibile",
        testo: "Servono rate, abbonamenti e movimenti per costruire la previsione.",
      }}
    />
  );
}

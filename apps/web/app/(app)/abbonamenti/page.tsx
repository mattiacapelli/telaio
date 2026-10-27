import { StubPage } from "@/components/domain/stub-page";

export const metadata = { title: "Abbonamenti" };

export default function Page() {
  return (
    <StubPage
      numero="09"
      sezione="Amministrazione"
      titolo="Abbonamenti"
      descrizione="Canoni mensili, trimestrali, semestrali o annuali che generano rate."
      vuoto={{
        titolo: "Nessun abbonamento attivo",
        testo: "Il worker genera le rate in anticipo a partire dagli abbonamenti.",
      }}
    />
  );
}

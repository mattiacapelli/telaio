import { StubPage } from "@/components/domain/stub-page";

export const metadata = { title: "Incassi" };

export default function Page() {
  return (
    <StubPage
      numero="07"
      sezione="Amministrazione"
      titolo="Incassi"
      descrizione="Incassi su bonifico, contanti e carta, legati a una rata, a una fattura o liberi."
      vuoto={{ titolo: "Nessun incasso registrato", testo: "Registra il primo incasso per aggiornare scadenzario e prima nota." }}
    />
  );
}

import { StubPage } from "@/components/domain/stub-page";

export const metadata = { title: "Fatture" };

export default function Page() {
  return (
    <StubPage
      numero="06"
      sezione="Amministrazione"
      titolo="Fatture"
      descrizione="Fatture emesse da preventivo, da rata o libere."
      vuoto={{ titolo: "Nessuna fattura", testo: "Le fatture compariranno qui. La fatturazione elettronica passa da un intermediario: l'interfaccia del servizio è già predisposta." }}
    />
  );
}

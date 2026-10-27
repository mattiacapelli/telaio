import { StubPage } from "@/components/domain/stub-page";

export const metadata = { title: "Scadenzario" };

export default function Page() {
  return (
    <StubPage
      numero="08"
      sezione="Amministrazione"
      titolo="Scadenzario"
      descrizione="Rate da incassare, scadute e solleciti programmati."
      vuoto={{
        titolo: "Nessuna rata in scadenza",
        testo: "Le rate generate dagli abbonamenti e dai preventivi accettati compariranno qui.",
      }}
    />
  );
}

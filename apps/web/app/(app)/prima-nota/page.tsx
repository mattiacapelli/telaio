import { StubPage } from "@/components/domain/stub-page";

export const metadata = { title: "Prima nota" };

export default function Page() {
  return (
    <StubPage
      numero="10"
      sezione="Amministrazione"
      titolo="Prima nota"
      descrizione="Entrate, uscite e giroconti. Nessun collegamento ai conti bancari reali."
      vuoto={{ titolo: "Nessun movimento", testo: "Registra entrate, uscite e giroconti tra i tuoi conti." }}
    />
  );
}

import { StubPage } from "@/components/domain/stub-page";

export const metadata = { title: "Nuova fattura" };

export default function Page() {
  return (
    <StubPage
      numero="06"
      sezione="Amministrazione"
      titolo="Nuova fattura"
      descrizione="Da preventivo, da rata oppure libera."
      vuoto={{
        titolo: "Creazione fattura in arrivo",
        testo: "Potrai scegliere un cliente Twenty, un cliente occasionale o un privato.",
      }}
    />
  );
}

import { StubPage } from "@/components/domain/stub-page";

export const metadata = { title: "Report" };

export default function Page() {
  return (
    <StubPage
      numero="13"
      sezione="Analisi"
      titolo="Report"
      descrizione="Report ed export per il commercialista."
      vuoto={{ titolo: "Nessun report generato", testo: "Qui troverai gli export mensili e annuali per il commercialista." }}
    />
  );
}

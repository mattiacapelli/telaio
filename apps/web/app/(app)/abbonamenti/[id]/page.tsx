import { StubPage } from "@/components/domain/stub-page";

export const metadata = { title: "Dettaglio abbonamento" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <StubPage
      numero="09"
      sezione="Amministrazione"
      titolo="Dettaglio abbonamento"
      descrizione={`Riferimento ${id.slice(0, 8)}`}
      vuoto={{
        titolo: "Pagina di dettaglio in arrivo",
        testo: "Il dettaglio è una pagina a sé, non un pannello laterale.",
      }}
    />
  );
}

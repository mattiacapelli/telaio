import { EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

/** Pagina prevista ma non ancora implementata: stato vuoto curato. */
export function StubPage({
  numero,
  sezione,
  titolo,
  descrizione,
  vuoto,
}: {
  numero?: string;
  sezione: string;
  titolo: string;
  descrizione: string;
  vuoto: { titolo: string; testo: string };
}) {
  return (
    <>
      <PageHeader numero={numero} sezione={sezione} titolo={titolo} descrizione={descrizione} />
      <EmptyState title={vuoto.titolo}>{vuoto.testo}</EmptyState>
    </>
  );
}

import { getDb } from "@telaio/db";
import { ProgettoForm } from "@/components/domain/progetto-form";
import { VALORI_VUOTI } from "@/components/domain/progetto-valori";
import { requireSession } from "@/lib/session";
import { creaProgettoAction } from "../actions";
import { opzioniFormProgetto } from "../dati-form";

export const metadata = { title: "Nuovo progetto" };
export const dynamic = "force-dynamic";

export default async function NuovoProgettoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { user } = await requireSession();
  const { cliente } = await searchParams;
  const opz = await opzioniFormProgetto(getDb(), {
    clienteTwentyId: cliente ?? null,
    preventivoId: null,
  });
  return (
    <ProgettoForm
      azione={creaProgettoAction}
      iniziale={{
        ...VALORI_VUOTI,
        responsabileId: user.id,
        clienteTwentyId: opz.clienti.some((c) => c.id === cliente) ? (cliente ?? "") : "",
      }}
      clienti={opz.clienti}
      preventivi={opz.preventivi}
      utenti={opz.utenti}
      annullaHref="/progetti"
    />
  );
}

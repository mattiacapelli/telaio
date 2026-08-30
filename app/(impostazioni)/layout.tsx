import { redirect } from "next/navigation";
import { leggiSessione } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Le impostazioni occupano lo schermo intero, senza la barra di navigazione
 * principale: sono un contesto separato dal lavoro quotidiano, e la propria
 * navigazione a sezioni sostituisce quella dell'applicazione. Si esce con la
 * X in alto a sinistra.
 */
export default async function ImpostazioniLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessione = await leggiSessione();
  if (!sessione) redirect("/login");

  return <div className="min-h-screen bg-bg text-text">{children}</div>;
}

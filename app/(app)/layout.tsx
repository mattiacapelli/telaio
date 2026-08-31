import { redirect } from "next/navigation";
import { leggiSessione } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { NavMobileProvider } from "@/components/nav-mobile";

export const dynamic = "force-dynamic";

/**
 * Il middleware controlla solo che il cookie ci sia (gira su edge, senza
 * Redis). Qui verifichiamo che la sessione esista davvero: un cookie scaduto
 * o revocato viene respinto prima di renderizzare qualsiasi dato.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessione = await leggiSessione();
  if (!sessione) redirect("/login");

  const impostazioni = await prisma.impostazioni.findUnique({
    where: { id: 1 },
    select: { nomeSpazio: true, inizialeSpazio: true },
  });

  return (
    <NavMobileProvider>
      <div className="flex min-h-screen bg-bg text-text">
        <Sidebar
          nomeStudio={impostazioni?.nomeSpazio}
          inizialeStudio={impostazioni?.inizialeSpazio}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <Topbar utente={sessione.nome} />
          <div className="flex-1 p-3 sm:p-5">{children}</div>
        </main>
      </div>
    </NavMobileProvider>
  );
}

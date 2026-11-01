import { eq, getDb, pendingActions, sql } from "@telaio/db";
import { cookies } from "next/headers";
import { BadgeApp } from "@/components/pwa/badge-app";
import { CommandPalette } from "@/components/shell/command-palette";
import { Header } from "@/components/shell/header";
import { Scorciatoie } from "@/components/shell/scorciatoie";
import { Sidebar } from "@/components/shell/sidebar";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, jar, [coda]] = await Promise.all([
    requireSession(),
    cookies(),
    getDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(pendingActions)
      .where(eq(pendingActions.stato, "in_attesa")),
  ]);
  const utente = { nome: session.user.name, email: session.user.email };
  const inAttesa = coda?.n ?? 0;

  return (
    <div className="flex h-dvh overflow-hidden bg-surface pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
      <Sidebar
        utente={utente}
        inAttesa={inAttesa}
        iniziaCompatta={jar.get("sidebar")?.value === "compatta"}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header utente={utente} inAttesa={inAttesa} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-4 py-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette />
      <Scorciatoie />
      <BadgeApp conteggio={inAttesa} />
    </div>
  );
}

import Link from "next/link";
import { CommandPalette } from "@/components/shell/command-palette";
import { SidebarNav } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { requireSession } from "@/lib/session";
import { LogoutButton } from "./logout-button";

function saluto(ora: number) {
  if (ora < 5) return "Buonanotte";
  if (ora < 13) return "Buongiorno";
  if (ora < 18) return "Buon pomeriggio";
  return "Buonasera";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const adesso = new Date();
  const ora = Number(
    new Intl.DateTimeFormat("it-IT", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/Rome",
    }).format(adesso),
  );
  const data = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Rome",
  }).format(adesso);

  return (
    <div className="min-[860px]:grid min-[860px]:grid-cols-[272px_1fr]">
      <aside className="border-b border-grey-2/60 p-5 min-[860px]:sticky min-[860px]:top-0 min-[860px]:h-dvh min-[860px]:overflow-y-auto min-[860px]:border-r min-[860px]:border-b-0">
        <Link href="/" className="block rounded-2xl focus-visible:outline-offset-4">
          <p className="font-display text-2xl font-semibold tracking-tight">Telaio</p>
          <p className="mt-1 text-sm text-muted">
            {saluto(ora)}, {session.user.name.split(" ")[0]}
          </p>
          <p className="text-xs text-muted first-letter:uppercase">{data}</p>
        </Link>
        <SidebarNav />
        <div className="mt-6">
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
        <Topbar />
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}

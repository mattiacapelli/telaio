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
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Rome",
  }).format(adesso);

  const nome = session.user.name;
  const iniziali = nome
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-[860px]:flex">
      <aside className="flex flex-col gap-6 p-7 min-[860px]:sticky min-[860px]:top-0 min-[860px]:h-dvh min-[860px]:w-[272px] min-[860px]:flex-none min-[860px]:overflow-y-auto min-[860px]:pr-0">
        <Link
          href="/"
          className="glass-pill flex min-h-13 items-center gap-1.5 px-3.5 text-sm font-medium whitespace-nowrap"
        >
          <span>
            {saluto(ora)}, {nome.split(" ")[0]}
          </span>
          <span className="text-[13px] font-normal text-muted">· {data}</span>
        </Link>
        <SidebarNav />
        <div className="mt-auto flex items-center gap-3 pt-2">
          <span
            aria-hidden
            className="grid size-10 flex-none place-items-center rounded-full bg-ink font-display text-sm font-semibold text-paper"
          >
            {iniziali}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{nome}</span>
            <span className="text-xs text-muted">Amministratore</span>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-8 px-7 pt-7 pb-18">
        <Topbar />
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}

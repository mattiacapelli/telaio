import Link from "next/link";
import { CommandPalette } from "@/components/shell/command-palette";
import { SidebarNav } from "@/components/shell/sidebar";
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexWrap: "wrap",
        background:
          "radial-gradient(800px 520px at 95% -8%, #ddd9cf, transparent 70%), radial-gradient(700px 500px at 20% 110%, #e6e2d9, transparent 70%), #f4f3f0",
      }}
    >
      <aside
        className="sb"
        style={{ display: "flex", flexDirection: "column", gap: 24, padding: "28px 0 28px 28px" }}
      >
        <Link href="/" className="glass pill" style={{ fontWeight: 500, fontSize: 15 }}>
          {saluto(ora)}, {nome.split(" ")[0]}{" "}
          <span style={{ color: "#6b675c", fontWeight: 400 }}>· {data}</span>
        </Link>
        <SidebarNav />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: "auto",
            paddingTop: 8,
          }}
        >
          <span
            aria-hidden
            className="d"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#17150f",
              color: "#f4f3f0",
              display: "grid",
              placeItems: "center",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {iniziali}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>{nome}</span>
            <span style={{ fontSize: 12, color: "#6b675c" }}>Amministratore</span>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main
        style={{
          flex: "1 1 0",
          minWidth: 0,
          padding: "28px 28px 72px",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}

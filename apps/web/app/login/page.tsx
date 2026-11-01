import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Accedi" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [chiave: string]: string | string[] | undefined }>;
}) {
  if (await getSession()) redirect("/");
  // Dopo la password, con la verifica in due passaggi attiva, il client rimanda qui con ?2fa=1.
  const inizia2fa = (await searchParams)["2fa"] === "1";
  return (
    <main className="grid min-h-dvh place-items-center bg-subtle px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <img src="/icons/icon-192.png" alt="" width={28} height={28} className="size-7" />
          <span className="text-lg font-semibold tracking-tight">Telaio</span>
        </div>
        <div className="w-full rounded-lg border border-line bg-surface p-6 shadow-xs">
          <LoginForm inizia2fa={inizia2fa} />
        </div>
        <p className="text-xs text-fg-3">© {new Date().getFullYear()} Mattia Capelli</p>
      </div>
    </main>
  );
}

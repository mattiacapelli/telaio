import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { setupCompletato } from "@/lib/setup-server";
import { LoginForm } from "./login-form";

export const metadata = { title: "Accedi" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [chiave: string]: string | string[] | undefined }>;
}) {
  // Installazione nuova: si parte dal wizard. Se il database non risponde si mostra comunque il login.
  if (
    await setupCompletato().then(
      (c) => !c,
      () => false,
    )
  )
    redirect("/setup");
  if (await getSession()) redirect("/");
  const parametri = await searchParams;
  // Dopo la password, con la verifica in due passaggi attiva, il client rimanda qui con ?2fa=1.
  const inizia2fa = parametri["2fa"] === "1";
  const configurazioneCompletata = parametri.setup === "ok";
  // Solo destinazioni previste: mai un indirizzo preso dall'URL.
  const dopoLogin = parametri.dopo === "sicurezza" ? "/impostazioni/sicurezza" : "/";
  return (
    <main className="grid min-h-dvh place-items-center bg-subtle px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <img src="/icons/icon-192.png" alt="" width={28} height={28} className="size-7" />
          <span className="text-lg font-semibold tracking-tight">Telaio</span>
        </div>
        <div className="w-full rounded-lg border border-line bg-surface p-6 shadow-xs">
          {configurazioneCompletata && (
            <p
              role="status"
              className="mb-4 rounded-md bg-ok-soft px-3 py-2 text-sm font-medium text-ok"
            >
              Configurazione completata. Accedi con l'email e la password che hai scelto.
            </p>
          )}
          <LoginForm inizia2fa={inizia2fa} dopoLogin={dopoLogin} />
        </div>
        <p className="text-xs text-fg-3">© {new Date().getFullYear()} Mattia Capelli</p>
      </div>
    </main>
  );
}

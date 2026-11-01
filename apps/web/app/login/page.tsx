import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Accedi" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <main className="grid min-h-dvh place-items-center bg-subtle px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-fg text-sm font-semibold text-white">
            T
          </span>
          <span className="text-lg font-semibold tracking-tight">Telaio</span>
        </div>
        <div className="w-full rounded-lg border border-line bg-surface p-6 shadow-xs">
          <LoginForm />
        </div>
        <p className="text-xs text-fg-3">© {new Date().getFullYear()} Mattia Capelli</p>
      </div>
    </main>
  );
}

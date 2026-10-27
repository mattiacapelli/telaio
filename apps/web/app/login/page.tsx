import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Accedi" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="glass-card w-full max-w-md p-8 sm:p-10">
        <p className="eyebrow">Telaio</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Accedi</h1>
        <p className="mt-2 text-sm text-muted">Il gestionale commerciale. Accesso riservato.</p>
        <LoginForm />
      </div>
    </main>
  );
}

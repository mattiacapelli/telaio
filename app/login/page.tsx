import { redirect } from "next/navigation";
import { leggiSessione } from "@/lib/auth";
import { FormLogin } from "@/components/form-login";
import { titoloPagina } from "@/lib/titolo";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: await titoloPagina("Accedi") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ da?: string }>;
}) {
  const { da } = await searchParams;
  if (await leggiSessione()) redirect(da || "/");

  // Query minimale apposta: questa è una pagina pubblica, niente bisogno dei
  // conteggi che getImpostazioni() calcola per la pagina Impostazioni.
  const imp = await prisma.impostazioni.findUnique({
    where: { id: 1 },
    select: { nomeSpazio: true },
  });
  const nomeSpazio = imp?.nomeSpazio ?? "Telaio";

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[360px]">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-md bg-accent">
            <svg
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="none"
              stroke="var(--accent-fg)"
              strokeWidth="1.6"
            >
              <path d="M2 4h12M2 8h12M2 12h12" />
              <path d="M5.5 2v12M10.5 2v12" opacity=".55" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Telaio</div>
            <div className="text-xs uppercase tracking-wider text-faint">
              {nomeSpazio}
            </div>
          </div>
        </div>

        <FormLogin da={da} />

        <p className="mt-4 text-center text-xs text-faint">
          Accesso riservato. Gli account sono creati dall&apos;amministratore.
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PdfBuilder } from "@/components/pdf-builder/builder";
import { titoloPagina } from "@/lib/titolo";
import type { BloccoPdf } from "@/lib/pdf/blocchi";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await prisma.modelloPdf.findUnique({ where: { id }, select: { nome: true } });
  return { title: await titoloPagina(m?.nome ?? "Modello PDF") };
}

export default async function ModelloPdfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const m = await prisma.modelloPdf.findUnique({ where: { id } });
  if (!m) notFound();

  return (
    <div className="flex h-screen flex-col">
      <div className="flex h-12 flex-none items-center gap-2 border-b border-border bg-surface px-3">
        <Link
          href="/impostazioni?sezione=modelli-pdf"
          title="Chiudi il builder"
          className="grid h-6 w-6 place-items-center rounded text-faint transition-colors hover:bg-[var(--alpha-light)] hover:text-text"
        >
          <X size={15} />
        </Link>
        <span className="text-md font-medium">{m.nome}</span>
        <span className="text-xs text-faint">
          {m.ambito === "PREVENTIVO" ? "Preventivi" : "Contratti"}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <PdfBuilder
          modello={{
            id: m.id,
            nome: m.nome,
            ambito: m.ambito as "PREVENTIVO" | "CONTRATTO",
            blocchi: (m.blocchi as unknown as BloccoPdf[]) ?? [],
          }}
        />
      </div>
    </div>
  );
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leggiSessione } from "@/lib/auth";
import { invalidate } from "@/lib/redis";
import { registraEvento } from "@/lib/eventi";
import { normalizzaRepo } from "@/lib/github";
import { n } from "@/lib/format";

export const dynamic = "force-dynamic";

const Modifica = z.object({
  nome: z.string().min(1, "il nome è obbligatorio"),
  valore: z.coerce.number().nonnegative(),
  budgetOre: z.coerce.number().nonnegative(),
  inizioIl: z.string().optional().nullable(),
  consegnaIl: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  repoGithub: z.string().optional().nullable(),
  branchGithub: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessione = await leggiSessione();
  if (!sessione) {
    return NextResponse.json({ errore: "non autenticato" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = Modifica.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { errore: parsed.error.issues[0]?.message ?? "dati non validi" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const prima = await prisma.progetto.findUnique({ where: { id } });
  if (!prima) {
    return NextResponse.json({ errore: "progetto inesistente" }, { status: 404 });
  }

  // La repo accetta sia `owner/repo` sia l'URL completo; se non è valida
  // rifiutiamo invece di salvare un valore che poi darà 404 a ogni lettura.
  let repo: string | null = null;
  if (d.repoGithub?.trim()) {
    repo = normalizzaRepo(d.repoGithub);
    if (!repo) {
      return NextResponse.json(
        { errore: "repository non valida: usa owner/repo o l'URL di GitHub" },
        { status: 400 },
      );
    }
  }

  await prisma.progetto.update({
    where: { id },
    data: {
      nome: d.nome,
      valore: d.valore,
      budgetOre: d.budgetOre,
      inizioIl: d.inizioIl ? new Date(d.inizioIl) : null,
      consegnaIl: d.consegnaIl ? new Date(d.consegnaIl) : null,
      note: d.note || null,
      repoGithub: repo,
      branchGithub: d.branchGithub?.trim() || null,
    },
  });

  // Annotiamo solo ciò che è cambiato davvero: un diario pieno di righe
  // identiche non serve a nessuno.
  const cambi: string[] = [];
  if (prima.nome !== d.nome) cambi.push(`nome: «${prima.nome}» → «${d.nome}»`);
  if (n(prima.valore) !== d.valore) cambi.push(`valore: ${n(prima.valore)} → ${d.valore}`);
  if (n(prima.budgetOre) !== d.budgetOre)
    cambi.push(`budget ore: ${n(prima.budgetOre)} → ${d.budgetOre}`);
  if ((prima.repoGithub ?? null) !== repo)
    cambi.push(repo ? `repository collegata: ${repo}` : "repository scollegata");

  if (cambi.length) {
    await registraEvento(id, "modifica", "Progetto aggiornato", {
      dettaglio: cambi.join(" · "),
      autore: sessione.email,
    });
  }

  await invalidate();
  return NextResponse.json({ ok: true });
}

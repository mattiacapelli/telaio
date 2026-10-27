import { conti, type Database, isNull, movimenti, sql } from "@telaio/db";
import { z } from "zod";
import { reData } from "../date";

export const registraMovimentoSchema = z
  .object({
    tipo: z.enum(["entrata", "uscita", "giroconto"]),
    data: z.string().regex(reData, "Data non valida"),
    importoCent: z.number().int().positive("L'importo deve essere maggiore di zero"),
    contoId: z.uuid("Scegli il conto"),
    contoDestinazioneId: z.uuid().nullish(),
    categoria: z.string().trim().nullish(),
    descrizione: z.string().trim().nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.tipo !== "giroconto") return;
    if (!v.contoDestinazioneId)
      ctx.addIssue({
        code: "custom",
        path: ["contoDestinazioneId"],
        message: "Scegli il conto di destinazione",
      });
    else if (v.contoDestinazioneId === v.contoId)
      ctx.addIssue({
        code: "custom",
        path: ["contoDestinazioneId"],
        message: "I due conti devono essere diversi",
      });
  });

export async function registraMovimento(
  db: Database,
  input: z.infer<typeof registraMovimentoSchema>,
) {
  const d = registraMovimentoSchema.parse(input);
  await db.insert(movimenti).values({
    tipo: d.tipo,
    data: d.data,
    importoCent: d.importoCent,
    contoId: d.contoId,
    contoDestinazioneId: d.tipo === "giroconto" ? d.contoDestinazioneId : null,
    categoria: d.categoria || null,
    descrizione: d.descrizione || null,
  });
}

/** Saldo per conto = saldo iniziale + entrate − uscite − giroconti in uscita + giroconti in entrata. */
export async function saldiConti(db: Database) {
  const righe = await db.execute<{ id: string; saldo: number }>(sql`
    select c.id,
      (c.saldo_iniziale_cent
        + coalesce(sum(m.importo_cent) filter (where m.tipo = 'entrata'), 0)
        - coalesce(sum(m.importo_cent) filter (where m.tipo = 'uscita'), 0)
        - coalesce(sum(m.importo_cent) filter (where m.tipo = 'giroconto'), 0)
        + coalesce((select sum(g.importo_cent) from movimenti g
                    where g.conto_destinazione_id = c.id and g.tipo = 'giroconto' and g.deleted_at is null), 0)
      )::int as saldo
    from ${conti} c
    left join ${movimenti} m on m.conto_id = c.id and m.deleted_at is null
    group by c.id
  `);
  return new Map(righe.map((r) => [r.id, Number(r.saldo)]));
}

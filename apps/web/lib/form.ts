import { parseEuro } from "@telaio/core";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";

/** Testo opzionale: stringa vuota → null. */
export const testoOpt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

/** "12,50" → 1250 centesimi; vuoto → 0. */
export const euroCent = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return 0;
    const v = parseEuro(s);
    if (v === null || v < 0) {
      ctx.addIssue({ code: "custom", message: "Importo non valido" });
      return z.NEVER;
    }
    return v;
  });

/** "22" o "22,5" → 2200 / 2250 punti base; vuoto → null. */
export const percentualeBp = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return null;
    const n = Number(s.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      ctx.addIssue({ code: "custom", message: "Percentuale non valida (0–100)" });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

export const flag = z
  .string()
  .optional()
  .transform((v) => v === "on");

export function leggi<S extends z.ZodType>(
  schema: S,
  data: FormData,
): { ok: true; data: z.infer<S> } | { ok: false; state: ActionState } {
  const grezzo: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const chiave of new Set(data.keys())) {
    const valori = data.getAll(chiave);
    grezzo[chiave] = valori.length > 1 || chiave.endsWith("[]") ? valori : (valori[0] ?? "");
  }
  const r = schema.safeParse(grezzo);
  if (r.success) return { ok: true, data: r.data };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) errors[String(issue.path[0] ?? "_")] ??= issue.message;
  return { ok: false, state: { ok: false, errors, message: "Controlla i campi evidenziati" } };
}

"use server";

import { formatoValido } from "@telaio/core";
import { and, apiKeys, eq, getDb, impostazioni, listinoBasi, listinoModuli, listini, moduloBasi, ragioniSociali } from "@telaio/db";
import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { ActionState } from "@/components/ui/form-modal";
import { audit } from "@/lib/audit";
import { euroCent, flag, leggi, percentualeBp, testoOpt } from "@/lib/form";
import { requireSession } from "@/lib/session";

const ok: ActionState = { ok: true };
const refresh = () => revalidatePath("/", "layout");

// ── Ragioni sociali ──────────────────────────────────────────────────────────

const ragioneSocialeSchema = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(1, "Il nome è obbligatorio"),
  tipo: z.enum(["ditta_individuale", "srl", "associazione", "altro"]),
  partitaIva: testoOpt,
  codiceFiscale: testoOpt,
  indirizzo: testoOpt,
  cap: testoOpt,
  citta: testoOpt,
  provincia: testoOpt,
  email: testoOpt,
  pec: testoOpt,
  codiceSdi: testoOpt,
  iban: testoOpt,
  formatoPreventivo: z.string().trim().refine(formatoValido, "Serve almeno un token {N} o {NNN}"),
  formatoFattura: z.string().trim().refine(formatoValido, "Serve almeno un token {N} o {NNN}"),
});

export async function salvaRagioneSociale(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(ragioneSocialeSchema, form);
  if (!r.ok) return r.state;
  const { id, ...valori } = r.data;
  const db = getDb();
  if (id) {
    await db.update(ragioniSociali).set(valori).where(eq(ragioniSociali.id, id));
    await audit(db, { userId: user.id, azione: "ragione_sociale.modificata", entita: "ragioni_sociali", entitaId: id });
  } else {
    const [nuova] = await db.insert(ragioniSociali).values(valori).returning({ id: ragioniSociali.id });
    await audit(db, { userId: user.id, azione: "ragione_sociale.creata", entita: "ragioni_sociali", entitaId: nuova?.id });
  }
  refresh();
  return ok;
}

export async function archiviaRagioneSociale(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const id = String(form.get("id") ?? "");
  const db = getDb();
  await db.update(ragioniSociali).set({ deletedAt: new Date() }).where(eq(ragioniSociali.id, id));
  await audit(db, { userId: user.id, azione: "ragione_sociale.archiviata", entita: "ragioni_sociali", entitaId: id });
  refresh();
  return ok;
}

const regoleSchema = z
  .object({
    id: z.string().min(1),
    ivaAttiva: flag,
    aliquota: percentualeBp,
    naturaSenzaIva: testoOpt,
    diciturSenzaIva: testoOpt,
    bolloAutomatico: flag,
    ritenuta: percentualeBp,
    splitPayment: flag,
    contoPredefinitoId: testoOpt,
  })
  .superRefine((v, ctx) => {
    if (v.ivaAttiva && v.aliquota === null) ctx.addIssue({ code: "custom", path: ["aliquota"], message: "Indica l'aliquota" });
    if (!v.ivaAttiva && !v.naturaSenzaIva) ctx.addIssue({ code: "custom", path: ["naturaSenzaIva"], message: "Indica la natura (es. N2.2, N4)" });
    if (!v.ivaAttiva && !v.diciturSenzaIva) ctx.addIssue({ code: "custom", path: ["diciturSenzaIva"], message: "Indica la dicitura di legge" });
  });

export async function salvaRegoleFiscali(_: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireSession();
  const r = leggi(regoleSchema, form);
  if (!r.ok) return r.state;
  const v = r.data;
  const db = getDb();
  await db
    .update(ragioniSociali)
    .set({
      ivaAttiva: v.ivaAttiva,
      aliquotaIvaBp: v.ivaAttiva ? (v.aliquota ?? 2200) : 0,
      naturaSenzaIva: v.ivaAttiva ? null : v.naturaSenzaIva,
      diciturSenzaIva: v.ivaAttiva ? null : v.diciturSenzaIva,
      bolloAutomatico: v.ivaAttiva ? false : v.bolloAutomatico,
      ritenutaBp: v.ritenuta && v.ritenuta > 0 ? v.ritenuta : null,
      splitPayment: v.splitPayment,
      contoPredefinitoId: v.contoPredefinitoId,
    })
    .where(eq(ragioniSociali.id, v.id));
  await audit(db, { userId: user.id, azione: "regole_fiscali.modificate", entita: "ragioni_sociali", entitaId: v.id });
  refresh();
  return ok;
}

// ── Listini ──────────────────────────────────────────────────────────────────

export async function salvaListino(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const r = leggi(
    z.object({ id: z.string().optional(), ragioneSocialeId: z.uuid("Scegli la ragione sociale"), nome: z.string().trim().min(1, "Il nome è obbligatorio"), descrizione: testoOpt }),
    form,
  );
  if (!r.ok) return r.state;
  const { id, ...valori } = r.data;
  const db = getDb();
  if (id) await db.update(listini).set({ nome: valori.nome, descrizione: valori.descrizione }).where(eq(listini.id, id));
  else await db.insert(listini).values(valori);
  refresh();
  return ok;
}

const voceSchema = z.object({
  id: z.string().optional(),
  listinoId: z.uuid(),
  nome: z.string().trim().min(1, "Il nome è obbligatorio"),
  descrizione: testoOpt,
  unaTantumCent: euroCent,
  canoneAnnuoCent: euroCent,
  canoneMensileCent: euroCent,
  "baseIds[]": z.array(z.string()).optional(),
});

export async function salvaBase(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const r = leggi(voceSchema, form);
  if (!r.ok) return r.state;
  const { id, "baseIds[]": _b, ...valori } = r.data;
  const db = getDb();
  if (id) await db.update(listinoBasi).set(valori).where(eq(listinoBasi.id, id));
  else await db.insert(listinoBasi).values(valori);
  refresh();
  return ok;
}

export async function salvaModulo(_: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const r = leggi(voceSchema, form);
  if (!r.ok) return r.state;
  const { id, "baseIds[]": baseIds = [], ...valori } = r.data;
  const db = getDb();
  await db.transaction(async (tx) => {
    let moduloId = id;
    if (id) await tx.update(listinoModuli).set(valori).where(eq(listinoModuli.id, id));
    else moduloId = (await tx.insert(listinoModuli).values(valori).returning({ id: listinoModuli.id }))[0]?.id;
    if (!moduloId) throw new Error("Salvataggio modulo fallito");
    if (id || baseIds.length > 0) {
      await tx.delete(moduloBasi).where(eq(moduloBasi.moduloId, moduloId));
      // Solo basi dello stesso listino
      const valide = await tx.select({ id: listinoBasi.id }).from(listinoBasi).where(eq(listinoBasi.listinoId, valori.listinoId));
      const ammesse = baseIds.filter((b) => valide.some((x) => x.id === b));
      if (ammesse.length > 0) await tx.insert(moduloBasi).values(ammesse.map((baseId) => ({ moduloId: moduloId as string, baseId })));
    }
  });
  refresh();
  return ok;
}

export async function archiviaVoce(form: FormData): Promise<void> {
  await requireSession();
  const id = String(form.get("id"));
  const tabella = form.get("tipo") === "base" ? listinoBasi : listinoModuli;
  await getDb().update(tabella).set({ deletedAt: new Date() }).where(eq(tabella.id, id));
  refresh();
}

/** Assegna o toglie un modulo a una base (matrice di compatibilità). */
export async function toggleAssegnazione(form: FormData): Promise<void> {
  await requireSession();
  const moduloId = String(form.get("moduloId"));
  const baseId = String(form.get("baseId"));
  const db = getDb();
  const [esiste] = await db.select().from(moduloBasi).where(and(eq(moduloBasi.moduloId, moduloId), eq(moduloBasi.baseId, baseId)));
  if (esiste) await db.delete(moduloBasi).where(and(eq(moduloBasi.moduloId, moduloId), eq(moduloBasi.baseId, baseId)));
  else await db.insert(moduloBasi).values({ moduloId, baseId });
  refresh();
}

// ── MCP e API ────────────────────────────────────────────────────────────────

export async function impostaStrumentoMcp(form: FormData): Promise<void> {
  await requireSession();
  const nome = String(form.get("nome"));
  const attivo = form.get("attivo") === "true";
  const db = getDb();
  const [corrente] = await db.select().from(impostazioni).where(eq(impostazioni.chiave, "mcp.strumenti"));
  const valore = { ...((corrente?.valore as Record<string, boolean>) ?? {}), [nome]: attivo };
  await db
    .insert(impostazioni)
    .values({ chiave: "mcp.strumenti", valore })
    .onConflictDoUpdate({ target: impostazioni.chiave, set: { valore, updatedAt: new Date() } });
  refresh();
}

export interface ChiaveCreata extends ActionState {
  chiave?: string;
}

/** La chiave in chiaro si mostra una sola volta: nel DB resta solo l'hash SHA-256. */
export async function creaChiaveApi(_: ActionState, form: FormData): Promise<ChiaveCreata> {
  const { user } = await requireSession();
  const r = leggi(
    z.object({
      nome: z.string().trim().min(1, "Dai un nome alla chiave"),
      permessi: z.enum(["lettura", "lettura_scrittura"]),
      "scopes[]": z.array(z.enum(["api", "mcp"])).min(1, "Scegli almeno un ambito"),
    }),
    form,
  );
  if (!r.ok) return r.state;
  const chiave = `tlk_${randomBytes(32).toString("base64url")}`;
  const db = getDb();
  await db.insert(apiKeys).values({
    nome: r.data.nome,
    permessi: r.data.permessi,
    scopes: r.data["scopes[]"],
    prefisso: chiave.slice(0, 11),
    hash: createHash("sha256").update(chiave).digest("hex"),
    createdBy: user.id,
  });
  await audit(db, { userId: user.id, azione: "api_key.creata", entita: "api_keys" });
  refresh();
  return { ok: true, chiave };
}

export async function revocaChiaveApi(form: FormData): Promise<void> {
  const { user } = await requireSession();
  const id = String(form.get("id"));
  const db = getDb();
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
  await audit(db, { userId: user.id, azione: "api_key.revocata", entita: "api_keys", entitaId: id });
  refresh();
}


import { calcolaTotali, importoRiga, type RegoleFiscali } from "@telaio/core";
import {
  and,
  asc,
  assegnaNumero,
  clientiRef,
  type Database,
  eq,
  fatturaRighe,
  fatture,
  isNull,
  preventivi,
  preventivoRighe,
  ragioniSociali,
  rate,
} from "@telaio/db";
import { z } from "zod";
import { dataValida, oggi } from "../date";
import { regoleDa } from "../regole";
import { emettiEvento } from "../webhooks";

export const GIORNI_SCADENZA_DEFAULT = 30;

function aggiungiGiorni(data: string, giorni: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

function totaliFattura(
  righe: { quantita: number; prezzoUnitarioCent: number; scontoBp: number }[],
  regole: RegoleFiscali,
) {
  const t = calcolaTotali(righe, regole);
  return {
    imponibileCent: t.imponibileCent,
    ivaCent: t.ivaCent,
    bolloCent: t.bolloCent,
    totaleCent: t.totaleCent,
    ritenutaCent: t.ritenutaCent,
    ivaSplitCent: t.ivaSplitCent,
    nettoDaPagareCent: t.nettoDaPagareCent,
  };
}

// La fattura da preventivo (solo righe una tantum accettate) vive in @telaio/db, dove la si testa su Postgres.
export { creaFatturaDaPreventivo } from "@telaio/db";

export interface NuovaFatturaLibera {
  ragioneSocialeId: string;
  /** cliente già presente in anagrafica; in alternativa `occasionale` */
  clienteRefId: string | null;
  occasionale: {
    nome: string;
    partitaIva: string | null;
    codiceFiscale: string | null;
    indirizzo: string | null;
    sdiPec: string | null;
    privato: boolean;
  } | null;
  note: string | null;
  righe: { descrizione: string; quantita: number; prezzoUnitarioCent: number; scontoBp: number }[];
}

/**
 * Bozza di fattura non legata a un preventivo. Il cliente è uno dell'anagrafica oppure
 * occasionale/privato: in quel caso i dati vivono solo nello snapshot della fattura.
 */
export async function creaFatturaLibera(
  db: Database,
  dati: NuovaFatturaLibera,
): Promise<{ id: string }> {
  if (dati.righe.length === 0) throw new Error("Aggiungi almeno una riga");
  if (!dati.clienteRefId && !dati.occasionale) throw new Error("Indica il cliente");
  return db.transaction(async (tx) => {
    const [rs] = await tx
      .select()
      .from(ragioniSociali)
      .where(and(eq(ragioniSociali.id, dati.ragioneSocialeId), isNull(ragioniSociali.deletedAt)));
    if (!rs) throw new Error("Ragione sociale non trovata");

    let cliente: Record<string, unknown> = { ...dati.occasionale };
    if (dati.clienteRefId) {
      const [c] = await tx.select().from(clientiRef).where(eq(clientiRef.id, dati.clienteRefId));
      if (!c) throw new Error("Cliente non trovato");
      cliente = {
        nome: c.nome,
        partitaIva: c.partitaIva,
        codiceFiscale: c.codiceFiscale,
        pec: c.pec,
        codiceSdi: c.codiceSdi,
      };
    }

    const regole = regoleDa(rs);
    const [f] = await tx
      .insert(fatture)
      .values({
        ragioneSocialeId: rs.id,
        clienteRefId: dati.clienteRefId,
        origine: "libera",
        anno: new Date().getFullYear(),
        note: dati.note,
        snapshot: {
          emittente: { id: rs.id, nome: rs.nome },
          cliente,
          regole: { ...regole },
        },
        ...totaliFattura(dati.righe, regole),
      })
      .returning({ id: fatture.id });
    if (!f) throw new Error("Creazione fattura fallita");
    await tx.insert(fatturaRighe).values(
      dati.righe.map((r, i) => ({
        fatturaId: f.id,
        posizione: i,
        ...r,
        importoCent: importoRiga(r),
      })),
    );
    return f;
  });
}

/**
 * Emette la fattura: assegna il numero in modo atomico, congela emittente e regole IVA
 * del momento, ricalcola i totali e crea la rata che finisce nello scadenzario.
 */
export async function emettiFattura(
  db: Database,
  id: string,
  giorniScadenza = GIORNI_SCADENZA_DEFAULT,
  dataEmissione = oggi(),
) {
  if (!dataValida(dataEmissione)) throw new Error("Data di emissione non valida");
  const esito = await emettiFatturaInTransazione(db, id, giorniScadenza, dataEmissione);
  await emettiEvento(db, "fattura.emessa", {
    fatturaId: id,
    numero: esito.numero,
    totaleCent: esito.totaleCent,
  });
  return { numero: esito.numero };
}

async function emettiFatturaInTransazione(
  db: Database,
  id: string,
  giorniScadenza: number,
  dataEmissione: string,
) {
  return db.transaction(async (tx) => {
    const [f] = await tx
      .select()
      .from(fatture)
      .where(and(eq(fatture.id, id), isNull(fatture.deletedAt)))
      .for("update");
    if (!f) throw new Error("Fattura non trovata");
    if (f.stato !== "bozza") throw new Error("La fattura è già stata emessa");
    const [rs] = await tx
      .select()
      .from(ragioniSociali)
      .where(eq(ragioniSociali.id, f.ragioneSocialeId));
    if (!rs) throw new Error("Ragione sociale non trovata");

    const righe = await tx.select().from(fatturaRighe).where(eq(fatturaRighe.fatturaId, id));
    const regole = regoleDa(rs);
    const scadenza = aggiungiGiorni(dataEmissione, giorniScadenza);
    const { numero } = await assegnaNumero(tx, {
      ragioneSocialeId: rs.id,
      tipo: "fattura",
      anno: Number(dataEmissione.slice(0, 4)),
      formato: rs.formatoFattura,
    });
    const totali = totaliFattura(righe, regole);

    await tx
      .update(fatture)
      .set({
        numero,
        anno: Number(dataEmissione.slice(0, 4)),
        stato: "emessa",
        dataEmissione,
        scadenza,
        snapshot: {
          ...f.snapshot,
          emittente: {
            id: rs.id,
            nome: rs.nome,
            partitaIva: rs.partitaIva,
            codiceFiscale: rs.codiceFiscale,
            indirizzo: rs.indirizzo,
            citta: rs.citta,
          },
          regole: { ...regole },
        },
        ...totali,
      })
      .where(eq(fatture.id, id));

    const [r] = await tx
      .insert(rate)
      .values({
        ragioneSocialeId: rs.id,
        clienteRefId: f.clienteRefId,
        fatturaId: id,
        numero: 1,
        descrizione: `Fattura ${numero}`,
        scadenza,
        importoCent: totali.nettoDaPagareCent,
      })
      .returning({ id: rate.id });
    if (r) await tx.update(fatture).set({ rataId: r.id }).where(eq(fatture.id, id));
    return { numero, totaleCent: totali.totaleCent };
  });
}

/**
 * Cambia data di emissione e scadenza di una fattura emessa. L'anno resta quello del numero
 * (la numerazione è progressiva per anno) e una fattura già inviata allo SDI non si tocca.
 * La scadenza si riflette sulla rata dello scadenzario.
 */
export async function modificaDateFattura(
  db: Database,
  id: string,
  input: { dataEmissione: string; scadenza: string },
) {
  const { dataEmissione, scadenza } = input;
  if (!dataValida(dataEmissione)) throw new Error("Data di emissione non valida");
  if (!dataValida(scadenza)) throw new Error("Scadenza non valida");
  if (scadenza < dataEmissione) throw new Error("La scadenza non può precedere l'emissione");
  await db.transaction(async (tx) => {
    const [f] = await tx
      .select()
      .from(fatture)
      .where(and(eq(fatture.id, id), isNull(fatture.deletedAt)))
      .for("update");
    if (!f) throw new Error("Fattura non trovata");
    if (f.stato === "bozza")
      throw new Error("La data di emissione si sceglie emettendo la fattura");
    if (f.sdiIdentificativo || ["inviata_sdi", "consegnata", "scartata"].includes(f.stato))
      throw new Error("La fattura è già passata dallo SDI: le date non si modificano");
    if (Number(dataEmissione.slice(0, 4)) !== f.anno)
      throw new Error(
        `La data deve restare nel ${f.anno}: il numero ${f.numero} appartiene a quell'anno`,
      );
    await tx.update(fatture).set({ dataEmissione, scadenza }).where(eq(fatture.id, id));
    if (f.rataId) {
      const [r] = await tx.select().from(rate).where(eq(rate.id, f.rataId)).for("update");
      if (r && r.stato !== "annullata") {
        const aperta = r.stato === "da_incassare" || r.stato === "scaduta";
        await tx
          .update(rate)
          .set({
            scadenza,
            ...(aperta && { stato: scadenza < oggi() ? "scaduta" : "da_incassare" }),
          })
          .where(eq(rate.id, r.id));
      }
    }
  });
}

export const fatturaBozzaModificaSchema = z
  .object({
    clienteRefId: z.uuid().optional(),
    cliente: z
      .object({
        nome: z.string().trim().min(1),
        partitaIva: z.string().nullish(),
        codiceFiscale: z.string().nullish(),
        indirizzo: z.string().nullish(),
        sdiPec: z.string().nullish(),
        privato: z.boolean().optional(),
      })
      .optional(),
    note: z.string().trim().max(2000).nullish(),
    righe: z
      .array(
        z.object({
          descrizione: z.string().trim().min(1),
          quantita: z.number().int().min(1).default(1),
          prezzoUnitarioCent: z.number().int().min(0),
          scontoBp: z.number().int().min(0).max(10000).default(0),
        }),
      )
      .min(1, "Aggiungi almeno una riga")
      .optional(),
  })
  .refine(
    (v) => !(v.clienteRefId && v.cliente),
    "Indica un cliente dell'anagrafica oppure uno occasionale, non entrambi",
  );

/** Modifica una bozza di fattura: cliente, note e righe (che si sostituiscono per intero). Totali ricalcolati. */
export async function modificaFatturaBozza(db: Database, id: string, input: unknown) {
  const dati = fatturaBozzaModificaSchema.parse(input);
  if (Object.keys(dati).length === 0) throw new Error("Nessun campo da modificare");
  await db.transaction(async (tx) => {
    const [f] = await tx
      .select()
      .from(fatture)
      .where(and(eq(fatture.id, id), isNull(fatture.deletedAt)))
      .for("update");
    if (!f) throw new Error("Fattura non trovata");
    if (f.stato !== "bozza") throw new Error("Si può modificare solo una fattura in bozza");

    let snapshot = f.snapshot;
    let clienteRefId = f.clienteRefId;
    if (dati.clienteRefId) {
      const [c] = await tx.select().from(clientiRef).where(eq(clientiRef.id, dati.clienteRefId));
      if (!c) throw new Error("Cliente non trovato");
      clienteRefId = c.id;
      snapshot = {
        ...snapshot,
        cliente: {
          nome: c.nome,
          partitaIva: c.partitaIva,
          codiceFiscale: c.codiceFiscale,
          pec: c.pec,
          codiceSdi: c.codiceSdi,
        },
      };
    } else if (dati.cliente) {
      clienteRefId = null;
      snapshot = { ...snapshot, cliente: { ...dati.cliente } };
    }

    const regole = snapshot.regole as unknown as RegoleFiscali;
    await tx
      .update(fatture)
      .set({
        clienteRefId,
        snapshot,
        ...(dati.note !== undefined && { note: dati.note || null }),
        ...(dati.righe && totaliFattura(dati.righe, regole)),
      })
      .where(eq(fatture.id, id));
    if (dati.righe) {
      await tx.delete(fatturaRighe).where(eq(fatturaRighe.fatturaId, id));
      await tx.insert(fatturaRighe).values(
        dati.righe.map((r, i) => ({
          fatturaId: id,
          posizione: i,
          ...r,
          importoCent: importoRiga(r),
        })),
      );
    }
  });
  return { id };
}

/** Si elimina solo una bozza: una fattura emessa ha numero e rata, e non sparisce. */
export async function eliminaFatturaBozza(db: Database, id: string) {
  await db.transaction(async (tx) => {
    const [f] = await tx
      .select()
      .from(fatture)
      .where(and(eq(fatture.id, id), isNull(fatture.deletedAt)))
      .for("update");
    if (!f) throw new Error("Fattura non trovata");
    if (f.stato !== "bozza") throw new Error("Si può eliminare solo una fattura in bozza");
    await tx.update(fatture).set({ deletedAt: new Date() }).where(eq(fatture.id, id));
  });
  return { id, eliminata: true };
}

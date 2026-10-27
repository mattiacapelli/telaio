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
import { oggi } from "../date";
import { regoleDa } from "../regole";

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

/** Bozza di fattura dalle righe una tantum di un preventivo accettato. */
export async function creaFatturaDaPreventivo(
  db: Database,
  preventivoId: string,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(preventivi)
      .where(and(eq(preventivi.id, preventivoId), isNull(preventivi.deletedAt)));
    if (!p) throw new Error("Preventivo non trovato");
    if (p.stato !== "accettato") throw new Error("Si può fatturare solo un preventivo accettato");
    const [esistente] = await tx
      .select({ id: fatture.id })
      .from(fatture)
      .where(and(eq(fatture.preventivoId, p.id), isNull(fatture.deletedAt)));
    if (esistente) throw new Error("Questo preventivo ha già una fattura");

    const righe = (
      await tx
        .select()
        .from(preventivoRighe)
        .where(eq(preventivoRighe.preventivoId, p.id))
        .orderBy(asc(preventivoRighe.posizione))
    ).filter((r) => r.tipo === "una_tantum");
    if (righe.length === 0) throw new Error("Il preventivo non ha righe una tantum da fatturare");

    const regole = p.snapshot.regole as unknown as RegoleFiscali;
    const [f] = await tx
      .insert(fatture)
      .values({
        ragioneSocialeId: p.ragioneSocialeId,
        clienteRefId: p.clienteRefId,
        origine: "preventivo",
        preventivoId: p.id,
        anno: new Date().getFullYear(),
        snapshot: p.snapshot,
        ...totaliFattura(righe, regole),
      })
      .returning({ id: fatture.id });
    if (!f) throw new Error("Creazione fattura fallita");
    await tx.insert(fatturaRighe).values(
      righe.map((r, i) => ({
        fatturaId: f.id,
        posizione: i,
        descrizione: r.descrizione,
        quantita: r.quantita,
        prezzoUnitarioCent: r.prezzoUnitarioCent,
        scontoBp: r.scontoBp,
        importoCent: importoRiga(r),
      })),
    );
    return f;
  });
}

export interface NuovaFatturaLibera {
  ragioneSocialeId: string;
  /** cliente già presente in anagrafica; in alternativa `occasionale` */
  clienteRefId: string | null;
  occasionale: {
    nome: string;
    partitaIva: string | null;
    codiceFiscale: string | null;
    indirizzo: string | null;
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
    const dataEmissione = oggi();
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
    return { numero };
  });
}

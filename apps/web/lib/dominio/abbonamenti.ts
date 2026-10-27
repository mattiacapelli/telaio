import { abbonamenti, and, type Database, eq, generaRateAbbonamenti, gt, rate } from "@telaio/db";
import { emettiEvento } from "../webhooks";

export interface NuovoAbbonamento {
  ragioneSocialeId: string;
  clienteRefId: string;
  descrizione: string;
  periodicita: "mensile" | "trimestrale" | "semestrale" | "annuale";
  importoRataCent: number;
  inizio: string;
  fine: string | null;
}

export async function creaAbbonamento(db: Database, dati: NuovoAbbonamento) {
  if (dati.importoRataCent <= 0)
    throw new Error("L'importo della rata deve essere maggiore di zero");
  if (dati.fine && dati.fine < dati.inizio) throw new Error("La fine non può precedere l'inizio");
  const [ab] = await db.insert(abbonamenti).values(dati).returning();
  if (!ab) throw new Error("Abbonamento non creato");
  await generaRateAbbonamenti(db, { abbonamentoId: ab.id });
  await emettiEvento(db, "abbonamento.creato", {
    abbonamentoId: ab.id,
    descrizione: ab.descrizione,
  });
  return ab;
}

/**
 * Sospende, riattiva o cessa un abbonamento. Sospendendo o cessando si annullano le rate
 * future ancora da incassare (quelle già pagate o scadute restano). Riattivando il job
 * (o questa funzione) rigenera le rate mancanti.
 */
export async function cambiaStatoAbbonamento(
  db: Database,
  id: string,
  stato: "attivo" | "sospeso" | "cessato",
  dataOggi: string,
) {
  const [ab] = await db
    .update(abbonamenti)
    .set({ stato })
    .where(eq(abbonamenti.id, id))
    .returning();
  if (!ab) throw new Error("Abbonamento non trovato");
  if (stato === "attivo") {
    // le rate annullate da una sospensione tornano da incassare, poi si completano le mancanti
    await db
      .update(rate)
      .set({ stato: "da_incassare" })
      .where(and(eq(rate.abbonamentoId, id), eq(rate.stato, "annullata")));
    await generaRateAbbonamenti(db, { abbonamentoId: id, dataOggi });
  } else {
    await db
      .update(rate)
      .set({ stato: "annullata" })
      .where(
        and(
          eq(rate.abbonamentoId, id),
          eq(rate.stato, "da_incassare"),
          gt(rate.scadenza, dataOggi),
        ),
      );
  }
  return ab;
}

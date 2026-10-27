import type { RegoleFiscali } from "@telaio/core";
import { formattaNumero } from "@telaio/core";
import { clientiRef, conti, getDb, isNull, listinoBasi, ragioniSociali } from "@telaio/db";
import { NuovaFatturaForm } from "@/components/domain/nuova-fattura-form";
import { regoleDa } from "@/lib/regole";

export const metadata = { title: "Fattura libera" };
export const dynamic = "force-dynamic";

export default async function NuovaFatturaPage() {
  const db = getDb();
  const [emittenti, clienti, contiAttivi, voci] = await Promise.all([
    db.select().from(ragioniSociali).where(isNull(ragioniSociali.deletedAt)),
    db
      .select({ id: clientiRef.id, nome: clientiRef.nome })
      .from(clientiRef)
      .where(isNull(clientiRef.deletedAt))
      .orderBy(clientiRef.nome),
    db
      .select({ id: conti.id, nome: conti.nome, ragioneSocialeId: conti.ragioneSocialeId })
      .from(conti)
      .where(isNull(conti.deletedAt)),
    db
      .select({ id: listinoBasi.id, nome: listinoBasi.nome, prezzoCent: listinoBasi.unaTantumCent })
      .from(listinoBasi)
      .where(isNull(listinoBasi.deletedAt)),
  ]);

  return (
    <NuovaFatturaForm
      emittenti={emittenti.map((e) => ({
        id: e.id,
        nome: e.nome,
        sezionale: formattaNumero(e.formatoFattura, 1, new Date().getFullYear()),
        regole: regoleDa(e) satisfies RegoleFiscali,
      }))}
      clienti={clienti}
      conti={contiAttivi}
      voci={voci.filter((v) => v.prezzoCent > 0)}
    />
  );
}

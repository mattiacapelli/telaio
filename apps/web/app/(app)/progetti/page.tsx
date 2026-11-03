import { ETICHETTE_CATEGORIA } from "@telaio/core";
import { clientiRef, desc, eq, getDb, isNull, progetti, users } from "@telaio/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { STATO_PROGETTO } from "@/lib/stati";
import { ProgettiTabella, type RigaProgetto } from "./progetti-tabella";

export const metadata = { title: "Progetti" };
export const dynamic = "force-dynamic";

export default async function ProgettiPage() {
  const tutti = await getDb()
    .select({ p: progetti, cliente: clientiRef.nome, responsabile: users.name })
    .from(progetti)
    .leftJoin(clientiRef, eq(clientiRef.id, progetti.clienteRefId))
    .leftJoin(users, eq(users.id, progetti.responsabileId))
    .where(isNull(progetti.deletedAt))
    .orderBy(desc(progetti.updatedAt))
    .limit(500);

  const righe: RigaProgetto[] = tutti.map(({ p, cliente, responsabile }) => ({
    id: p.id,
    codice: p.codice,
    nome: p.nome,
    cliente,
    categoria: p.categoria,
    etichettaCategoria: ETICHETTE_CATEGORIA[p.categoria],
    responsabile,
    stato: p.stato,
    priorita: p.priorita,
    aggiornato: p.updatedAt.toISOString(),
  }));
  const clienti = [...new Set(righe.map((r) => r.cliente).filter((c): c is string => !!c))].sort(
    (a, b) => a.localeCompare(b, "it"),
  );
  const categorie = Object.entries(ETICHETTE_CATEGORIA).map(([valore, etichetta]) => ({
    valore,
    etichetta,
  }));

  return (
    <>
      <PageHeader
        titolo="Progetti"
        descrizione="Le commesse e i lavori da realizzare per i clienti, anche a partire da un preventivo accettato."
        azioni={
          <Button asChild>
            <Link href="/progetti/nuovo">Nuovo progetto</Link>
          </Button>
        }
      />
      <StatsRow
        dati={Object.entries(STATO_PROGETTO).map(([stato, v]) => ({
          etichetta: v.label,
          valore: righe.filter((r) => r.stato === stato).length,
        }))}
      />
      <ProgettiTabella righe={righe} clienti={clienti} categorie={categorie} />
    </>
  );
}

import { clientiRef, getDb, isNull, preventivi, rate, sql } from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ClientiTabella } from "./clienti-tabella";

export const metadata = { title: "Clienti" };
export const dynamic = "force-dynamic";

type Relazione = "cliente" | "prospect";
const FILTRI: { id: Relazione | "tutti"; label: string }[] = [
  { id: "tutti", label: "Tutti" },
  { id: "cliente", label: "Clienti" },
  { id: "prospect", label: "Prospect" },
];

export default async function ClientiPage() {
  const twenty = twentyDaEnv();
  const db = getDb();
  let errore: string | null = null;
  const [tutti, opportunita, locali] = await Promise.all([
    twenty.elencaClienti({ limite: 500 }).catch((e: Error) => {
      errore = e.message;
      return [];
    }),
    twenty.elencaOpportunita().catch(() => []),
    db
      .select({
        twentyId: clientiRef.twentyCompanyId,
        prev: sql<number>`(select count(*)::int from ${preventivi} p where p.cliente_ref_id = ${clientiRef.id} and p.deleted_at is null)`,
        fatture: sql<number>`(select count(*)::int from fatture f where f.cliente_ref_id = ${clientiRef.id} and f.deleted_at is null and f.stato <> 'bozza')`,
        abb: sql<number>`(select count(*)::int from abbonamenti a where a.cliente_ref_id = ${clientiRef.id} and a.deleted_at is null)`,
        daIncassare: sql<number>`coalesce((select sum(r.importo_cent - coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = r.id and i.deleted_at is null),0)) from ${rate} r where r.cliente_ref_id = ${clientiRef.id} and r.stato in ('da_incassare','parziale','scaduta')),0)::int`,
      })
      .from(clientiRef)
      .where(isNull(clientiRef.deletedAt)),
  ]);

  const perTwenty = new Map(locali.map((l) => [l.twentyId, l]));
  const righe = tutti.map((c) => {
    const l = perTwenty.get(c.id);
    return {
      id: c.id,
      nome: c.nome,
      citta: c.citta,
      pa: c.pa,
      piva: c.partitaIva ?? c.codiceFiscale,
      relazione: (l && (l.fatture > 0 || l.abb > 0) ? "cliente" : "prospect") as
        | "cliente"
        | "prospect",
      opportunita: (() => {
        const o = opportunita.find((x) => x.companyId === c.id);
        return o
          ? `${o.nome}${o.fase ? ` · ${o.fase.toLowerCase().replace(/_/g, " ")}` : ""}`
          : null;
      })(),
      preventivi: l?.prev ?? 0,
      daIncassareCent: l?.daIncassare ?? 0,
    };
  });

  return (
    <>
      <PageHeader
        titolo="Clienti"
        descrizione="Anagrafiche, contatti e opportunità arrivano da Twenty. Qui trovi la parte economica: preventivi, incassi e saldi."
        azioni={
          <>
            {twenty.finto ? (
              <Badge variant="warn" dot>
                Dati finti · imposta TWENTY_API_URL
              </Badge>
            ) : (
              <Badge variant="ok" dot>
                Twenty collegato
              </Badge>
            )}
            <Button asChild>
              <Link href="/preventivi/nuovo">Nuovo preventivo</Link>
            </Button>
          </>
        }
      />
      {errore && (
        <p
          role="alert"
          className="rounded-md border border-bad/20 bg-bad-soft px-3 py-2 text-sm text-bad"
        >
          Twenty non risponde: {errore}
        </p>
      )}
      <ClientiTabella righe={righe} />
    </>
  );
}

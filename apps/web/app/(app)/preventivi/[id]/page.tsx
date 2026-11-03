import {
  formatAliquota,
  formatEuro,
  formattaNumero,
  prezzoVisualizzato,
  type RegoleFiscali,
  type StatoPreventivo,
  transizioniPreventivo,
} from "@telaio/core";
import {
  asc,
  eq,
  getDb,
  preventivi,
  preventivoRighe,
  progettiDelPreventivo,
  ragioniSociali,
} from "@telaio/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { creaFatturaDaPreventivoAction } from "@/app/(app)/fatture/actions";
import { CreaProgettoDaPreventivo } from "@/app/(app)/progetti/crea-da-preventivo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DefList } from "@/components/ui/def-list";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { formatData } from "@/lib/date";
import { STATO_PREVENTIVO, STATO_PROGETTO } from "@/lib/stati";
import { cambiaStatoPreventivoAction } from "./actions";

export const metadata = { title: "Preventivo" };
export const dynamic = "force-dynamic";

const AZIONE_STATO: Record<string, string> = {
  inviato: "Segna come inviato",
  in_revisione: "Metti in revisione",
  accettato: "Segna come accettato",
  rifiutato: "Segna come rifiutato",
  scaduto: "Segna come scaduto",
};
const TIPO = {
  una_tantum: "Una tantum",
  canone_annuo: "Canone annuo",
  canone_mensile: "Canone mensile",
} as const;

export default async function PreventivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [p] = await db.select().from(preventivi).where(eq(preventivi.id, id));
  if (!p) notFound();
  const [righe, [rs], progettiCollegati] = await Promise.all([
    db
      .select()
      .from(preventivoRighe)
      .where(eq(preventivoRighe.preventivoId, id))
      .orderBy(asc(preventivoRighe.posizione)),
    db.select().from(ragioniSociali).where(eq(ragioniSociali.id, p.ragioneSocialeId)),
    progettiDelPreventivo(db, id),
  ]);

  const regole = p.snapshot.regole as unknown as RegoleFiscali;
  const cliente = p.snapshot.cliente as {
    nome?: string;
    partitaIva?: string;
    codiceSdi?: string;
    citta?: string;
  };
  const stato = STATO_PREVENTIVO[p.stato];
  const somma = (t: keyof typeof TIPO) =>
    righe.filter((r) => r.tipo === t).reduce((s, r) => s + r.importoCent, 0);
  const canoneAnno = somma("canone_annuo") + somma("canone_mensile") * 12;
  const cAnno = prezzoVisualizzato(canoneAnno, regole);
  const primoNetto = p.imponibileCent + canoneAnno;
  const primoLordo = p.totaleCent + (cAnno.lordoCent ?? canoneAnno);
  const iva = regole.ivaAttiva ? `IVA ${formatAliquota(regole.aliquotaIvaBp)}` : "Senza IVA";
  const transizioni = transizioniPreventivo(p.stato as StatoPreventivo);

  return (
    <>
      <PageHeader
        titolo={p.numero ?? "Preventivo in bozza"}
        descrizione={p.oggetto}
        stato={<Tag tone={stato?.tone}>{stato?.label ?? p.stato}</Tag>}
        azioni={
          <>
            <Button asChild variant="secondary">
              <a href={`/api/pdf/preventivi/${p.id}`}>Scarica PDF</a>
            </Button>
            {transizioni.map((nuovo) => (
              <form key={nuovo} action={cambiaStatoPreventivoAction}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="stato" value={nuovo} />
                <Button
                  type="submit"
                  variant={nuovo === "rifiutato" || nuovo === "scaduto" ? "secondary" : "primary"}
                >
                  {AZIONE_STATO[nuovo]}
                </Button>
              </form>
            ))}
            {p.stato === "accettato" && (
              <CreaProgettoDaPreventivo preventivoId={p.id} nomeIniziale={p.oggetto} />
            )}
            {p.stato === "accettato" && (
              <form action={creaFatturaDaPreventivoAction}>
                <input type="hidden" name="preventivoId" value={p.id} />
                <Button type="submit">Converti in fattura</Button>
              </form>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader title="Emittente" />
              <DefList
                voci={[
                  {
                    etichetta: "Ragione sociale",
                    valore: (p.snapshot.emittente as { nome?: string }).nome ?? "—",
                  },
                  {
                    etichetta: "Tipo",
                    valore: rs
                      ? rs.tipo.charAt(0).toUpperCase() + rs.tipo.slice(1).replace(/_/g, " ")
                      : "—",
                  },
                  {
                    etichetta: "Numerazione",
                    valore: rs ? `es. ${formattaNumero(rs.formatoPreventivo, 1, p.anno)}` : "—",
                  },
                  { etichetta: "IVA", valore: iva },
                ]}
              />
            </Card>
            <Card>
              <CardHeader title="Cliente" description="Da Twenty" />
              <DefList
                voci={[
                  { etichetta: "Azienda", valore: cliente.nome ?? "da assegnare" },
                  { etichetta: "P.IVA", valore: cliente.partitaIva ?? "—", numerico: true },
                  { etichetta: "Codice SDI", valore: cliente.codiceSdi ?? "—", numerico: true },
                  { etichetta: "Sede", valore: cliente.citta ?? "—" },
                ]}
              />
            </Card>
          </div>

          <Table minLarghezza={600}>
            <thead>
              <tr>
                <Th>Voce</Th>
                <Th>Tipo</Th>
                <Th destra>Una tantum</Th>
                <Th destra>Canone/anno</Th>
                <Th destra>Canone/mese</Th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => {
                const v = prezzoVisualizzato(r.importoCent, regole);
                const cella = (attiva: boolean) =>
                  attiva ? (
                    <div className="flex flex-col items-end leading-tight">
                      <span className="font-medium">{formatEuro(r.importoCent)}</span>
                      {v.lordoCent !== null && (
                        <span className="text-xs text-fg-3">{formatEuro(v.lordoCent)} ivato</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-fg-3">—</span>
                  );
                return (
                  <tr key={r.id} className="group">
                    <Td className="font-medium">{r.descrizione}</Td>
                    <Td className="text-fg-2">{TIPO[r.tipo]}</Td>
                    <Td destra>{cella(r.tipo === "una_tantum")}</Td>
                    <Td destra>{cella(r.tipo === "canone_annuo")}</Td>
                    <Td destra>{cella(r.tipo === "canone_mensile")}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Riepilogo" description={iva} />
            <DefList
              voci={[
                {
                  etichetta: "Una tantum netto",
                  valore: formatEuro(p.imponibileCent),
                  numerico: true,
                },
                ...(regole.ivaAttiva
                  ? [{ etichetta: iva, valore: formatEuro(p.ivaCent), numerico: true }]
                  : []),
                ...(p.bolloCent > 0
                  ? [
                      {
                        etichetta: "Marca da bollo",
                        valore: formatEuro(p.bolloCent),
                        numerico: true,
                      },
                    ]
                  : []),
                {
                  etichetta: "Totale una tantum",
                  valore: <b className="text-base">{formatEuro(p.totaleCent)}</b>,
                  numerico: true,
                },
                ...(canoneAnno > 0
                  ? [
                      {
                        etichetta: "Canone annuo netto",
                        valore: formatEuro(canoneAnno),
                        numerico: true,
                      },
                    ]
                  : []),
                ...(cAnno.lordoCent !== null && canoneAnno > 0
                  ? [
                      {
                        etichetta: "Canone annuo IVA inclusa",
                        valore: formatEuro(cAnno.lordoCent),
                        numerico: true,
                      },
                    ]
                  : []),
              ]}
            />
            <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-fg-2">Primo anno netto</span>
                <b className="font-semibold tabular-nums">{formatEuro(primoNetto)}</b>
              </div>
              {regole.ivaAttiva && (
                <div className="flex justify-between text-sm">
                  <span className="text-fg-2">Primo anno IVA inclusa</span>
                  <b className="font-semibold tabular-nums">{formatEuro(primoLordo)}</b>
                </div>
              )}
            </div>
            {!regole.ivaAttiva && regole.diciturSenzaIva && (
              <p className="mt-3 text-xs text-fg-2">{regole.diciturSenzaIva}</p>
            )}
          </Card>
          {progettiCollegati.length > 0 && (
            <Card>
              <CardHeader
                title="Progetti"
                description={`${progettiCollegati.length} ${progettiCollegati.length === 1 ? "progetto collegato" : "progetti collegati"}`}
              />
              <ul className="divide-y divide-line text-sm">
                {progettiCollegati.map((pr) => (
                  <li key={pr.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/progetti/${pr.id}`} className="min-w-0 truncate hover:underline">
                      <span className="font-medium tabular-nums">{pr.codice}</span> · {pr.nome}
                    </Link>
                    <Badge variant={STATO_PROGETTO[pr.stato]?.variante} dot>
                      {STATO_PROGETTO[pr.stato]?.label}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader title="Dettagli" />
            <DefList
              voci={[
                {
                  etichetta: "Creato il",
                  valore: formatData(p.createdAt.toISOString()),
                  numerico: true,
                },
                { etichetta: "Valido fino al", valore: formatData(p.validoFino), numerico: true },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

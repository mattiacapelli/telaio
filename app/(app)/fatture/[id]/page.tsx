import Link from "next/link";
import { notFound } from "next/navigation";
import { getFatturaCompleta } from "@/lib/queries";
import { titoloPagina, nomeRecord } from "@/lib/titolo";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Chip, coloreDa } from "@/components/chip";
import { SezioneCampi, CampoRecord } from "@/components/record/pannello";
import { EliminaRecord } from "@/components/elimina-record";
import { RegistraIncasso, EliminaIncasso } from "@/components/registra-incasso";
import { Button } from "@/components/ui/button";
import { eur, data, dataEstesa } from "@/lib/format";
import { Building2, Calendar, Tag, Receipt, Wallet, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const nome = await nomeRecord("fattura", id);
  return { title: await titoloPagina(nome ?? "Fattura") };
}

const STATI: Record<string, string> = {
  DA_EMETTERE: "Da emettere",
  EMESSA: "Emessa",
  PAGATA: "Pagata",
  SCADUTA: "Scaduta",
};

const METODI: Record<string, string> = {
  BONIFICO: "Bonifico",
  CARTA: "Carta",
  CONTANTI: "Contanti",
  ALTRO: "Altro",
};

export default async function FatturaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [f, conti] = await Promise.all([
    getFatturaCompleta(id),
    prisma.contoIncasso.findMany({
      where: { eliminataIl: null },
      orderBy: [{ predefinito: "desc" }, { ordine: "asc" }, { nome: "asc" }],
      select: { id: true, nome: true, predefinito: true },
    }),
  ]);
  if (!f) notFound();

  const daIncassare = (f.stato === "EMESSA" || f.stato === "SCADUTA") && f.residuo > 0.01;

  return (
    <div className="tl-in flex flex-col overflow-hidden rounded border border-border md:h-[calc(100vh-96px)] md:flex-row">
      <aside className="flex w-full flex-none flex-col overflow-y-auto border-b border-border bg-surface md:w-[300px] md:border-b-0 md:border-r">
        <div className="flex flex-col items-center gap-2 px-3 py-5">
          <div
            className="grid h-12 w-12 place-items-center rounded-md text-md font-semibold"
            style={{ background: `${coloreDa(f.numero)}26`, color: coloreDa(f.numero) }}
          >
            <Receipt size={18} />
          </div>
          <div className="text-center">
            <h1 className="text-md font-semibold">{f.numero}</h1>
            <div className="mt-0.5 text-xs text-faint">{f.cliente.ragioneSociale}</div>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            <Badge tono={f.stato === "SCADUTA" ? "attenzione" : f.stato === "PAGATA" ? "accento" : "neutro"}>
              {STATI[f.stato]}
            </Badge>
          </div>
          <div className="mt-2 flex flex-col items-center gap-1.5">
            {daIncassare && (
              <RegistraIncasso
                fatture={[{ id: f.id, numero: f.numero, cliente: f.cliente.ragioneSociale, residuo: f.residuo }]}
                conti={conti}
                fatturaFissa={{ id: f.id, numero: f.numero, cliente: f.cliente.ragioneSociale, residuo: f.residuo }}
                trigger={<Button size="sm"><Plus /> Registra incasso</Button>}
              />
            )}
            {f.stato === "DA_EMETTERE" && (
              <EliminaRecord entita="fattura" id={f.id} nome={f.numero} dopoRedirect="/fatture" />
            )}
          </div>
        </div>

        <div className="px-3 pb-1 text-md font-medium">Campi</div>

        <SezioneCampi titolo="Generale">
          <CampoRecord icona={<Building2 size={12} />} etichetta="Cliente">
            <Link href={`/clienti/${f.cliente.id}`} className="flex items-center gap-1.5 hover:underline">
              <Chip testo={f.cliente.ragioneSociale} />
              <span className="truncate">{f.cliente.ragioneSociale}</span>
            </Link>
          </CampoRecord>
          <CampoRecord icona={<Building2 size={12} />} etichetta="Ragione sociale emittente" vuoto="Predefinita">
            {f.azienda?.ragioneSociale}
          </CampoRecord>
          <CampoRecord icona={<Tag size={12} />} etichetta="Aliquota IVA">
            {f.aliquotaIva}%
          </CampoRecord>
        </SezioneCampi>

        <SezioneCampi titolo="Date">
          <CampoRecord icona={<Calendar size={12} />} etichetta="Creata il">
            {dataEstesa(f.createdAt)}
          </CampoRecord>
          <CampoRecord icona={<Calendar size={12} />} etichetta="Emessa il" vuoto="Non ancora emessa">
            {f.emessaIl && dataEstesa(f.emessaIl)}
          </CampoRecord>
          <CampoRecord icona={<Calendar size={12} />} etichetta="Scadenza" vuoto="Nessuna">
            {f.scadeIl && dataEstesa(f.scadeIl)}
          </CampoRecord>
        </SezioneCampi>

        <SezioneCampi titolo="Economia">
          <CampoRecord icona={<Wallet size={12} />} etichetta="Imponibile">
            {eur(f.imponibile)}
          </CampoRecord>
          <CampoRecord icona={<Wallet size={12} />} etichetta="Incassato">
            {eur(f.incassato)}
          </CampoRecord>
          <CampoRecord icona={<Wallet size={12} />} etichetta="Residuo">
            {eur(f.residuo)}
          </CampoRecord>
        </SezioneCampi>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto bg-bg p-4">
        <div>
          <div className="mb-1.5 text-md font-medium">Righe</div>
          <div className="rounded border border-border">
            <div className="grid grid-cols-[1fr_80px_100px_100px] gap-2 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-faint">
              <span>Descrizione</span>
              <span className="text-right">Quantità</span>
              <span className="text-right">Prezzo</span>
              <span className="text-right">Totale</span>
            </div>
            {f.righe.length === 0 ? (
              <div className="px-3 py-6 text-center text-md text-faint">Nessuna riga.</div>
            ) : (
              f.righe.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1fr_80px_100px_100px] items-center gap-2 border-b border-border px-3 py-2 text-md last:border-0"
                >
                  <span className="min-w-0 truncate">{r.descrizione}</span>
                  <span className="text-right text-muted">{r.quantita}</span>
                  <span className="text-right text-muted">{eur(r.prezzo)}</span>
                  <span className="text-right font-medium">{eur(r.totale)}</span>
                </div>
              ))
            )}
            <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2 text-md">
              <span className="text-muted">Imponibile</span>
              <span className="font-semibold">{eur(f.imponibile)}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-md font-medium">Incassi</div>
          <div className="rounded border border-border">
            {f.incassi.length === 0 ? (
              <div className="px-3 py-6 text-center text-md text-faint">Nessun incasso registrato.</div>
            ) : (
              f.incassi.map((i) => (
                <div
                  key={i.id}
                  className="group flex items-center gap-2 border-b border-border px-3 py-2 text-md last:border-0"
                >
                  <span className="text-muted">{data(i.data)}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {METODI[i.metodo]}
                    {(i.conto || i.nota) && ` · ${[i.conto, i.nota].filter(Boolean).join(" · ")}`}
                  </span>
                  <span className="font-medium">{eur(i.importo)}</span>
                  <EliminaIncasso id={i.id} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

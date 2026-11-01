import { Inbox, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type VarianteBadge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Checkbox, Field, Input, SearchInput, Select, Textarea } from "@/components/ui/field";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Interattivo } from "./interattivo";

export const metadata = { title: "Design system" };

const BADGE: VarianteBadge[] = ["neutral", "brand", "ok", "warn", "bad", "solid"];
const COLORI = [
  ["surface", "bg-surface"],
  ["subtle", "bg-subtle"],
  ["hover", "bg-hover"],
  ["line", "bg-line"],
  ["fg", "bg-fg"],
  ["fg-2", "bg-fg-2"],
  ["fg-3", "bg-fg-3"],
  ["brand", "bg-brand"],
  ["ok", "bg-ok"],
  ["warn", "bg-warn"],
  ["bad", "bg-bad"],
];

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-fg">{titolo}</h2>
      {children}
    </section>
  );
}

/** Pagina di riferimento dei componenti: serve a vederli insieme e a controllarli a ogni modifica. */
export default function DesignSystemPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Design system</h1>
        <p className="text-sm text-fg-2">Token e componenti di Telaio.</p>
      </header>

      <Sezione titolo="Colori">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {COLORI.map(([n, c]) => (
            <div key={n} className="flex flex-col gap-1.5">
              <div className={`h-10 rounded-md border border-line ${c}`} />
              <span className="text-xs text-fg-2">{n}</span>
            </div>
          ))}
        </div>
      </Sezione>

      <Sezione titolo="Tipografia">
        <Card className="flex flex-col gap-1">
          <p className="text-2xl font-semibold tracking-tight">Titolo di pagina · 24</p>
          <p className="text-xl font-semibold tracking-tight">Titolo di sezione · 20</p>
          <p className="text-base font-semibold">Titolo di card · 14</p>
          <p className="text-base">
            Testo normale, 14 px: la lettura principale dell&apos;interfaccia.
          </p>
          <p className="text-sm text-fg-2">Testo secondario e tabelle, 13 px.</p>
          <p className="text-xs text-fg-3">Note e metadati, 12 px.</p>
        </Card>
      </Sezione>

      <Sezione titolo="Pulsanti">
        <div className="flex flex-wrap items-center gap-2">
          <Button>
            <Plus /> Principale
          </Button>
          <Button variant="secondary">Secondario</Button>
          <Button variant="ghost">Discreto</Button>
          <Button variant="danger">Elimina</Button>
          <Button disabled>Disabilitato</Button>
          <Button size="sm">Piccolo</Button>
        </div>
      </Sezione>

      <Sezione titolo="Campi">
        <Card className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <Input placeholder="Mario Rossi" />
          </Field>
          <Field label="Con errore" error="Campo obbligatorio">
            <Input />
          </Field>
          <Field label="Tipo" hint="Scegli una voce">
            <Select defaultValue="b">
              <option value="a">Conto corrente</option>
              <option value="b">Cassa contanti</option>
            </Select>
          </Field>
          <Field label="Cerca">
            <SearchInput placeholder="Nome, P.IVA…" />
          </Field>
          <Field label="Note" className="sm:col-span-2">
            <Textarea />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox defaultChecked /> Ricordami
          </label>
        </Card>
      </Sezione>

      <Sezione titolo="Badge">
        <div className="flex flex-wrap gap-2">
          {BADGE.map((v) => (
            <Badge key={v} variant={v} dot>
              {v}
            </Badge>
          ))}
        </div>
      </Sezione>

      <Sezione titolo="Menu, modali, notifiche, schede">
        <Interattivo />
      </Sezione>

      <Sezione titolo="Avatar e percorso">
        <div className="flex items-center gap-3">
          <Avatar name="Mattia Capelli" size="sm" />
          <Avatar name="Mattia Capelli" />
          <Avatar name="Mattia Capelli" size="lg" />
          <Breadcrumb
            voci={[
              { label: "Clienti", href: "/clienti" },
              { label: "Bar Centrale", href: "/clienti" },
              { label: "Preventivo" },
            ]}
          />
        </div>
      </Sezione>

      <Sezione titolo="Card, stato vuoto e caricamento">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader
              title="Incassi del mese"
              description="Ottobre 2026"
              action={
                <Button size="sm" variant="secondary">
                  Apri
                </Button>
              }
            />
            <p className="text-2xl font-semibold tabular-nums">€ 7.212,00</p>
          </Card>
          <Card className="p-0">
            <EmptyState
              title="Niente da mostrare"
              action={
                <Button size="sm">
                  <Inbox /> Crea il primo
                </Button>
              }
            >
              Quando ci saranno dati li troverai qui.
            </EmptyState>
          </Card>
          <Card className="sm:col-span-2">
            <Skeleton className="mb-3 h-5 w-40" />
            <TableSkeleton righe={3} colonne={4} />
          </Card>
        </div>
      </Sezione>
    </div>
  );
}

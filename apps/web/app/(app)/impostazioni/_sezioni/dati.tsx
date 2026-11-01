import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DefList } from "@/components/ui/def-list";

/** Backup automatico del database ed export dei dati contabili. */
export function SezioneDati({ anno }: { anno: number }) {
  return (
    <>
      <Card>
        <CardHeader title="Backup del database" />
        <p className="mb-3 max-w-prose text-sm text-fg-2">
          Il worker salva ogni notte alle 02:30 (fuso Europe/Rome) un dump del database in formato{" "}
          <code className="font-mono text-xs">pg_dump</code> custom, ripristinabile con{" "}
          <code className="font-mono text-xs">pg_restore</code>, e tiene gli ultimi file.
        </p>
        <DefList
          voci={[
            {
              etichetta: "Cartella",
              valore: <span className="font-mono text-xs">BACKUP_DIR (default ./backups)</span>,
            },
            {
              etichetta: "File conservati",
              valore: <span className="font-mono text-xs">BACKUP_KEEP (default 14)</span>,
            },
            {
              etichetta: "Subito",
              valore: (
                <span className="font-mono text-xs">pnpm --filter @telaio/worker job backup</span>
              ),
            },
          ]}
        />
      </Card>
      <Card>
        <CardHeader
          title="Export dei dati"
          description="File CSV (separatore «;», importi con la virgola) pronti per Excel o per il commercialista."
        />
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["fatture", "anno", `Fatture emesse ${anno}`],
              ["prima-nota", "anno", `Prima nota ${anno}`],
              ["fatture", "trimestre", "Fatture del trimestre"],
              ["prima-nota", "mese", "Prima nota del mese"],
            ] as const
          ).map(([tipo, p, l]) => (
            <Button key={`${tipo}-${p}`} asChild variant="secondary" size="sm">
              <a href={`/api/export/commercialista?tipo=${tipo}&p=${p}`}>{l} ↓</a>
            </Button>
          ))}
        </div>
      </Card>
    </>
  );
}

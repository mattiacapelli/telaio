import { st } from "@/lib/utils";

/** Backup automatico del database ed export dei dati contabili. */
export function SezioneDati({ anno }: { anno: number }) {
  return (
    <div style={st("display:flex;flex-direction:column;gap:20px")}>
      <div className="card" style={st("display:flex;flex-direction:column;gap:12px")}>
        <h2 className="h2">Backup del database</h2>
        <p className="lead">
          Il worker salva ogni notte alle 02:30 (fuso Europe/Rome) un dump del database in formato{" "}
          <code>pg_dump</code> custom, ripristinabile con <code>pg_restore</code>, e tiene gli
          ultimi file.
        </p>
        <dl style={st("margin:0;border-top:1px solid rgba(23,21,15,.14)")}>
          <div className="kv">
            <dt>Cartella</dt>
            <dd className="mono">BACKUP_DIR (default ./backups)</dd>
          </div>
          <div className="kv">
            <dt>File conservati</dt>
            <dd className="mono">BACKUP_KEEP (default 14)</dd>
          </div>
          <div className="kv" style={{ borderBottom: 0 }}>
            <dt>Subito</dt>
            <dd className="mono">pnpm --filter @telaio/worker job backup</dd>
          </div>
        </dl>
      </div>
      <div className="card" style={st("display:flex;flex-direction:column;gap:12px")}>
        <h2 className="h2">Export dei dati</h2>
        <p className="lead">
          File CSV (separatore «;», importi con la virgola) pronti per Excel o per il
          commercialista.
        </p>
        <div style={st("display:flex;flex-wrap:wrap;gap:10px")}>
          {(
            [
              ["fatture", "anno", `Fatture emesse ${anno}`],
              ["prima-nota", "anno", `Prima nota ${anno}`],
              ["fatture", "trimestre", "Fatture del trimestre"],
              ["prima-nota", "mese", "Prima nota del mese"],
            ] as const
          ).map(([tipo, p, l]) => (
            <a
              key={`${tipo}-${p}`}
              href={`/api/export/commercialista?tipo=${tipo}&p=${p}`}
              className="bg sm"
            >
              {l} ↓
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

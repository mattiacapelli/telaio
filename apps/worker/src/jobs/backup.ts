import { spawn } from "node:child_process";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * Backup del database con `pg_dump` (formato custom, ripristinabile con `pg_restore`).
 * Salva in BACKUP_DIR (default ./backups) e tiene gli ultimi BACKUP_KEEP file (default 14).
 */
export async function backupDatabase(ora = new Date()) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL non impostata");
  const cartella = process.env.BACKUP_DIR ?? "./backups";
  const tieni = Number(process.env.BACKUP_KEEP ?? 14);
  const comando = process.env.BACKUP_PG_DUMP ?? "pg_dump";
  await mkdir(cartella, { recursive: true });

  const marca = ora.toISOString().replace(/[-:]/g, "").slice(0, 13).replace("T", "-");
  const file = join(cartella, `telaio-${marca}.dump`);
  await new Promise<void>((risolvi, rifiuta) => {
    const proc = spawn(comando, ["--format=custom", `--file=${file}`, url], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let err = "";
    proc.stderr.on("data", (d) => {
      err += String(d);
    });
    proc.on("error", (e) =>
      rifiuta(
        new Error(
          `Impossibile eseguire ${comando}: ${e.message}. Installa il client PostgreSQL o imposta BACKUP_PG_DUMP.`,
        ),
      ),
    );
    proc.on("close", (codice) =>
      codice === 0
        ? risolvi()
        : rifiuta(new Error(`pg_dump è uscito con codice ${codice}: ${err.trim()}`)),
    );
  });

  const esistenti = (await readdir(cartella)).filter((f) => /^telaio-.*\.dump$/.test(f)).sort();
  const daEliminare = esistenti.slice(0, Math.max(0, esistenti.length - tieni));
  for (const f of daEliminare) await rm(join(cartella, f));
  const { size } = await stat(file);
  return { file, byte: size, eliminati: daEliminare.length };
}

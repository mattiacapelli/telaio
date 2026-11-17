#!/usr/bin/env bash
# Verifica o ripristina un backup di PostgreSQL.
#   deploy/restore.sh --verifica   <file.dump|file.dump.age>   prova il ripristino in un database temporaneo
#   deploy/restore.sh --ripristina <file.dump|file.dump.age>   SOSTITUISCE il database reale
# Per i file .age serve BACKUP_AGE_IDENTITY=/percorso/chiave-privata-age.
set -euo pipefail
# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

MODO="${1:-}"
ARCHIVIO="${2:-}"
[[ "$MODO" == "--verifica" || "$MODO" == "--ripristina" ]] || errore "uso: deploy/restore.sh --verifica|--ripristina <file>"
[[ -f "$ARCHIVIO" ]] || errore "file non trovato: $ARCHIVIO"

TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT

# Checksum, se accanto al dump c'è il suo .sha256.
if [[ -f "$ARCHIVIO.sha256" ]]; then
  passo "Controllo il checksum"
  (cd "$(dirname "$ARCHIVIO")" && sha256 -c "$(basename "$ARCHIVIO").sha256")
else
  echo "Nessun .sha256 accanto al file: salto il controllo del checksum." >&2
fi

DUMP="$ARCHIVIO"
if [[ "$ARCHIVIO" == *.age ]]; then
  [[ -n "${BACKUP_AGE_IDENTITY:-}" && -f "$BACKUP_AGE_IDENTITY" ]] || errore "imposta BACKUP_AGE_IDENTITY con la chiave privata age"
  command -v age >/dev/null || errore "age non installato"
  passo "Decifro il backup"
  DUMP="$TEMP/ripristino.dump"
  age -d -i "$BACKUP_AGE_IDENTITY" -o "$DUMP" "$ARCHIVIO"
fi

psql_admin() { pg psql -U "$PG_ADMIN" -d postgres -v ON_ERROR_STOP=1 "$@"; }

if [[ "$MODO" == "--verifica" ]]; then
  DB="telaio_verifica_$(date +%s)"
  passo "Ripristino in un database temporaneo ($DB): i dati reali non vengono toccati"
  psql_admin -c "CREATE DATABASE \"$DB\" OWNER \"$PG_UTENTE\"" >/dev/null
  trap 'psql_admin -c "DROP DATABASE IF EXISTS \"$DB\"" >/dev/null 2>&1 || true; rm -rf "$TEMP"' EXIT
  pg pg_restore -U "$PG_UTENTE" -d "$DB" --no-owner --exit-on-error < "$DUMP"
  TABELLE="$(pg psql -U "$PG_UTENTE" -d "$DB" -tA -c "select count(*) from information_schema.tables where table_schema='public'")"
  UTENTI="$(pg psql -U "$PG_UTENTE" -d "$DB" -tA -c "select count(*) from users")"
  MIGRAZIONI="$(pg psql -U "$PG_UTENTE" -d "$DB" -tA -c "select count(*) from drizzle.__drizzle_migrations")"
  echo "tabelle: $TABELLE · utenti: $UTENTI · migrazioni applicate: $MIGRAZIONI"
  [[ "$TABELLE" -gt 0 && "$MIGRAZIONI" -gt 0 ]] || errore "il backup si ripristina ma è vuoto o incompleto"
  passo "Backup verificato: si ripristina senza errori"
  exit 0
fi

echo "ATTENZIONE: il database di produzione verrà SOSTITUITO con il contenuto di:"
echo "  $ARCHIVIO"
read -r -p "Scrivi RIPRISTINA per continuare: " CONFERMA
[[ "$CONFERMA" == "RIPRISTINA" ]] || errore "annullato"

passo "Copia di sicurezza dello stato attuale"
"$RADICE/deploy/backup.sh" --prima-del-ripristino

passo "Fermo web e worker"
compose stop web worker

passo "Ricreo il database e ripristino"
psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='telaio' AND pid <> pg_backend_pid()" >/dev/null
psql_admin -c "DROP DATABASE telaio" -c "CREATE DATABASE telaio OWNER \"$PG_UTENTE\""
pg pg_restore -U "$PG_UTENTE" -d telaio --no-owner --exit-on-error < "$DUMP"

passo "Allineo le migrazioni e riavvio"
compose run --rm migrate
compose up -d --wait --wait-timeout 180
passo "Ripristino completato"

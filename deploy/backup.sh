#!/usr/bin/env bash
# Backup di PostgreSQL: dump compresso, controllo, checksum, retention e copia offsite cifrata (opzionali).
# Uso: deploy/backup.sh [--prima-del-deploy | --prima-del-ripristino]
# Configurazione (in .env.production): BACKUP_DIR, BACKUP_KEEP_DAYS, BACKUP_AGE_RECIPIENT,
# BACKUP_RCLONE_REMOTE oppure BACKUP_RSYNC_TARGET. Un backup che resta solo sul VPS non basta:
# configura sempre la copia offsite.
set -euo pipefail
# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

ETICHETTA=""
case "${1:-}" in
  --prima-del-deploy) ETICHETTA="-prima-del-deploy" ;;
  --prima-del-ripristino) ETICHETTA="-prima-del-ripristino" ;;
  "") ;;
  *) errore "opzione sconosciuta: $1" ;;
esac

DESTINAZIONE="$(leggi BACKUP_DIR /var/backups/telaio)"
GIORNI="$(leggi BACKUP_KEEP_DAYS 14)"
AGE="$(leggi BACKUP_AGE_RECIPIENT)"
RCLONE="$(leggi BACKUP_RCLONE_REMOTE)"
RSYNC="$(leggi BACKUP_RSYNC_TARGET)"
MARCA="$(date +%Y%m%d-%H%M%S)"
FILE="$DESTINAZIONE/telaio-${MARCA}${ETICHETTA}.dump"

mkdir -p "$DESTINAZIONE"
chmod 700 "$DESTINAZIONE"
umask 077

passo "Dump di PostgreSQL → $FILE"
# Formato custom: già compresso (zlib), consistente (una sola transazione) e ripristinabile con pg_restore.
if ! compose exec -T postgres pg_dump -U telaio -d telaio --format=custom --compress=6 > "$FILE.parziale"; then
  rm -f "$FILE.parziale"
  errore "pg_dump fallito"
fi
mv "$FILE.parziale" "$FILE"

# L'archivio deve essere leggibile e non vuoto.
compose exec -T postgres pg_restore --list < "$FILE" > /dev/null || { rm -f "$FILE"; errore "il dump non è valido"; }
(cd "$DESTINAZIONE" && sha256 "$(basename "$FILE")" > "$(basename "$FILE").sha256")
echo "$(du -h "$FILE" | cut -f1)  $(cut -c1-16 "$FILE.sha256")…"

# Retention: oltre KEEP_DAYS giorni, ma almeno 3 copie restano sempre.
passo "Retention (${GIORNI} giorni, minimo 3 copie)"
RIMOSSI=0
while IFS= read -r vecchio; do
  rm -f "$vecchio" "$vecchio.sha256" "$vecchio.age" "$vecchio.age.sha256"
  RIMOSSI=$((RIMOSSI + 1))
# shellcheck disable=SC2012  # nomi generati da questo script (telaio-AAAAMMGG-HHMMSS.dump)
done < <(ls -1t "$DESTINAZIONE"/telaio-*.dump 2>/dev/null | tail -n +4 | xargs -I{} find {} -mtime "+$GIORNI" 2>/dev/null)
echo "rimossi: $RIMOSSI"

if [[ -n "$RCLONE" || -n "$RSYNC" ]]; then
  [[ -n "$AGE" ]] || errore "copia offsite senza cifratura rifiutata: imposta BACKUP_AGE_RECIPIENT (chiave pubblica age)"
  command -v age >/dev/null || errore "age non installato (apt install age)"
  passo "Cifro e invio la copia offsite"
  CIFRATO="$FILE.age"
  age -r "$AGE" -o "$CIFRATO" "$FILE"
  # Anche il file dei segreti: senza BETTER_AUTH_SECRET la 2FA degli utenti non è più utilizzabile.
  ENV_CIFRATO="$DESTINAZIONE/env-${MARCA}.age"
  age -r "$AGE" -o "$ENV_CIFRATO" "$RADICE/.env.production"
  if [[ -n "$RCLONE" ]]; then
    command -v rclone >/dev/null || errore "rclone non installato"
    rclone copy "$CIFRATO" "$RCLONE" && rclone copy "$ENV_CIFRATO" "$RCLONE"
  else
    command -v rsync >/dev/null || errore "rsync non installato"
    rsync -a "$CIFRATO" "$ENV_CIFRATO" "$RSYNC"
  fi
  rm -f "$ENV_CIFRATO" "$CIFRATO"
  echo "copia offsite inviata: $(basename "$CIFRATO")"
else
  echo "ATTENZIONE: nessuna copia offsite configurata (BACKUP_RCLONE_REMOTE o BACKUP_RSYNC_TARGET)." >&2
fi

date -u +%FT%TZ > "$DESTINAZIONE/ultimo-backup-ok"
passo "Backup completato: $FILE"

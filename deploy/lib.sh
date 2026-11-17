#!/usr/bin/env bash
# Funzioni comuni agli script di deploy. Si carica con `source`, non si esegue.

# Cartella di installazione (quella che contiene docker-compose.prod.yml e .env.production).
RADICE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RADICE" || exit 1

errore() { echo "ERRORE: $*" >&2; exit 1; }
passo() { echo; echo "==> $*"; }

[[ -f docker-compose.prod.yml ]] || errore "docker-compose.prod.yml non trovato in $RADICE"
[[ -f .env.production ]] || errore "manca $RADICE/.env.production (parti da .env.production.example)"

# Legge un valore da .env.production senza eseguire il file (contiene spazi e riferimenti ${...}).
leggi() {
  local valore
  valore="$(grep -E "^$1=" .env.production | tail -1 | cut -d= -f2- || true)"
  echo "${valore:-${2:-}}"
}

# docker compose con file e variabili di produzione; la versione viene da TELAIO_VERSION o da .versione.
compose() {
  if [[ -z "${TELAIO_VERSION:-}" ]]; then
    [[ -f .versione ]] || errore "nessuna versione: imposta TELAIO_VERSION oppure esegui un deploy"
    TELAIO_VERSION="$(cat .versione)"
  fi
  export TELAIO_VERSION
  docker compose -f docker-compose.prod.yml --env-file .env.production "$@"
}

# Postgres e Redis condivisi (/opt/infrastructure). Nomi sovrascrivibili da .env.production.
PG_CONTAINER="$(leggi PG_CONTAINER postgres)"
PG_UTENTE="$(leggi PG_UTENTE telaio_user)"
PG_ADMIN="$(leggi PG_ADMIN postgres_admin)"
REDIS_CONTAINER="$(leggi REDIS_CONTAINER redis)"

# Esegue un comando dentro il container Postgres condiviso (socket locale, nessuna password).
pg() { docker exec -i "$PG_CONTAINER" "$@"; }

# Il container deve esistere ed essere healthy.
richiedi_sano() {
  local stato
  stato="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1" 2>/dev/null || true)"
  [[ "$stato" == "healthy" ]] || errore "il servizio condiviso $1 non è pronto (stato: ${stato:-assente})"
}

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }

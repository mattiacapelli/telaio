#!/usr/bin/env bash
# Pubblica una versione di Telaio: scarica le immagini → backup → migrazioni → aggiorna web e worker → verifica.
# Uso: deploy/deploy.sh <versione>     (la versione è lo SHA del commit, tag immutabile delle immagini)
# Se la verifica fallisce, web e worker tornano alla versione precedente (le migrazioni restano:
# devono essere retrocompatibili, vedi docs/deploy.md).
set -euo pipefail
# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

VERSIONE="${1:-}"
[[ -n "$VERSIONE" ]] || errore "uso: deploy/deploy.sh <versione>"
[[ "$VERSIONE" =~ ^[A-Za-z0-9._-]+$ ]] || errore "versione non valida: $VERSIONE"
[[ "$VERSIONE" != "latest" ]] || errore "«latest» non identifica una release: usa lo SHA del commit"

PRECEDENTE="$(cat .versione 2>/dev/null || true)"
PORTA="$(leggi WEB_PORT 3000)"
export TELAIO_VERSION="$VERSIONE"

passo "Versione $VERSIONE (attuale: ${PRECEDENTE:-nessuna})"

if [[ "${TELAIO_SALTA_PULL:-0}" != "1" ]]; then
  passo "Scarico le immagini"
  compose pull web worker
fi

passo "Avvio database e Redis (se non già attivi)"
compose up -d --wait --wait-timeout 120 postgres redis

if [[ -n "$PRECEDENTE" ]]; then
  passo "Backup prima del deploy"
  "$RADICE/deploy/backup.sh" --prima-del-deploy
else
  echo "Primo deploy: niente da salvare."
fi

passo "Migrazioni"
if ! compose run --rm migrate; then
  errore "migrazioni fallite: web e worker NON sono stati toccati (la versione in esecuzione resta ${PRECEDENTE:-nessuna})"
fi

passo "Aggiorno web e worker"
if ! compose up -d --remove-orphans --wait --wait-timeout 180; then
  ATTIVO=0
else
  passo "Verifico /api/health (porta $PORTA)"
  ATTIVO=0
  for _ in $(seq 1 30); do
    RISPOSTA="$(curl -fsS --max-time 5 "http://127.0.0.1:${PORTA}/api/health" 2>/dev/null || true)"
    if [[ "$RISPOSTA" == *'"stato":"ok"'* && "$RISPOSTA" == *"\"versione\":\"${VERSIONE}\""* ]]; then
      ATTIVO=1
      break
    fi
    sleep 2
  done
fi

if [[ "$ATTIVO" != "1" ]]; then
  echo "Risposta di /api/health: ${RISPOSTA:-nessuna}" >&2
  compose ps -a >&2 || true
  compose logs --tail=40 web worker >&2 || true
  if [[ -n "$PRECEDENTE" && "$PRECEDENTE" != "$VERSIONE" ]]; then
    passo "Verifica fallita: torno alla versione $PRECEDENTE"
    TELAIO_VERSION="$PRECEDENTE" compose up -d --wait --wait-timeout 180 web worker \
      || echo "ATTENZIONE: anche il ritorno a $PRECEDENTE è fallito, intervieni a mano" >&2
  fi
  errore "deploy di $VERSIONE non riuscito"
fi

passo "Stato dei container"
compose ps
# Nessun servizio deve essere in riavvio continuo o fermo (migrate è un job e termina).
PROBLEMI="$(compose ps -a --format '{{.Service}} {{.State}} {{.Health}}' \
  | grep -vE '^migrate exited' | grep -E 'restarting|exited|dead|unhealthy|starting' || true)"
[[ -z "$PROBLEMI" ]] || errore "servizi non sani: $PROBLEMI"

echo "${PRECEDENTE}" > .versione-precedente
echo "$VERSIONE" > .versione
passo "Deploy completato: $VERSIONE"

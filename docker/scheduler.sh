#!/bin/sh
# Richiama lo scheduler a intervalli regolari.
#
# Gira come processo separato accanto al server: un cron di sistema
# richiederebbe un'immagine con crond e la duplicazione della configurazione,
# mentre così condivide lo stesso codice e le stesse variabili d'ambiente.
set -e

INTERVALLO="${SCHEDULER_INTERVALLO:-3600}"
URL="http://127.0.0.1:${PORT:-3000}/api/scheduler"

# Attende che il server risponda prima di iniziare.
until wget -q -O /dev/null "http://127.0.0.1:${PORT:-3000}/login" 2>/dev/null; do
  sleep 3
done

echo "→ scheduler attivo (ogni ${INTERVALLO}s)"
while true; do
  wget -q -O- --header="Authorization: Bearer ${SCHEDULER_TOKEN}" \
    --post-data='' "$URL" 2>/dev/null | head -c 200
  echo ""
  sleep "$INTERVALLO"
done

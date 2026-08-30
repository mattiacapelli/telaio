#!/bin/sh
# Applies pending migrations before the server accepts traffic, then seeds once
# on an empty database. Safe to re-run: migrate deploy and the seed are both idempotent.
set -e

echo "→ applying database migrations"
./node_modules/.bin/prisma migrate deploy

if [ "${TELAIO_SEED:-true}" = "true" ]; then
  echo "→ seeding (skipped automatically if data already present)"
  node prisma/seed.mjs || echo "  seed skipped"
fi

# Lo scheduler parte in background solo se ha un token: senza, l'endpoint
# rifiuterebbe le richieste e il ciclo girerebbe a vuoto.
if [ -n "${SCHEDULER_TOKEN:-}" ] && [ "${SCHEDULER_ATTIVO:-true}" = "true" ]; then
  /usr/local/bin/scheduler.sh &
fi

echo "→ starting Telaio on :${PORT:-3000}"
exec "$@"

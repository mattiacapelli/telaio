#!/usr/bin/env bash
#
# Telaio — gestione dello stack containerizzato.
#
#   ./scripts/container.sh up       avvia database + app (build se serve)
#   ./scripts/container.sh build    ricostruisce solo l'immagine dell'app
#   ./scripts/container.sh down     ferma tutto (i dati restano nei volumi)
#   ./scripts/container.sh reset    ferma tutto e CANCELLA i volumi
#   ./scripts/container.sh logs     segue i log dell'app
#   ./scripts/container.sh dev      solo postgres + redis, per `npm run dev`
#
set -euo pipefail
cd "$(dirname "$0")/.."

# L'app sta nel profilo "app": senza profilo si avviano solo i database.
COMPOSE="docker compose --profile app"

if ! docker info >/dev/null 2>&1; then
  echo "Docker non è in esecuzione. Avvia Docker Desktop e riprova." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "→ .env mancante: lo creo da .env.example"
  cp .env.example .env
fi

# Dentro i container i servizi si raggiungono per nome, non su localhost.
app_env() {
  set -a; . ./.env; set +a
  export DATABASE_URL="postgresql://${POSTGRES_USER:-telaio}:${POSTGRES_PASSWORD:-telaio}@postgres:5432/${POSTGRES_DB:-telaio}?schema=public"
  export REDIS_URL="redis://redis:6379"
}

case "${1:-up}" in
  up)
    app_env
    echo "→ avvio stack completo (postgres, redis, app)"
    $COMPOSE up -d --build
    echo
    echo "Telaio è su http://localhost:${APP_PORT:-3000}"
    echo "Log:  ./scripts/container.sh logs"
    ;;
  build)
    app_env
    $COMPOSE build app
    ;;
  dev)
    echo "→ avvio solo i database (l'app la lanci con: npm run dev)"
    docker compose up -d postgres redis
    echo "postgres su :${POSTGRES_PORT:-5433} · redis su :${REDIS_PORT:-6380}"
    ;;
  down)
    $COMPOSE down
    ;;
  reset)
    read -r -p "Cancello i volumi: tutti i dati andranno persi. Continuare? [s/N] " ok
    case "$ok" in
      s|S|y|Y) $COMPOSE down -v && echo "volumi rimossi" ;;
      *) echo "annullato" ;;
    esac
    ;;
  logs)
    $COMPOSE logs -f app
    ;;
  *)
    echo "uso: $0 {up|build|dev|down|reset|logs}" >&2
    exit 1
    ;;
esac

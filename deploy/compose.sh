#!/usr/bin/env bash
# docker compose per la produzione, con file di variabili e versione corrente già impostati.
#   deploy/compose.sh ps
#   deploy/compose.sh logs -f web
set -euo pipefail
# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
compose "$@"

#!/usr/bin/env bash
# Crea l'utente amministratore (primo deploy). Chiede i dati a terminale: la password non finisce
# negli argomenti dei processi né nella cronologia della shell.
set -euo pipefail
# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

read -r -p "Email: " SEED_ADMIN_EMAIL
read -r -p "Nome: " SEED_ADMIN_NAME
read -r -s -p "Password (almeno 12 caratteri): " SEED_ADMIN_PASSWORD; echo
read -r -s -p "Ripeti la password: " RIPETI; echo
[[ "$SEED_ADMIN_PASSWORD" == "$RIPETI" ]] || errore "le password non coincidono"
export SEED_ADMIN_EMAIL SEED_ADMIN_NAME SEED_ADMIN_PASSWORD

compose run --rm -e SEED_ADMIN_EMAIL -e SEED_ADMIN_NAME -e SEED_ADMIN_PASSWORD migrate \
  node_modules/.bin/tsx node_modules/@telaio/db/src/crea-admin.ts

# syntax=docker/dockerfile:1
# Un solo Dockerfile per tutto Telaio; le immagini finali si scelgono con --target:
#   web     → Next.js standalone, porta 3000
#   worker  → job BullMQ (default) e, con un altro comando, migrazioni e creazione dell'admin
# Le immagini finali contengono solo dipendenze di produzione e girano come utente non-root.
ARG NODE_VERSION=24.22.2

FROM node:${NODE_VERSION}-alpine AS base
# Versione di pnpm allineata a "packageManager" del package.json radice.
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/twenty/package.json packages/twenty/
RUN --mount=type=cache,target=/pnpm-store pnpm install --frozen-lockfile --store-dir /pnpm-store

FROM deps AS build
COPY . .
# Il build di Next importa i moduli ma non apre connessioni: bastano valori finti, solo in questo stage.
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN BETTER_AUTH_SECRET=build-only-secret-build-only-secret \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    REDIS_URL=redis://localhost:6379 \
    pnpm --filter @telaio/web build
# Il worker con le sole dipendenze di produzione (i pacchetti del workspace vengono copiati).
# Senza auto-install-peers non entrano le peer opzionali di better-auth (next, playwright…): 63 MB invece di 380.
RUN npm_config_auto_install_peers=false pnpm --filter @telaio/worker deploy --prod /out/worker

# ── web ───────────────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS web
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    APP_VERSION=${APP_VERSION} \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]

# ── worker ────────────────────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS worker
ARG APP_VERSION=dev
# pg_dump serve al job di backup.
RUN apk add --no-cache postgresql18-client \
 && mkdir /backups && chown node:node /backups
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    BACKUP_DIR=/backups
WORKDIR /app
COPY --from=build --chown=node:node /out/worker ./
USER node
# Nessuna porta: il worker è sano finché il processo gira (un errore di Redis lo fa uscire e riavviare).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD pgrep -f "src/index.ts" >/dev/null || exit 1
CMD ["node_modules/.bin/tsx", "src/index.ts"]

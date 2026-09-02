# syntax=docker/dockerfile:1

# ---- deps: install node modules only when manifests change ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm config set fetch-timeout 900000 \
 && npm config set fetch-retries 8 \
 && npm config set fetch-retry-maxtimeout 180000 \
 && npm ci --no-audit --no-fund

# ---- builder: generate the Prisma client and build Next ----
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# A build-time DATABASE_URL is never connected to; it only satisfies config parsing.
ENV DATABASE_URL="postgresql://telaio:telaio@postgres:5432/telaio?schema=public"
RUN npm run build

# ---- prisma-cli: just the CLI and its transitive deps, for boot-time migrations ----
FROM node:22-alpine AS prisma-cli
WORKDIR /cli
# No package.json here on purpose: copying the app's would drag in next,
# typescript and the rest of the build deps. This stage installs only the CLI.
RUN npm config set fetch-timeout 900000 \
 && npm config set fetch-retries 8 \
 && npm config set fetch-retry-maxtimeout 180000 \
 && npm init -y >/dev/null \
 && npm install --ignore-scripts --no-audit --no-fund prisma@6 \
 && npm cache clean --force

# ---- cli-deps: dependencies for scripts/*.mjs run manually inside the container ----
# Turbopack bundles ioredis straight into the server chunks, so it never
# lands in the standalone node_modules — fine for the app itself, but
# scripts/utente.mjs runs standalone and needs the real package on disk,
# transitive deps included. Same isolated-install pattern as prisma-cli
# above, and for the same reason: the app's package.json would drag in
# next/typescript/etc.
FROM node:22-alpine AS cli-deps
WORKDIR /cli
RUN npm config set fetch-timeout 900000 \
 && npm config set fetch-retries 8 \
 && npm config set fetch-retry-maxtimeout 180000 \
 && npm init -y >/dev/null \
 && npm install --ignore-scripts --no-audit --no-fund ioredis@6 \
 && npm cache clean --force

# ---- runner: minimal standalone image ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# Standalone output already contains the pruned node_modules Next needs.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migrations and the seed run at boot, so the image needs the Prisma CLI on top
# of Next's standalone modules. The CLI drags in transitive deps (effect,
# @effect/*, ...), so install it in its own stage and copy that tree whole —
# cherry-picking prisma/@prisma alone leaves those requires unresolved.
COPY --from=builder /app/prisma ./prisma
# Gestione utenti da riga di comando (crea/password/disattiva/elenco): non
# fa parte del bundle Next, va copiata a parte per poterla lanciare a mano
# nel container in produzione (docker compose exec app node scripts/utente.mjs ...).
COPY --from=builder /app/scripts ./scripts
# Copied into staging dirs first: writing straight to ./node_modules would
# clobber the standalone tree Next needs. `cp -r` merges them instead.
# - prisma-cli: the Prisma CLI, for boot-time migrations.
# - cli-deps: ioredis, for scripts/utente.mjs's session revocation. Turbopack
#   bundles ioredis straight into the server chunks, so it never lands in
#   the standalone node_modules — fine for the app itself, but the script
#   runs standalone and needs the real package on disk, transitive deps
#   included.
COPY --from=prisma-cli /cli/node_modules ./cli-modules-prisma
COPY --from=cli-deps /cli/node_modules ./cli-modules-ioredis
RUN cp -r ./cli-modules-prisma/. ./node_modules/ \
 && cp -r ./cli-modules-ioredis/. ./node_modules/ \
 && rm -rf ./cli-modules-prisma ./cli-modules-ioredis \
 && chown -R nextjs:nodejs ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/scheduler.sh /usr/local/bin/scheduler.sh
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/scheduler.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]

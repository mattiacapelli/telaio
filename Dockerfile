# Un solo Dockerfile per web e worker: condividono il codice, cambia solo il comando.
#   web     → pnpm --filter @telaio/web start
#   worker  → pnpm --filter @telaio/worker start
#   migrate → pnpm db:migrate
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/twenty/package.json packages/twenty/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Il build di Next importa i moduli ma non apre connessioni: bastano valori finti, solo in questo stage.
ENV BETTER_AUTH_SECRET=build-only-secret-build-only-secret \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    REDIS_URL=redis://localhost:6379 \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @telaio/web build

FROM base AS runtime
# pg_dump serve al job di backup del worker.
RUN apk add --no-cache postgresql18-client
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "@telaio/web", "start"]

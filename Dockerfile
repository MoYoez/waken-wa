# Production: pnpm tree (pruned), then `drizzle-kit push` + `next start`.
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY drizzle ./drizzle
COPY drizzle.config.sqlite.ts drizzle.config.pg.ts ./
COPY scripts ./scripts
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && pnpm install --frozen-lockfile --ignore-scripts \
  && pnpm rebuild better-sqlite3

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/drizzle ./drizzle
COPY --from=deps /app/drizzle.config.sqlite.ts ./drizzle.config.sqlite.ts
COPY --from=deps /app/drizzle.config.pg.ts ./drizzle.config.pg.ts
COPY --from=deps /app/scripts ./scripts
COPY . .

# Ephemeral SQLite file for `next build` only (not the runtime DB under /app/data).
RUN mkdir -p /tmp/waken-build-db
ENV DATABASE_URL=file:/tmp/waken-build-db/build.db
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public
RUN pnpm run build

# Drop devDependencies (drizzle-kit stays in dependencies for entrypoint push).
FROM builder AS runner-prep
RUN pnpm prune --prod

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=runner-prep /app/package.json /app/pnpm-lock.yaml ./
COPY --from=runner-prep /app/node_modules ./node_modules
COPY --from=runner-prep /app/drizzle ./drizzle
COPY --from=runner-prep /app/drizzle.config.sqlite.ts ./drizzle.config.sqlite.ts
COPY --from=runner-prep /app/drizzle.config.pg.ts ./drizzle.config.pg.ts
COPY --from=runner-prep /app/scripts ./scripts
COPY --from=runner-prep /app/public ./public
COPY --from=runner-prep /app/.next ./.next
COPY --from=runner-prep /app/next.config.mjs ./next.config.mjs

COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app

USER root
EXPOSE 3000
ENV PORT=3000

ENTRYPOINT ["/docker-entrypoint.sh"]

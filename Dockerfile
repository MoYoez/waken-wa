
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
  && rm -rf /var/lib/apt/lists \
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

RUN mkdir -p /tmp/waken-build-db
ENV DATABASE_URL=file:/tmp/waken-build-db/build.db
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public
RUN pnpm run build && rm -rf .next/cache


# Drizzle CLI only: bump pnpm add versions when upgrading Drizzle or drivers in package.json.
FROM base AS drizzle-tools
WORKDIR /tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists
RUN printf '%s\n' '{"name":"drizzle-tools","private":true,"version":"1.0.0"}' > package.json \
  && pnpm add drizzle-kit@0.31.10 drizzle-orm@0.44.7 better-sqlite3@12.8.0 pg@8.20.0 dotenv@16.6.1 \
  && pnpm rebuild better-sqlite3

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends gosu redis-server tini \
  && rm -rf /var/lib/apt/lists

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --chown=nextjs:nodejs --from=builder /app/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static

COPY --chown=nextjs:nodejs --from=builder /app/drizzle ./drizzle
COPY --chown=nextjs:nodejs --from=builder /app/drizzle.config.sqlite.ts ./drizzle.config.sqlite.ts
COPY --chown=nextjs:nodejs --from=builder /app/drizzle.config.pg.ts ./drizzle.config.pg.ts
COPY --chown=nextjs:nodejs --from=builder /app/package.json ./package.json
COPY --chown=nextjs:nodejs --from=builder /app/scripts/startup-banner.mjs ./scripts/startup-banner.mjs

COPY --chown=nextjs:nodejs --from=drizzle-tools /tools ./tools

COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

EXPOSE 3000
ENV PORT=3000
# Next standalone reads HOSTNAME; HOST is set for common tooling conventions.
ENV HOST=0.0.0.0
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["/usr/bin/tini", "-s", "--", "/docker-entrypoint.sh"]

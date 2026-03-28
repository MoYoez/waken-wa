# Production image: Next.js standalone + Prisma (PostgreSQL) for Docker Compose.
FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY scripts ./scripts
# Skip postinstall (init-db / db push); schema sync runs in docker-entrypoint.sh
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS builder
COPY . .
# Build-time URL only (Prisma generate does not connect). Must be postgres:// so the Postgres schema is used.
ENV DATABASE_URL=postgresql://waken:build@127.0.0.1:5432/waken
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public
RUN pnpm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma CLI + generated client + engines (for entrypoint db push)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["/docker-entrypoint.sh"]

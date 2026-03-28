#!/bin/sh
set -e
cd /app

mkdir -p /app/data

# Persist JWT when unset: stable across restarts with the same named volume.
if [ -z "${JWT_SECRET:-}" ]; then
  if [ -f /app/data/.jwt_secret ]; then
    JWT_SECRET=$(tr -d '\n\r' < /app/data/.jwt_secret)
  else
    node -e "require('fs').writeFileSync('/app/data/.jwt_secret', require('crypto').randomBytes(32).toString('hex'))"
    chmod 600 /app/data/.jwt_secret
    JWT_SECRET=$(tr -d '\n\r' < /app/data/.jwt_secret)
  fi
  export JWT_SECRET
fi

if [ "$(id -u)" = 0 ]; then
  chown -R nextjs:nodejs /app/data
fi

export DATABASE_URL="${DATABASE_URL:-file:/app/data/dev.db}"

# Config lives under /app but CLI deps are in /app/tools; TS config imports `drizzle-kit`.
export NODE_PATH=/app/tools/node_modules

DRIZZLE_KIT_CLI=/app/tools/node_modules/drizzle-kit/bin.cjs

case "$DATABASE_URL" in
  postgres:*|postgresql:*)
    DRIZZLE_CONFIG=drizzle.config.pg.ts
    ;;
  *)
    DRIZZLE_CONFIG=drizzle.config.sqlite.ts
    ;;
esac

start_app() {
  node "$DRIZZLE_KIT_CLI" push --config "$DRIZZLE_CONFIG"
  exec node server.js
}

if [ "$(id -u)" = 0 ]; then
  exec runuser -u nextjs -- env \
    DATABASE_URL="$DATABASE_URL" \
    JWT_SECRET="$JWT_SECRET" \
    PORT="${PORT:-3000}" \
    NODE_ENV="${NODE_ENV:-production}" \
    NODE_PATH=/app/tools/node_modules \
    HOME=/tmp \
    sh -ec "cd /app && node $DRIZZLE_KIT_CLI push --config $DRIZZLE_CONFIG && exec node server.js"
else
  start_app
fi

#!/bin/sh
set -e
cd /app

export HOST=0.0.0.0
export HOSTNAME=0.0.0.0

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
export REDIS_INTERNAL_ENABLED="${REDIS_INTERNAL_ENABLED:-1}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:${REDIS_PORT}}"
export REDIS_CACHE_TTL_SECONDS="${REDIS_CACHE_TTL_SECONDS:-3600}"

# Config lives under /app but CLI deps are in /app/tools; TS config imports `drizzle-kit`.
export NODE_PATH=/app/tools/node_modules

export DRIZZLE_KIT_CLI=/app/tools/node_modules/drizzle-kit/bin.cjs

case "$DATABASE_URL" in
  postgres:*|postgresql:*)
    export DRIZZLE_CONFIG=drizzle.config.pg.ts
    ;;
  *)
    export DRIZZLE_CONFIG=drizzle.config.sqlite.ts
    ;;
esac

start_internal_redis() {
  [ "${REDIS_INTERNAL_ENABLED}" = "1" ] || return 0

  mkdir -p /app/data/redis
  if [ "$(id -u)" = 0 ]; then
    chown -R nextjs:nodejs /app/data/redis
    gosu nextjs redis-server \
      --bind 127.0.0.1 \
      --port "${REDIS_PORT}" \
      --save 60 1 \
      --appendonly yes \
      --loglevel warning \
      --dir /app/data/redis \
      --dbfilename dump.rdb \
      --daemonize yes
  else
    redis-server \
      --bind 127.0.0.1 \
      --port "${REDIS_PORT}" \
      --save 60 1 \
      --appendonly yes \
      --loglevel warning \
      --dir /app/data/redis \
      --dbfilename dump.rdb \
      --daemonize yes
  fi
}

start_app() {
  node /app/scripts/startup-banner.mjs start
  node "$DRIZZLE_KIT_CLI" push --config "$DRIZZLE_CONFIG"
  exec node server.js
}

start_internal_redis

if [ "$(id -u)" = 0 ]; then
  export PORT="${PORT:-3000}"
  export NODE_ENV="${NODE_ENV:-production}"
  export HOST=0.0.0.0
  export HOSTNAME=0.0.0.0
  export HOME=/tmp
  export USER=nextjs
  export LOGNAME=nextjs
  export SHELL=/bin/sh

  exec gosu nextjs sh -ec 'cd /app && node /app/scripts/startup-banner.mjs start && node "$DRIZZLE_KIT_CLI" push --config "$DRIZZLE_CONFIG" && exec node server.js'
else
  start_app
fi

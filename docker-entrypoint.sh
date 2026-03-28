#!/bin/sh
set -e
cd /app

# Sync PostgreSQL schema (migrations in repo are SQLite; production PG uses schema.postgres.prisma + db push).
node node_modules/prisma/build/index.js db push --schema prisma/schema.postgres.prisma

exec node server.js

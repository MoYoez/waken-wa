#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo "error: need 'docker compose' (v2) or docker-compose (v1)." >&2
    exit 1
  fi
}

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker is not installed or not in PATH." >&2
  exit 1
fi

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Created .env from .env.example."
  else
    echo "error: missing .env and .env.example. Create .env with at least:" >&2
    echo "  POSTGRES_PASSWORD=..." >&2
    echo "  JWT_SECRET=..." >&2
    echo "  NEXT_PUBLIC_BASE_URL=https://your-host:3000" >&2
    exit 1
  fi
  echo ""
  echo "Edit .env: set POSTGRES_PASSWORD and JWT_SECRET (and NEXT_PUBLIC_BASE_URL for production)."
  echo "Then run: ./deploy.sh"
  exit 1
fi

echo "Building and starting stack (postgres + app)..."
compose up -d --build

echo ""
echo "Done. Open http://localhost:3000 (set APP_PORT in .env to map a different host port)."
echo "Logs: docker compose logs -f app"

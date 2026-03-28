#!/usr/bin/env bash
# Local: ./deploy.sh
# One-liner (needs git + docker; clone + compose up):
#   curl -fsSL https://raw.githubusercontent.com/MoYoez/waken-wa-web/main/deploy.sh | bash
#
# Optional env: WAKEN_DEPLOY_DIR, WAKEN_DIR, WAKEN_BRANCH, WAKEN_REPO_URL
set -euo pipefail

WAKEN_REPO_URL="${WAKEN_REPO_URL:-https://github.com/MoYoez/waken-wa-web.git}"
WAKEN_BRANCH="${WAKEN_BRANCH:-main}"
WAKEN_DIR="${WAKEN_DIR:-waken-wa-web}"

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

# Fill empty JWT_SECRET in .env so compose passes a stable secret (optional; container also persists .jwt_secret).
ensure_jwt_in_env_file() {
  [ -f .env ] || return
  local line val
  line=$(grep '^JWT_SECRET=' .env 2>/dev/null | tail -n1 || true)
  val="${line#JWT_SECRET=}"
  val="${val%\"}"
  val="${val#\"}"
  val="${val%\'}"
  val="${val#\'}"
  [ -n "$val" ] && return
  command -v openssl >/dev/null 2>&1 || return
  local secret
  secret=$(openssl rand -hex 32)
  if grep -q '^JWT_SECRET=' .env 2>/dev/null; then
    grep -v '^JWT_SECRET=' .env >.env.tmp && echo "JWT_SECRET=$secret" >>.env.tmp && mv .env.tmp .env
  else
    echo "JWT_SECRET=$secret" >>.env
  fi
  echo "Generated JWT_SECRET in .env (optional; Docker can also persist JWT in the sqlite volume)."
}

resolve_project_root() {
  if [ -n "${WAKEN_DEPLOY_DIR:-}" ]; then
    if [ ! -f "$WAKEN_DEPLOY_DIR/docker-compose.yml" ]; then
      echo "error: WAKEN_DEPLOY_DIR=$WAKEN_DEPLOY_DIR has no docker-compose.yml" >&2
      exit 1
    fi
    (cd "$WAKEN_DEPLOY_DIR" && pwd)
    return
  fi

  local script_path="${BASH_SOURCE[0]:-}"
  if [ -n "$script_path" ] && [ "$script_path" != "-" ] && [ -f "$script_path" ]; then
    local d
    d="$(cd "$(dirname "$script_path")" && pwd)"
    if [ -f "$d/docker-compose.yml" ]; then
      echo "$d"
      return
    fi
  fi

  local target
  target="$(pwd)/$WAKEN_DIR"
  if [ -f "$target/docker-compose.yml" ]; then
    echo "$target"
    return
  fi

  if ! command -v git >/dev/null 2>&1; then
    echo "error: git is required when running via curl (to clone the repo)." >&2
    echo "  Or clone manually, cd into the repo, and run: ./deploy.sh" >&2
    exit 1
  fi

  echo "Cloning $WAKEN_REPO_URL (branch $WAKEN_BRANCH) into $target ..."
  git clone --depth 1 -b "$WAKEN_BRANCH" "$WAKEN_REPO_URL" "$target"
  (cd "$target" && git submodule update --init --recursive --depth 1)
  echo "$target"
}

ROOT="$(resolve_project_root)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker is not installed or not in PATH." >&2
  exit 1
fi

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Created .env from .env.example."
  else
    {
      echo 'JWT_SECRET='
      echo 'DATABASE_URL=file:/app/data/dev.db'
      echo 'NEXT_PUBLIC_BASE_URL=http://localhost:3000'
    } >.env
    echo "Created minimal .env (no .env.example in repo)."
  fi
fi

ensure_jwt_in_env_file

echo "Building and starting app (SQLite in Docker volume waken_sqlite_data)..."
compose up -d --build

echo ""
echo "Done. Open http://localhost:3000 (set APP_PORT in .env to map a different host port)."
echo "Logs: docker compose logs -f app"

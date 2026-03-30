#!/usr/bin/env bash
# Local: ./deploy-build-from-source.sh
#   curl -fsSL https://raw.githubusercontent.com/MoYoez/waken-wa/main/deploy-build-from-source.sh | bash
#
# Optional env: WAKEN_DEPLOY_DIR, WAKEN_WORKSPACE, WAKEN_DIR, WAKEN_BRANCH, WAKEN_REPO_URL
# Default clone path: $WAKEN_WORKSPACE/$WAKEN_DIR (WAKEN_WORKSPACE defaults to ~/waken-wa-deploy).
# Keeps the full repository (Dockerfile + source) for local image builds.
set -euo pipefail

WAKEN_REPO_URL="${WAKEN_REPO_URL:-https://github.com/MoYoez/waken-wa.git}"
WAKEN_BRANCH="${WAKEN_BRANCH:-main}"
WAKEN_DIR="${WAKEN_DIR:-waken-wa}"

ROOT=""

waken_expand_workspace() {
  local ws="${WAKEN_WORKSPACE:-${HOME:-/tmp}/waken-wa-deploy}"
  case "$ws" in
    "~") ws="${HOME:-/tmp}" ;;
    "~"/*) ws="${HOME:-/tmp}${ws#\~}" ;;
  esac
  printf '%s' "$ws"
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
  else
    echo "错误：需要 Docker Compose v2（docker compose）或 docker-compose（v1）。" >&2
    exit 1
  fi
}

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
  echo "已在 .env 中生成 JWT_SECRET（可选；Docker 也可在 SQLite 数据卷中持久化 JWT）。"
}

resolve_project_root() {
  ROOT=""
  local ws
  ws="$(waken_expand_workspace)"

  if [ -n "${WAKEN_DEPLOY_DIR:-}" ]; then
    if [ ! -f "$WAKEN_DEPLOY_DIR/docker-compose.yml" ]; then
      echo "错误：WAKEN_DEPLOY_DIR=$WAKEN_DEPLOY_DIR 下没有 docker-compose.yml" >&2
      exit 1
    fi
    ROOT="$(cd "$WAKEN_DEPLOY_DIR" && pwd)"
    return
  fi

  local script_path="${BASH_SOURCE[0]:-}"
  if [ -n "$script_path" ] && [ "$script_path" != "-" ] && [ -f "$script_path" ]; then
    local d
    d="$(cd "$(dirname "$script_path")" && pwd)"
    if [ -f "$d/docker-compose.yml" ] && [ -f "$d/Dockerfile" ]; then
      ROOT="$d"
      return
    fi
  fi

  local legacy
  legacy="$(pwd)/$WAKEN_DIR"
  if [ -f "$legacy/docker-compose.yml" ] && [ -f "$legacy/Dockerfile" ]; then
    ROOT="$(cd "$legacy" && pwd)"
    return
  fi

  if ! command -v git >/dev/null 2>&1; then
    echo "错误：未找到仓库，需要先安装 git。" >&2
    echo "  请手动克隆仓库或安装 git 后执行：./deploy-build-from-source.sh" >&2
    exit 1
  fi

  mkdir -p "$ws"
  local clone_target="$ws/$WAKEN_DIR"

  if [ -f "$ws/docker-compose.yml" ] && [ ! -f "$ws/Dockerfile" ]; then
    echo "检测到 $ws 为仅镜像部署布局（无 Dockerfile）；将在 $clone_target 使用完整克隆以构建。" >&2
  fi

  if [ -d "$clone_target/.git" ]; then
    echo "正在更新仓库：$clone_target ..." >&2
    git -C "$clone_target" fetch --depth 1 origin "$WAKEN_BRANCH"
    git -C "$clone_target" checkout "$WAKEN_BRANCH" 2>/dev/null || git -C "$clone_target" checkout -B "$WAKEN_BRANCH" "origin/$WAKEN_BRANCH"
    git -C "$clone_target" reset --hard "origin/$WAKEN_BRANCH"
    (cd "$clone_target" && git submodule update --init --recursive --depth 1) >&2
    ROOT="$(cd "$clone_target" && pwd)"
    return
  fi

  if [ -e "$clone_target" ]; then
    echo "错误：$clone_target 已存在但不是 git 仓库；请删除该目录或设置 WAKEN_DEPLOY_DIR。" >&2
    exit 1
  fi

  echo "正在克隆 $WAKEN_REPO_URL（分支 $WAKEN_BRANCH）到 $clone_target ..." >&2
  git clone --depth 1 -b "$WAKEN_BRANCH" "$WAKEN_REPO_URL" "$clone_target"
  (cd "$clone_target" && git submodule update --init --recursive --depth 1) >&2
  ROOT="$(cd "$clone_target" && pwd)"
}

resolve_project_root
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "错误：未检测到 docker，请安装并加入 PATH。" >&2
  exit 1
fi

if [ ! -f Dockerfile ]; then
  echo "错误：在 $ROOT 未找到 Dockerfile（源码构建需要完整仓库）。" >&2
  exit 1
fi

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "已从 .env.example 创建 .env。"
  else
    {
      echo 'JWT_SECRET='
      echo 'DATABASE_URL=file:/app/data/dev.db'
      echo 'NEXT_PUBLIC_BASE_URL=http://localhost:3000'
    } >.env
    echo "已创建最小 .env。"
  fi
fi

ensure_jwt_in_env_file

echo "正在构建并启动应用（SQLite 数据在 Docker 卷 waken_sqlite_data）..."
compose up -d --build

#!/usr/bin/env bash
# Local: ./deploy.sh
#   curl -fsSL https://raw.githubusercontent.com/MoYoez/waken-wa/main/deploy.sh | bash
#
# Optional env: WAKEN_DEPLOY_DIR, WAKEN_WORKSPACE, WAKEN_DIR, WAKEN_BRANCH, WAKEN_REPO_URL, WAKEN_IMAGE, WAKEN_DOCKERHUB_IMAGE, USE_LATEST_VERSION, USE_LASTEST_VERSION (deprecated)
# Default clone path: $WAKEN_WORKSPACE/$WAKEN_DIR (WAKEN_WORKSPACE defaults to ~/waken-wa-deploy).
# After a fresh clone, registry deploy keeps only docker-compose.yml (no build: .) and .env at WAKEN_WORKSPACE.
set -euo pipefail

WAKEN_REPO_URL="${WAKEN_REPO_URL:-https://github.com/MoYoez/waken-wa.git}"
WAKEN_BRANCH="${WAKEN_BRANCH:-}"
WAKEN_DIR="${WAKEN_DIR:-waken-wa}"
WAKEN_IMAGE="${WAKEN_IMAGE:-}"
WAKEN_DOCKERHUB_IMAGE="${WAKEN_DOCKERHUB_IMAGE:-moyoez/waken-wa}"

ROOT=""
CLONED_FRESH=false
WAKEN_REF=""
WAKEN_REF_KIND=""

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

latest_stable_tag() {
  git ls-remote --tags --refs "$WAKEN_REPO_URL" 'v*' |
    awk '{ sub("refs/tags/", "", $2); print $2 }' |
    grep -Ev '[-+](alpha|beta|rc|pre|canary|dev)' |
    sort -V |
    tail -n 1
}

resolve_waken_version() {
  if [ -n "${USE_LATEST_VERSION:-}" ]; then
    WAKEN_REF="${WAKEN_BRANCH:-main}"
    WAKEN_REF_KIND="branch"
    WAKEN_IMAGE="${WAKEN_IMAGE:-ghcr.io/moyoez/waken-wa:main}"
    echo "USE_LATEST_VERSION is set; using latest main." >&2
    return
  fi

  if [ -n "${USE_LASTEST_VERSION:-}" ]; then
    echo "USE_LASTEST_VERSION is deprecated; use USE_LATEST_VERSION instead." >&2
    WAKEN_REF="${WAKEN_BRANCH:-main}"
    WAKEN_REF_KIND="branch"
    WAKEN_IMAGE="${WAKEN_IMAGE:-ghcr.io/moyoez/waken-wa:main}"
    return
  fi

  if [ -n "$WAKEN_BRANCH" ]; then
    WAKEN_REF="$WAKEN_BRANCH"
    WAKEN_REF_KIND="branch"
  else
    WAKEN_REF="$(latest_stable_tag || true)"
    if [ -z "$WAKEN_REF" ]; then
      echo "错误：无法从 $WAKEN_REPO_URL 获取稳定版本 tag。可设置 USE_LATEST_VERSION=1 使用 main。" >&2
      exit 1
    fi
    WAKEN_REF_KIND="tag"
  fi

  WAKEN_IMAGE="${WAKEN_IMAGE:-$WAKEN_DOCKERHUB_IMAGE:$WAKEN_REF}"
}

image_exists_locally() {
  docker image inspect "$1" >/dev/null 2>&1
}

pull_waken_image() {
  local img="$1"
  if image_exists_locally "$img"; then
    if [ -t 0 ]; then
      local ans
      read -r -p "镜像 $img 已在本地。是否从仓库拉取最新？[y/N] " ans || true
      case "$ans" in
        [yY]|[yY][eE][sS])
          echo "正在拉取 $img ..."
          docker pull "$img"
          ;;
        *)
          echo "使用本地已有镜像。"
          ;;
      esac
    else
      echo "镜像 $img 已在本地；非交互环境：正在拉取以刷新 ..."
      docker pull "$img"
    fi
  else
    echo "正在拉取镜像 $img ..."
    docker pull "$img"
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

# Strip build: . so registry-only stacks do not need a Dockerfile in the install dir.
trim_to_minimal_install() {
  local clone_abs="$1"
  local ws_root
  ws_root="$(cd "$(dirname "$clone_abs")" && pwd)"
  sed '/^[[:space:]]*build:[[:space:]]*\.$/d' "$clone_abs/docker-compose.yml" >"$ws_root/docker-compose.yml"
  cp -f "$clone_abs/.env" "$ws_root/.env"
  rm -rf "$clone_abs"
  cd "$ws_root"
  ROOT="$ws_root"
  echo "精简安装目录：$ROOT（已删除完整克隆目录 $WAKEN_DIR）。" >&2
}

resolve_project_root() {
  ROOT=""
  CLONED_FRESH=false
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

  if [ -f "$ws/docker-compose.yml" ]; then
    ROOT="$(cd "$ws" && pwd)"
    return
  fi

  local script_path="${BASH_SOURCE[0]:-}"
  if [ -n "$script_path" ] && [ "$script_path" != "-" ] && [ -f "$script_path" ]; then
    local d
    d="$(cd "$(dirname "$script_path")" && pwd)"
    if [ -f "$d/docker-compose.yml" ]; then
      ROOT="$d"
      return
    fi
  fi

  local legacy
  legacy="$(pwd)/$WAKEN_DIR"
  if [ -f "$legacy/docker-compose.yml" ]; then
    ROOT="$(cd "$legacy" && pwd)"
    return
  fi

  if ! command -v git >/dev/null 2>&1; then
    echo "错误：通过 curl 安装需要先安装 git 以克隆仓库。" >&2
    echo "  或手动克隆仓库后进入目录执行：./deploy.sh" >&2
    exit 1
  fi

  mkdir -p "$ws"
  local clone_target="$ws/$WAKEN_DIR"

  if [ -d "$clone_target/.git" ]; then
    echo "正在更新仓库：$clone_target ..." >&2
    if [ "$WAKEN_REF_KIND" = "tag" ]; then
      git -C "$clone_target" fetch --depth 1 origin "refs/tags/$WAKEN_REF:refs/tags/$WAKEN_REF"
      git -C "$clone_target" checkout --detach "$WAKEN_REF"
    else
      git -C "$clone_target" fetch --depth 1 origin "$WAKEN_REF"
      git -C "$clone_target" checkout "$WAKEN_REF" 2>/dev/null || git -C "$clone_target" checkout -B "$WAKEN_REF" "origin/$WAKEN_REF"
      git -C "$clone_target" reset --hard "origin/$WAKEN_REF"
    fi
    (cd "$clone_target" && git submodule update --init --recursive --depth 1) >&2
    ROOT="$(cd "$clone_target" && pwd)"
    return
  fi

  if [ -e "$clone_target" ]; then
    echo "错误：$clone_target 已存在但不是 git 仓库；请删除该目录或设置 WAKEN_DEPLOY_DIR。" >&2
    exit 1
  fi

  echo "正在克隆 $WAKEN_REPO_URL（$WAKEN_REF_KIND $WAKEN_REF）到 $clone_target ..." >&2
  git clone --depth 1 -b "$WAKEN_REF" "$WAKEN_REPO_URL" "$clone_target"
  (cd "$clone_target" && git submodule update --init --recursive --depth 1) >&2
  ROOT="$(cd "$clone_target" && pwd)"
  CLONED_FRESH=true
}

resolve_waken_version
resolve_project_root
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "错误：未检测到 docker，请安装并加入 PATH。" >&2
  exit 1
fi

export WAKEN_IMAGE

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
    echo "已创建最小 .env（仓库中无 .env.example）。"
  fi
fi

ensure_jwt_in_env_file

pull_waken_image "$WAKEN_IMAGE"

echo "正在使用镜像仓库镜像启动应用（SQLite 数据在 Docker 卷 waken_sqlite_data）..."
compose up -d --no-build

if [ "$CLONED_FRESH" = true ]; then
  trim_to_minimal_install "$(cd "$ROOT" && pwd)"
fi

echo ""
echo "安装目录：$ROOT"
echo "  docker compose ps       # 查看状态"
echo "  docker compose logs -f  # 查看日志"
echo "  docker compose down     # 停止"

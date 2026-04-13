<div align="right">
  <span>[<a href="./README_EN.md">English</a>]</span>
  <span>[<a href="./README.md">简体中文</a>]</span>
</div>

> 不是被闹钟惊醒，而是温柔地、自愿地，与世界重新相遇。

<p align="center">
  <img src=".github/assets/logo/Logo.png" alt="Waken Wa" width="100" height="100">
  <h2 align="center">Waken Wa💫</h2>
  <p align="center">
    <img alt="visitors" src="https://visitor-badge.laobi.icu/badge?page_id=MoYoez/waken-wa" />
    <img alt="License" src="https://img.shields.io/github/license/MoYoez/waken-wa" />
    <img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/MoYoez/waken-wa/docker-publish.yml" />
    <a href="https://deepwiki.com/MoYoez/Waken-wa">
      <img src="https://deepwiki.com/badge.svg" alt="DeepWiki" />
    </a>
  </p>
</p>

✨ 一日一记，一醒一悟。 | 强定制化，简洁美学，AI结合化的个人生活实时面板~

> 😴晨光里睁眼是醒，深夜写下"今天很好"也是醒。

> 🌟项目灵感来源于 [Sleepy](https://github.com/sleepy-project/sleepy) 和 [Shiro](https://github.com/Innei/Shiro)

## 项目特点🌟

1. 🖥️ 全套 WebUI 支持，服务端快速配置上线
2. 🤖 支持 AI Skills / MCP 辅助修改配置
3. 🧩 支持各类状态与内容显示规则
4. 🎨 支持主题取色、背景与个性化风格定制
5. 📡 支持多平台状态自动同步
6. 🎵 支持音乐、应用与 Steam 游戏状态展示
7. 🗓️ 支持 ICS 日程 / 课表接入
8. ✍️ 支持随想录、灵感记录与内容沉淀
9. 🔒 支持访问锁、hCaptcha 与后台管理

## 图库

<table>
  <tr>
    <td><img src=".github/assets/Preview/preview_main.png" alt="Waken Wa 首页" width="100%"></td>
    <td><img src=".github/assets/Preview/preview_inspiration.png" alt="Waken Wa 灵感页面" width="100%"></td>
  </tr>
  <tr>
    <td align="center"><strong>个人状态首页</strong></td>
    <td align="center"><strong>灵感与随想记录</strong></td>
  </tr>
  <tr>
    <td><img src=".github/assets/Preview/preview_setting0.png" alt="Waken Wa 站点设置" width="100%"></td>
    <td><img src=".github/assets/Preview/preview_setting1.png" alt="Waken Wa 后台配置" width="100%"></td>
  </tr>
  <tr>
    <td align="center"><strong>站点外观配置</strong></td>
    <td align="center"><strong>后台管理面板</strong></td>
  </tr>
</table>

---

## 部署

> 如果需要使用，请配合 [Waken-Wa-Reporter](https://github.com/MoYoez/waken-wa-reporter)

### 1. 本机部署

#### Docker（使用已打包的一键脚本）

需已安装 **Docker**（含 `docker compose`）。在终端执行：

```bash
curl -fsSL https://wakeme.lemonkoi.one | sh
```

> 脚本会自动获取当前最新的 **稳定版本 tag**，并使用对应的 `ghcr.io/moyoez/waken-wa:<tag>` 镜像启动；默认不会直接追踪 `main`，适合日常自托管使用。SQLite 数据默认保存在 Docker 卷中，详见仓库内 `docker-compose.yml`。环境变量可参照 [`.env.example`](.env.example)，或在部署目录中编辑 `.env`。

如果你想部署最新的 `main` 分支版本，可以显式启用：

```bash
USE_LASTEST_VERSION=1 curl -fsSL https://wakeme.lemonkoi.one | sh
```

如需指定分支、仓库、镜像或安装目录，可使用环境变量覆盖：

```bash
WAKEN_BRANCH=main curl -fsSL https://wakeme.lemonkoi.one | sh
WAKEN_IMAGE=ghcr.io/moyoez/waken-wa:v0.40 curl -fsSL https://wakeme.lemonkoi.one | sh
WAKEN_WORKSPACE=~/waken-wa-deploy curl -fsSL https://wakeme.lemonkoi.one | sh
```

#### 自编译（源码）

在已克隆的本仓库根目录执行（需 **Git**、**Docker**）：

```bash
chmod +x deploy-build-from-source.sh   # Unix 首次需要
./deploy-build-from-source.sh
# 或: bash deploy-build-from-source.sh
```

> 脚本会准备 `.env`（若无则从 `.env.example` 复制）、按需生成 `JWT_SECRET`，并执行 `docker compose up -d --build`。也可通过环境变量指定分支与目录，例如 `WAKEN_BRANCH`、`WAKEN_REPO_URL`、`WAKEN_DEPLOY_DIR`（见脚本内注释）。

#### 在 Windows 下部署

##### 1. 准备环境

确保已安装以下工具：

- **Docker Desktop**（推荐）或 Podman Desktop 等支持 Docker Compose 的容器工具
- **Git**（可选，但强烈推荐，方便同步和管理代码）
- 如未安装 Git，也可直接通过 GitHub 网页点击 “Code” -> “Download ZIP” 下载项目源码，再解压到本地

##### 2. 获取项目代码

使用 Git（推荐）：

```powershell
git clone https://github.com/MoYoez/waken-wa.git
cd waken-wa
```

或手动下载 ZIP 并解压后进入项目目录。

##### 3. 配置环境变量

- 复制仓库中的 `.env.example` 为 `.env`，根据需要调整配置，一般来说你可以不用配置，定制化需要。

##### 4. 启动容器

如果只需直接运行官方镜像（无需自行编译），在项目根目录打开 PowerShell 或 CMD，执行：

```powershell
docker compose up -d
```

##### 5. 从源码自定义构建（如需源码修改或自定义镜像）

在项目根目录运行：

```powershell
docker compose up -d --build
```

##### 6. 其他说明

- 首次启动后可能会自动准备数据库和相关数据卷，无需手动操作
- 如需关闭服务，执行：`docker compose down`
- 升级项目可使用 Git 拉取最新代码后重启服务
- 如果遇到端口冲突、环境变量问题等，请参考仓库内文档或 issue 提问

---

### 2. Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/waken-wa)

> Railway 可能需要使用 Hobby 方案.

### 3. Vercel

> 需要使用 PostgresSQL (SupaBase / Neon) + Redis ，且开销较高 (SSE 长连接 / Realtime POST 多)

> 如需使用请考虑 非 Realtime 模式上传活动，并且在后台启用 Polling （轮询）

[![Deploy with Vercel](https://vercel.com/button)](
https://vercel.com/new/clone?repository-url=https://github.com/MoYoez/waken-wa
)

> 第一次部署后不用担心报错，在项目的 "Integrations" 中 通过 "Marketplace"找到 **PostgreSQL** 和 **Redis** 供应商，Install 后 Connect 到此项目，Redeploy 即可。

> 如果你想用自己的供应商，请在 env 的 DATABASE_URL 中 写入地址即可，请注意 Vercel 这类 Serverless 平台的URL兼容性，以防止部署失败。

## 开发

请参考 [**DEVELOPMENT.md**](DEVELOPMENT.md)

## API Reference

- Interactive Scalar docs: [`/api-reference`](./app/api-reference/route.ts)
- OpenAPI JSON: [`/api/openapi.json`](./app/api/openapi.json/route.ts)
- Device quickstart: [`docs/activity-reporting.md`](./docs/activity-reporting.md)
- Inspiration quickstart: [`docs/inspiration-integration.md`](./docs/inspiration-integration.md)

---

## License

本项目以 [**GNU Affero General Public License v3.0**](LICENSE)（AGPL-3.0）授权发布。完整条款见仓库根目录 [`LICENSE`](LICENSE)。

---

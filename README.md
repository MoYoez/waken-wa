<div align="right">
  <span>[<a href="./README_EN.md">English</a>]</span>
  <span>[<a href="./README.md">简体中文</a>]</span>
</div>

> 😴晨光里睁眼是醒，深夜写下"今天很好"也是醒。

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

<p align="center">
  <img src=".github/assets/Preview/preview_v2_image_main_core.png" alt="Preview core" width="720">
</p>


✨ 一个自托管的个人状态围观面板

🎗️把你的设备、听歌、应用、Steam、日程和随想，变成一个实时更新的个人主页

> 🌟项目灵感来源于 [Sleepy](https://github.com/sleepy-project/sleepy) 和 [Shiro](https://github.com/Innei/Shiro)

> ✨ 在这里查看 Demo！ [Status](https://Status-me.lemonkoi.one)

## 可以用来做什么？

### 🕵️ 自托管的赛博视奸面板

把你的在线状态、正在听的歌、使用中的应用、Steam 游戏、日程和随想，变成一个可以被朋友围观的实时主页。

### 🎨 不是普通状态页，而是个人数字生活展示

<p align="center">
  <img src=".github/assets/Preview/preview_v2_image_main_3.png" alt="Image-preview-main" width="620">
</p>

支持主题取色、背景定制、状态文案规则和个性化卡片，让页面更像“你的个人空间”，而不是冷冰冰的监控面板。

### 📡 多设备状态自动同步

<p align="center">
  <img src=".github/assets/Preview/preview_v2_image_main.png" alt="Image-preview-main" width="620">
</p>

通过 Reporter / API 上报桌面、移动端或脚本状态，自动展示你现在正在做什么。

### 🎵 支持音乐、应用、游戏和日程

<p align="center">
  <img src=".github/assets/Preview/preview_v2_image_main_2.png" alt="Image-preview-main_2" width="620">
</p>

不仅能显示在线 / 离线，还能展示听歌进度、当前应用、Steam 游戏、ICS 课表 / 日程等生活状态。

### 🧩 可嵌入、可扩展

<img src="https://status-me.lemonkoi.one/api/status-card?variant=cover&amp;cover=513f6faa-25db-407c-a23b-c45553524535&amp;coverRev=6fe63d7c874f9c62&amp;showHeader=1&amp;showAvatar=1&amp;showName=1&amp;showBio=1&amp;showNote=1&amp;preferGame=1&amp;showInClassStatus=1&amp;width=520&amp;height=220&amp;radius=20&amp;bg=%23FFFFFF&amp;fg=%23111827&amp;muted=%236B7280&amp;accent=%2322C55E&amp;border=%23E5E7EB" alt="当前状态" />

<br>

适合作为个人主页、BBS 签名卡、GitHub README 状态卡、朋友之间的“围观入口”，也可以通过 OpenAPI 和自定义规则扩展。


具体更多详情请查看： [Waken-Wa-Docs](https://waken-wa-docs.xwx.today)

## 部署

> 如果需要使用，请配合 [Waken-Wa-Reporter](https://github.com/MoYoez/waken-wa-reporter)

### 1. 本机部署

#### Docker（使用已打包的一键脚本）

需已安装 **Docker**（含 `docker compose`）。在终端执行：

```bash
curl -fsSL https://waken-wa.xwx.today | bash
```

如果你想部署最新的 `main` 分支版本，可以显式启用：

```bash
curl -fsSL https://waken-wa.xwx.today | USE_LATEST_VERSION=1 bash
```

#### 自编译（源码）

在已克隆的本仓库根目录执行：

```bash
chmod +x deploy-build-from-source.sh   # Unix 首次需要
./deploy-build-from-source.sh
# 或: bash deploy-build-from-source.sh
```

#### 在 Windows 下部署

##### 1. 准备环境

- **Docker Desktop**（推荐）或 Podman Desktop 等支持 Docker Compose 的容器工具

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

如果只需直接运行官方镜像，在项目根目录打开 PowerShell 或 CMD，执行：

```powershell
docker compose up -d
```

##### 5. 从源码自定义构建（如需源码修改或自定义镜像）

在项目根目录运行：

```powershell
docker compose up -d --build
```

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
- Public embeds & feeds: [`docs/public-endpoints.md`](./docs/public-endpoints.md)


## Star History

<a href="https://www.star-history.com/?repos=moyoez%2Fwaken-wa&type=date&logscale=&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=moyoez/waken-wa&type=date&theme=dark&logscale&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=moyoez/waken-wa&type=date&logscale&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=moyoez/waken-wa&type=date&logscale&legend=top-left" />
 </picture>
</a>

---

## License

本项目以 [**GNU Affero General Public License v3.0**](LICENSE)（AGPL-3.0）授权发布。完整条款见仓库根目录 [`LICENSE`](LICENSE)。

## Thanks

本项目在 [**LINUX DO**](https://linux.do/) 上宣发，感谢支持！

---

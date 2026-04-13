<div align="right">
  <span>[<a href="./README_EN.md">English</a>]</span>
  <span>[<a href="./README.md">简体中文</a>]</span>
</div>

> Not jolted awake by an alarm, but gently and willingly meeting the world again.

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

✨ One note a day, one awakening at a time. | A highly customizable, clean, AI-friendly personal life dashboard.

> 😴 Opening your eyes in the morning is waking up. Writing "today was good" late at night is waking up, too.

> 🌟 Inspired by [Sleepy](https://github.com/sleepy-project/sleepy) and [Shiro](https://github.com/Innei/Shiro)

## Features 🌟

1. 🖥️ Full Web UI support for fast server-side setup and launch
2. 🤖 AI Skills / MCP friendly configuration assistance
3. 🧩 Flexible rules for showing status and content
4. 🎨 Theme color extraction, backgrounds, and personal visual customization
5. 📡 Automatic status sync across multiple platforms
6. 🎵 Music, app, and Steam game activity display
7. 🗓️ ICS calendar / timetable integration
8. ✍️ Inspiration notes, idea records, and long-term content collection
9. 🔒 Access lock, hCaptcha, and admin management

## Gallery

<table>
  <tr>
    <td><img src=".github/assets/Preview/preview_main.png" alt="Waken Wa home page" width="100%"></td>
    <td><img src=".github/assets/Preview/preview_inspiration.png" alt="Waken Wa inspiration page" width="100%"></td>
  </tr>
  <tr>
    <td align="center"><strong>Personal Status Home</strong></td>
    <td align="center"><strong>Inspiration and Notes</strong></td>
  </tr>
  <tr>
    <td><img src=".github/assets/Preview/preview_setting0.png" alt="Waken Wa site settings" width="100%"></td>
    <td><img src=".github/assets/Preview/preview_setting1.png" alt="Waken Wa admin configuration" width="100%"></td>
  </tr>
  <tr>
    <td align="center"><strong>Site Appearance Settings</strong></td>
    <td align="center"><strong>Admin Dashboard</strong></td>
  </tr>
</table>

---

## Deployment

> To use activity reporting, pair this project with [Waken-Wa-Reporter](https://github.com/MoYoez/waken-wa-reporter).

### 1. Local Deployment

#### Docker With the Packaged One-Line Script

Make sure **Docker** is installed, including `docker compose`. Then run:

```bash
curl -fsSL https://wakeme.lemonkoi.one | sh
```

> The script pulls the project and starts it with Compose. By default it uses a SQLite data volume. See `docker-compose.yml` for details. Environment variables can be configured from [`.env.example`](.env.example), or by editing `.env` in the deployment directory.

#### Build From Source

Run the following from the root of a cloned repository. **Git** and **Docker** are required.

```bash
chmod +x deploy-build-from-source.sh   # Required on Unix for the first run
./deploy-build-from-source.sh
# Or: bash deploy-build-from-source.sh
```

> The script prepares `.env` by copying from `.env.example` when needed, generates `JWT_SECRET` when appropriate, and runs `docker compose up -d --build`. You can also set environment variables such as `WAKEN_BRANCH`, `WAKEN_REPO_URL`, and `WAKEN_DEPLOY_DIR`; see the script comments for details.

#### Deploy on Windows

##### 1. Prepare the Environment

Make sure the following tools are installed:

- **Docker Desktop** is recommended. Podman Desktop or another Docker Compose compatible container tool can also work.
- **Git** is optional, but strongly recommended for syncing and managing source code.
- If Git is not installed, you can use GitHub's “Code” -> “Download ZIP” option and extract the project locally.

##### 2. Get the Source Code

Using Git is recommended:

```powershell
git clone https://github.com/MoYoez/waken-wa.git
cd waken-wa
```

Alternatively, download the ZIP archive and enter the extracted project directory.

##### 3. Configure Environment Variables

- Copy `.env.example` to `.env`, then adjust it as needed. In most basic deployments, no extra configuration is required unless you want customization.

##### 4. Start the Container

If you only want to run the official image without building from source, open PowerShell or CMD in the project root and run:

```powershell
docker compose up -d
```

##### 5. Build From Source

If you changed the source code or want to build a custom image, run:

```powershell
docker compose up -d --build
```

##### 6. Notes

- The first startup may automatically prepare the database and related data volumes.
- To stop the service, run `docker compose down`.
- To upgrade, pull the latest source code with Git and restart the service.
- If you run into port conflicts or environment variable issues, check the repository docs or open an issue.

---

### 2. Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/waken-wa)

> Railway may require a Hobby plan.

### 3. Vercel

> Vercel deployment requires PostgreSQL (Supabase / Neon) and Redis. It may be relatively costly because of SSE long connections and frequent realtime POST requests.

> If you deploy on Vercel, consider using non-realtime activity uploads and enabling Polling in the admin panel.

[![Deploy with Vercel](https://vercel.com/button)](
https://vercel.com/new/clone?repository-url=https://github.com/MoYoez/waken-wa
)

> If the first deployment fails, do not panic. In the project's "Integrations" page, open "Marketplace", install and connect a **PostgreSQL** provider and a **Redis** provider, then redeploy.

> If you prefer your own provider, set its URL in the `DATABASE_URL` environment variable. Pay attention to URL compatibility on serverless platforms such as Vercel to avoid deployment failures.

## Development

See [**DEVELOPMENT.md**](DEVELOPMENT.md).

## API Reference

- Interactive Scalar docs: [`/api-reference`](./app/api-reference/route.ts)
- OpenAPI JSON: [`/api/openapi.json`](./app/api/openapi.json/route.ts)
- Device quickstart: [`docs/activity-reporting.md`](./docs/activity-reporting.md)
- Inspiration quickstart: [`docs/inspiration-integration.md`](./docs/inspiration-integration.md)

---

## License

This project is licensed under the [**GNU Affero General Public License v3.0**](LICENSE) (AGPL-3.0). See [`LICENSE`](LICENSE) in the repository root for the full license text.

---

# Development

## Tech Stack

- **Next.js** 16.2 with App Router
- **React** 19.2 / **React DOM** 19.2
- **TypeScript** ~5.9
- **Tailwind CSS** 4.x with `@tailwindcss/postcss`
- **Drizzle ORM** + **Drizzle Kit**, using **SQLite** through better-sqlite3 or **PostgreSQL** through pg depending on the environment
- **Redis** 7.0
- **Radix UI**, **Zod**, **react-hook-form**, **jose** for JWT, and **bcryptjs**

## Quick Start

### Requirements

- **Local development:** Node.js 20+
- **Package manager:** this repository primarily uses **pnpm**. npm or yarn may also work, but pnpm is the expected path.
- **Optional:** Docker. The image is based on **Node.js 22**; see the root `Dockerfile`.

### Install and Run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> To use activity reporting, pair this project with [Waken-Wa-Reporter](https://github.com/MoYoez/waken-wa-reporter).

### Environment Variables

Copy [`.env.example`](.env.example) to `.env` or `.env.local`, then fill in the values you need. Common variables:

- **`DATABASE_URL`** — defaults to SQLite, for example `file:./data/dev.db`; use `postgres://` or `postgresql://` for production PostgreSQL.
- **`JWT_SECRET`** — signs admin sessions. If unset, it is generated automatically. In Docker, an empty value creates a persistent secret file at `/app/data/.jwt_secret`.
- **`NEXT_PUBLIC_BASE_URL`** — public site URL, useful behind a reverse proxy or in production.
- **`STEAM_API_KEY`** — optional Steam Web API key. It can also be configured from the admin panel under site settings.
- **`HCAPTCHA_*`** — optional site access lock configuration.

Avatar, nickname, bio, and related profile fields are configured from **`/admin` site settings** or during first-time setup.

### Build

```bash
pnpm build
pnpm start
```

## API Docs

- Interactive API reference: `/api-reference`
- OpenAPI JSON: `/api/openapi.json`
- Device integration guide: [`docs/activity-reporting.md`](./docs/activity-reporting.md)
- Inspiration integration guide: [`docs/inspiration-integration.md`](./docs/inspiration-integration.md)

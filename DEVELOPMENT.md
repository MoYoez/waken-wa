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

## Site Settings Storage

Site settings have two storage layers:

- **Legacy row:** `site_config` in `drizzle/schema.sqlite.ts` and `drizzle/schema.pg.ts`. This exists for setup, old deployments, and compatibility reads.
- **Migrated/v2 storage:** `site_config_v2_entries` for core key/value settings, plus split tables for theme, schedule, and rule settings. Admin category routes write through `lib/site-settings-write.ts`, and reads are composed in `lib/site-settings-read.ts`.

When adding a new site setting key:

- If the key is only meant for migrated settings, do **not** add a column to legacy `site_config`.
- Give old data a runtime default in `lib/site-config-normalize.ts`, the admin form initial state, and the frontend consumer.
- Add the key to `prepareSiteConfigValuesFromPayload()` in `lib/llm-site-config.ts` so `/api/admin/settings/core` can persist it.
- If the key must not be editable before migration, add it to `SITE_SETTINGS_MIGRATED_CORE_KEYS` in `lib/site-settings-constants.ts`; `persistCoreSettingsFromPrepared()` will reject it until migration is complete.
- Keep import/export and API docs in sync when the setting is user-facing.

Only change both Drizzle schemas when adding real database structure or a field that must be persisted by the legacy table before migration.

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

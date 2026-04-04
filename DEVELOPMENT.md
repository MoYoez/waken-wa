# 关于开发

## 技术栈

- **Next.js** 16.2（App Router）
- **React** 19.2 / **React DOM** 19.2
- **TypeScript** ~5.9
- **Tailwind CSS** 4.x（`@tailwindcss/postcss`）
- **Drizzle ORM** + **Drizzle Kit**，数据库按环境使用 **SQLite**（better-sqlite3）或 **PostgreSQL**（pg）
- **Redis** 7.0
- **Radix UI**、**Zod**、**react-hook-form**、**jose**（JWT）、**bcryptjs**

## 快速开始

### 环境要求

- **本地开发：** Node.js 20+
- **包管理：** 仓库以 **pnpm** 为主（也可用 npm / yarn）
- **可选：** Docker（镜像基于 **Node.js 22**，见根目录 `Dockerfile`）

### 安装与运行

```bash
pnpm install
pnpm dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

> 如果需要使用，请配合 [Waken-Wa-Reporter](https://github.com/MoYoez/waken-wa-reporter)

### 环境变量

复制 [`.env.example`](.env.example) 为 `.env` / `.env.local` 并按需填写。常见项：

- **`DATABASE_URL`** — 默认 SQLite（如 `file:./drizzle/dev.db`）；生产可改为 `postgres://` / `postgresql://`
- **`JWT_SECRET`** — 管理会话签名；不设置则默认自动生成。Docker 下留空时会在数据卷中生成持久化密钥文件
- **`NEXT_PUBLIC_BASE_URL`** — 站点对外访问地址（反向代理或生产域名）
- **`STEAM_API_KEY`** — Steam Web API 可选；也可在管理后台「站点设置」中配置
- **`HCAPTCHA_*`** — 整站访问锁可选

头像、昵称、简介等通过 **`/admin` 站点设置**（或首次 setup）配置。

### 构建

```bash
pnpm build
pnpm start
```

## API 文档

- 交互式 API 参考：`/api-reference`
- OpenAPI JSON：`/api/openapi.json`
- 设备接入说明：[`docs/activity-reporting.md`](./docs/activity-reporting.md)
- 灵感接入说明：[`docs/inspiration-integration.md`](./docs/inspiration-integration.md)

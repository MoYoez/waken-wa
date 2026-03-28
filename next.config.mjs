import { pickPostgresUrl } from './scripts/prisma-resolve-env.mjs'

// Prisma postgres schema expects DATABASE_URL; Vercel often only sets POSTGRES_* vars.
const _pg = pickPostgresUrl()
if (_pg && !process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = _pg
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['ical.js'],
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

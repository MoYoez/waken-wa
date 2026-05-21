import bundleAnalyzer from '@next/bundle-analyzer'

import { pickPostgresUrl } from './scripts/resolve-database-env.mjs'

const _pg = pickPostgresUrl()
if (_pg && !process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = _pg
}

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['ical.js'],
  serverExternalPackages: ['pg', 'better-sqlite3'],
  outputFileTracingIncludes: {
    '/*': ['./drizzle/**/*', './styles/theme-presets/**/*'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default withBundleAnalyzer(nextConfig)

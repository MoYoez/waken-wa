/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['ical.js'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

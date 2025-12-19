import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['forge-inspector'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Enable static export for CLI distribution
  output: 'export',
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
}

export default nextConfig

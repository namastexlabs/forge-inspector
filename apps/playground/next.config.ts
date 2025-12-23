import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['forge-inspector'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  allowedDevOrigins: ['http://127.0.0.1:*', 'http://localhost:*'],
}

export default nextConfig

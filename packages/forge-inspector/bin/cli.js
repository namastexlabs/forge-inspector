#!/usr/bin/env node

import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PLAYGROUND_DIR = join(__dirname, '../playground')

const DEFAULT_PORT = 3333

async function startPlayground() {
  const port = process.env.PORT || DEFAULT_PORT

  // Check if playground build exists
  if (!existsSync(join(PLAYGROUND_DIR, 'index.html'))) {
    console.error('Playground not found. This feature requires the playground to be bundled.')
    console.error('For development, run: pnpm dev (from the repo root)')
    process.exit(1)
  }

  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }

  const server = createServer((req, res) => {
    const urlPath = req.url.split('?')[0] // Remove query string
    let filePath

    if (urlPath === '/') {
      filePath = join(PLAYGROUND_DIR, 'index.html')
    } else if (urlPath.includes('.')) {
      // Has file extension, serve directly
      filePath = join(PLAYGROUND_DIR, urlPath)
    } else {
      // No extension - try .html suffix (Next.js static export pattern)
      filePath = join(PLAYGROUND_DIR, urlPath + '.html')
      if (!existsSync(filePath)) {
        // Try as directory with index.html
        filePath = join(PLAYGROUND_DIR, urlPath, 'index.html')
      }
      if (!existsSync(filePath)) {
        // Fallback to main index.html for SPA routing
        filePath = join(PLAYGROUND_DIR, 'index.html')
      }
    }

    const ext = filePath.substring(filePath.lastIndexOf('.'))
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    try {
      const content = readFileSync(filePath)
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(content)
    } catch (err) {
      res.writeHead(404)
      res.end('Not found')
    }
  })

  server.listen(port, () => {
    console.log(`
  Forge Inspector Playground

  Local:   http://localhost:${port}

  Load any URL with forge-inspector installed to test element picking.
  Press Ctrl+C to stop.
`)
  })
}

startPlayground().catch(console.error)

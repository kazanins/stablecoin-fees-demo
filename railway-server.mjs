import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT ?? 3000)
const DIST_DIR = join(process.cwd(), 'dist')

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function contentType(filePath) {
  return MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function sendFile(res, filePath, statusCode = 200) {
  const type = contentType(filePath)
  const isHtml = type.startsWith('text/html')

  res.writeHead(statusCode, {
    'Content-Type': type,
    'Cache-Control': isHtml
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=31536000, immutable',
  })

  createReadStream(filePath).pipe(res)
}

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const pathname = decodeURIComponent(url.pathname)

    if (!existsSync(DIST_DIR)) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Missing dist/. Run `npm run build` before starting server.')
      return
    }

    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    const requested = normalize(pathname).replace(/^\/+/, '')
    let filePath = join(DIST_DIR, requested)

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      sendFile(res, filePath)
      return
    }

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      const indexPath = join(filePath, 'index.html')
      if (existsSync(indexPath)) {
        sendFile(res, indexPath)
        return
      }
    }

    // SPA fallback
    const spaEntry = join(DIST_DIR, 'index.html')
    sendFile(res, spaEntry)
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Internal server error')
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`tempo-fees listening on http://0.0.0.0:${PORT}`)
})

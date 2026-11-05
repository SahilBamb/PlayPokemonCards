// Tiny static host for dist/ — no extra dependencies, so Railway can run
// `npm start` after `npm run build` even if production installs skip Vite.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const PORT = Number(process.env.PORT ?? 4173)
const APP_ROUTES = new Set(['/', '/card-opener', '/card-opener/', '/story-mode', '/story-mode/'])
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
}

const server = http.createServer((req, res) => {
  let url
  try {
    const target = req.url ?? '/'
    if (!target.startsWith('/')) throw new Error('Expected a local path')
    url = decodeURIComponent(new URL('http://localhost' + target).pathname)
  }
  catch {
    res.writeHead(400)
    return res.end()
  }
  let file = path.resolve(DIST, '.' + url)
  if (file !== DIST && !file.startsWith(DIST + path.sep)) {
    res.writeHead(404)
    return res.end()
  }
  let status = 200
  if (APP_ROUTES.has(url)) file = path.join(DIST, 'index.html')
  else if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    file = path.join(DIST, '404.html')
    status = 404
  }
  if (url === '/404.html') status = 404
  const ext = path.extname(file)
  res.writeHead(status, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    ...(status === 404 ? { 'Cache-Control': 'no-store' } : {}),
  })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(file).pipe(res)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PlayPokemonCards serving ${DIST} on :${PORT}`)
})

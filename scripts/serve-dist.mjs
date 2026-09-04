// Tiny static host for dist/ — no extra dependencies, so Railway can run
// `npm start` after `npm run build` even if production installs skip Vite.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const PORT = Number(process.env.PORT ?? 4173)
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
  const url = decodeURIComponent((req.url ?? '/').split('?')[0])
  let file = path.join(DIST, url === '/' ? 'index.html' : url)
  if (!file.startsWith(DIST)) {
    res.writeHead(403)
    return res.end()
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(DIST, 'index.html')
  }
  const ext = path.extname(file)
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PlayPokemonCards serving ${DIST} on :${PORT}`)
})

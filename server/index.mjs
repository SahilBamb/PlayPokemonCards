// PlayPokemonCards multiplayer server (Colyseus + Express).
//   node server/index.mjs            → listens on $PORT (default 2567)
// Rooms:
//   'ranked'  — matchmaking queue, Elo on the line
//   'private' — friendly matches joined by a share code
// HTTP:
//   GET /health       → { ok }
//   GET /leaderboard  → { total, top: [...], bottom: [...] }
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { Server } from 'colyseus'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { PrivateMatchRoom, RankedMatchRoom, ONLINE_FORMAT } from './rooms.mjs'
import { leaderboard } from './players.mjs'

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')

export function createApp() {
  const app = express()
  // Allow the web client to call the HTTP API from a different origin
  // (Vite dev server / separate static host).
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    next()
  })
  app.get('/health', (req, res) => res.json({ ok: true, format: ONLINE_FORMAT.name }))
  app.get('/leaderboard', (req, res) => {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10))
    res.json(leaderboard(limit))
  })
  // If the web client has been built (npm run build), serve it too — a single
  // Railway service then hosts both the game and its multiplayer server.
  if (fs.existsSync(DIST)) {
    app.use(express.static(DIST))
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next()
      res.sendFile(path.join(DIST, 'index.html'))
    })
  }
  return app
}

export async function startServer(port = Number(process.env.PORT ?? 2567)) {
  const server = http.createServer(createApp())
  const gameServer = new Server({ transport: new WebSocketTransport({ server }) })
  gameServer.define('ranked', RankedMatchRoom)
  gameServer.define('private', PrivateMatchRoom).filterBy(['code'])
  await gameServer.listen(port)
  console.log(`PlayPokemonCards server listening on :${port} (format: ${ONLINE_FORMAT.name})`)
  return gameServer
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  startServer()
}

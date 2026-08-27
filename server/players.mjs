// Persistent player registry for ranked play: identity (id + secret token),
// Elo rating, and win/loss record. Backed by a single JSON file so the server
// has zero database dependencies — point DATA_DIR at a mounted volume in
// production (Railway) so ratings survive redeploys.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = process.env.DATA_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')
const FILE = path.join(DATA_DIR, 'players.json')

export const STARTING_ELO = 1000
const K_FACTOR = 32

let players = null

function load() {
  if (players) return players
  try {
    players = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    players = {}
  }
  return players
}

// Atomic write (tmp + rename) so a crash mid-save can't corrupt the file.
function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const tmp = `${FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(players, null, 2))
  fs.renameSync(tmp, FILE)
}

// The client generates a random id + token once and stores them in
// localStorage. The token acts as a lightweight password: whoever presented
// it first owns that id. Names may change between sessions.
export function authPlayer({ playerId, token, name }) {
  if (!playerId || !token) throw new Error('Missing player credentials.')
  const all = load()
  const existing = all[playerId]
  if (existing) {
    if (existing.token !== token) throw new Error('Invalid credentials for this player id.')
    existing.name = name || existing.name
  } else {
    all[playerId] = { name: name || 'Trainer', token, elo: STARTING_ELO, wins: 0, losses: 0 }
  }
  save()
  return { playerId, ...publicRecord(playerId) }
}

export function eloOf(playerId) {
  return load()[playerId]?.elo ?? STARTING_ELO
}

function publicRecord(playerId) {
  const p = load()[playerId]
  if (!p) return null
  return { name: p.name, elo: p.elo, wins: p.wins, losses: p.losses }
}

// Standard Elo with K=32. Returns per-player deltas so the room can report
// "+14 / −14" to the clients.
export function recordRankedResult(winnerId, loserId) {
  const all = load()
  const w = all[winnerId]
  const l = all[loserId]
  if (!w || !l) throw new Error('Unknown ranked player.')
  const expectedW = 1 / (1 + 10 ** ((l.elo - w.elo) / 400))
  const delta = Math.max(1, Math.round(K_FACTOR * (1 - expectedW)))
  w.elo += delta
  l.elo = Math.max(0, l.elo - delta)
  w.wins += 1
  l.losses += 1
  save()
  return {
    [winnerId]: { delta, elo: w.elo },
    [loserId]: { delta: -delta, elo: l.elo },
  }
}

// Best and worst rated players (only those who've completed a ranked match).
export function leaderboard(limit = 10) {
  const rated = Object.entries(load())
    .filter(([, p]) => p.wins + p.losses > 0)
    .map(([id, p]) => ({ id, name: p.name, elo: p.elo, wins: p.wins, losses: p.losses }))
    .sort((a, b) => b.elo - a.elo)
  return {
    total: rated.length,
    top: rated.slice(0, limit),
    // Worst players, never overlapping with the top list.
    bottom: rated.slice(Math.max(limit, rated.length - limit)).reverse(),
  }
}

// Test seam: point the store at a scratch directory.
export function _resetForTests() {
  players = null
}

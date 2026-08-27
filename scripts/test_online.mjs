// Online multiplayer smoke test: boots the real Colyseus server, connects two
// colyseus.js clients, and plays full games driven only by the server-provided
// legal-action lists (exactly what the browser client sees).
//   1. deck validation rejects an illegal deck
//   2. a private match (by share code) plays to completion, no Elo
//   3. a ranked match plays to completion, Elo + leaderboard update
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ppc-online-'))

const { startServer } = await import('../server/index.mjs')
const { Client } = await import('colyseus.js')
const { DECKS } = await import('../src/engine/cards.js')

const PORT = 2601
const URL = `ws://localhost:${PORT}`
const HTTP = `http://localhost:${PORT}`
const gameServer = await startServer(PORT)

const deckA = DECKS.blazeSurf.list
const deckB = DECKS.jungleMind.list

// Wrap a joined room with the bookkeeping the driver loop needs.
function track(room, label) {
  const t = { room, label, payload: null, version: 0, result: null, started: null }
  room.onMessage('view', (p) => {
    t.payload = p
    t.version++
  })
  room.onMessage('start', (m) => (t.started = m))
  room.onMessage('result', (m) => (t.result = m))
  room.onMessage('opp-disconnected', () => {})
  room.onMessage('opp-reconnected', () => {})
  return t
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitFor(fn, what, timeoutMs = 15000) {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${what}`)
    await sleep(10)
  }
}

// Random-but-goal-directed action picker so games actually end: attack when
// possible, cap dithering per turn, then end the turn.
function pickAction(actions, movesThisTurn) {
  const attack = actions.filter((a) => a.type === 'attack')
  const endTurn = actions.find((a) => a.type === 'end-turn')
  if (movesThisTurn > 25 && endTurn) return endTurn
  if (attack.length && Math.random() < 0.7) return attack[Math.floor(Math.random() * attack.length)]
  const rest = actions.filter((a) => a.type !== 'end-turn' && a.type !== 'concede')
  if (rest.length && Math.random() < 0.85) return rest[Math.floor(Math.random() * rest.length)]
  return endTurn ?? actions[0]
}

async function playToCompletion(a, b, maxSteps = 6000) {
  const moves = { [a.label]: 0, [b.label]: 0 }
  for (let step = 0; step < maxSteps; step++) {
    if (a.result && b.result) return
    const actor = [a, b].find((t) => !t.result && t.payload?.actions?.length)
    if (!actor) {
      await sleep(15)
      continue
    }
    const before = actor.version
    const action = pickAction(actor.payload.actions, moves[actor.label]++)
    if (action.type === 'end-turn') moves[actor.label] = 0
    actor.room.send('action', action)
    // Wait for the server to answer with a fresh view (or the result).
    await waitFor(() => actor.version > before || actor.result, `view after ${action.type}`, 10000)
  }
  throw new Error(`Game did not finish within ${maxSteps} steps`)
}

let failures = 0
async function test(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (e) {
    failures++
    console.error(`FAIL ${name}`)
    console.error(`  ${e.message}`)
  }
}

await test('illegal decks are rejected on join', async () => {
  const client = new Client(URL)
  await assert.rejects(
    client.create('private', { code: 'BADDECK', name: 'Cheater', deck: deckA.slice(0, 59) }),
    /Deck is not legal/
  )
})

await test('private match by code plays to completion without Elo', async () => {
  const clientA = new Client(URL)
  const clientB = new Client(URL)
  const code = 'TEST42'
  const roomA = await clientA.create('private', { code, name: 'Ash', deck: deckA })
  const a = track(roomA, 'A')
  const roomB = await clientB.join('private', { code, name: 'Gary', deck: deckB })
  const b = track(roomB, 'B')

  await waitFor(() => a.started && b.started, 'both start messages')
  assert.equal(a.started.ranked, false)
  assert.equal(a.started.code, code)
  assert.equal(a.started.opponent.name, 'Gary')
  assert.equal(b.started.opponent.name, 'Ash')

  await waitFor(() => a.payload && b.payload, 'initial views')
  // Each client sees itself as p1 and its opponent's hand hidden.
  for (const t of [a, b]) {
    assert.equal(t.payload.view.mode, 'match')
    assert.ok(t.payload.view.p1.hand.every((c) => !c.hidden), `${t.label} sees own hand`)
    assert.ok(t.payload.view.p2.hand.every((c) => c.hidden), `${t.label} cannot see opponent hand`)
    assert.ok(t.payload.view.p1.deck.every((c) => c.hidden), `${t.label} cannot see own deck order`)
  }

  await playToCompletion(a, b)
  assert.notEqual(a.result.youWon, b.result.youWon, 'exactly one winner')
  assert.equal(a.result.elo, null, 'private matches carry no Elo')
  await roomA.leave()
  await roomB.leave()
})

await test('ranked match updates Elo and the leaderboard', async () => {
  const credsA = { playerId: 'test-player-a', token: 'secret-a', name: 'RankedAsh' }
  const credsB = { playerId: 'test-player-b', token: 'secret-b', name: 'RankedGary' }
  const clientA = new Client(URL)
  const clientB = new Client(URL)
  const roomA = await clientA.joinOrCreate('ranked', { ...credsA, deck: deckA })
  const a = track(roomA, 'A')
  const roomB = await clientB.joinOrCreate('ranked', { ...credsB, deck: deckB })
  const b = track(roomB, 'B')

  await waitFor(() => a.started && b.started, 'both start messages')
  assert.equal(a.started.ranked, true)
  assert.equal(a.started.you.elo, 1000)

  await playToCompletion(a, b)
  const winner = a.result.youWon ? a : b
  const loser = a.result.youWon ? b : a
  assert.ok(winner.result.elo.delta > 0, 'winner gains Elo')
  assert.ok(loser.result.elo.delta < 0, 'loser drops Elo')
  assert.equal(winner.result.elo.elo, 1000 + winner.result.elo.delta)

  const lb = await fetch(`${HTTP}/leaderboard`).then((r) => r.json())
  assert.equal(lb.total, 2)
  assert.equal(lb.top[0].elo, winner.result.elo.elo)
  assert.equal(lb.top[0].wins, 1)
  await roomA.leave()
  await roomB.leave()
})

await test('wrong token is rejected for a known player id', async () => {
  const client = new Client(URL)
  await assert.rejects(
    client.joinOrCreate('ranked', { playerId: 'test-player-a', token: 'wrong', name: 'Imposter', deck: deckA }),
    /Invalid credentials/
  )
})

await gameServer.gracefullyShutdown(false).catch(() => {})
console.log(failures ? `\n${failures} test(s) failed` : '\nAll online tests passed')
process.exit(failures ? 1 : 0)

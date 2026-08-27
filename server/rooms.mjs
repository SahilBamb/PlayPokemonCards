// Server-authoritative match rooms. The full game state lives here and is
// advanced with the same reducer the single-player game uses. Clients only
// ever receive maskStateFor(state, seat) views — and to keep the React board
// 100% reusable, each client is always shown the game from the "p1" seat:
// for the player actually seated as p2 we swap every p1/p2 token in the
// outgoing view (and in their incoming actions).
import { Room } from 'colyseus'
import { reducer, initialMatchState, pendingClickTargets } from '../src/engine/reducer.js'
import { maskStateFor } from '../src/engine/view.js'
import { enumerateActions } from '../src/engine/actions.js'
import { actorOf } from '../src/engine/match.js'
import { validateDeck, DECK_SIZE } from '../src/lib/deckStore.js'
import { DEFAULT_FORMAT } from '../src/data/sets.js'
import { authPlayer, recordRankedResult, eloOf } from './players.mjs'

// One online mode for now: everything through Gym Heroes / Gym Challenge
// (the pre-rotation "Classic" pool the Deck Editor builds against).
export const ONLINE_FORMAT = DEFAULT_FORMAT

const RECONNECT_GRACE_SECONDS = 60

// Action types a client may submit. Everything else (fx-done, reset,
// debug-spawn, toggle-turn-rules, …) is server-internal or sandbox-only.
// view-zone / close-view are handled locally by the online client.
const CLIENT_ACTIONS = new Set([
  'setup-done',
  'concede',
  'drop',
  'attack',
  'play-trainer',
  'use-power',
  'retreat',
  'use-stadium',
  'discard-doll',
  'end-turn',
  'click',
  'resolve-choice',
  'skip-choice',
  'close-reveal',
])

// Perspective swap: rewrite every p1/p2 token (object keys, refs, log lines)
// so the receiving client sees itself as p1. Player-provided names are
// sanitized on join so the token swap can't mangle them.
const swapSeatTokens = (obj) => JSON.parse(JSON.stringify(obj).replace(/p1|p2/g, (m) => (m === 'p1' ? 'p2' : 'p1')))

const sanitizeName = (name) =>
  String(name ?? 'Trainer')
    .replace(/p1|p2/g, 'P')
    .replace(/[^\p{L}\p{N} ._'-]/gu, '')
    .trim()
    .slice(0, 24) || 'Trainer'

function deckProblems(list) {
  if (!Array.isArray(list) || list.length !== DECK_SIZE) return [`A deck needs exactly ${DECK_SIZE} cards.`]
  const counts = {}
  for (const name of list) {
    if (typeof name !== 'string') return ['Malformed deck list.']
    counts[name] = (counts[name] ?? 0) + 1
  }
  return validateDeck(counts, null, ONLINE_FORMAT)
}

export class MatchRoom extends Room {
  maxClients = 2
  ranked = false

  onCreate(options) {
    if (options?.code) this.setMetadata({ code: String(options.code).toUpperCase() })
    this.seats = new Map() // sessionId -> 'p1' | 'p2'
    this.joined = {} // seat -> { name, deck, playerId }
    this.game = null
    this.settled = false
    this.onMessage('action', (client, message) => this.handleAction(client, message))
  }

  onJoin(client, options = {}) {
    const problems = deckProblems(options.deck)
    if (problems.length) throw new Error(`Deck is not legal: ${problems[0]}`)
    const name = sanitizeName(options.name)

    let playerId = null
    if (this.ranked) {
      // Throws on bad credentials; also registers first-time players.
      playerId = authPlayer({ playerId: options.playerId, token: options.token, name }).playerId
      const taken = Object.values(this.joined).some((j) => j.playerId === playerId)
      if (taken) throw new Error('You are already seated in this match.')
    }

    // First joiner gets a random seat so neither side always goes first.
    const open = ['p1', 'p2'].filter((s) => !this.joined[s])
    const seat = open[Math.floor(Math.random() * open.length)]
    this.seats.set(client.sessionId, seat)
    this.joined[seat] = { name, deck: options.deck, playerId }

    if (Object.keys(this.joined).length === 2) {
      this.lock()
      this.startMatch()
    }
  }

  startMatch() {
    this.game = initialMatchState({
      p1DeckList: this.joined.p1.deck,
      p1DeckName: this.joined.p1.name,
      p2DeckList: this.joined.p2.deck,
      p2DeckName: this.joined.p2.name,
    })
    this.drainFx()
    for (const client of this.clients) {
      const seat = this.seats.get(client.sessionId)
      const opp = seat === 'p1' ? 'p2' : 'p1'
      client.send('start', {
        ranked: this.ranked,
        code: this.metadata?.code ?? null,
        you: { name: this.joined[seat].name, elo: this.ranked ? eloOf(this.joined[seat].playerId) : null },
        opponent: { name: this.joined[opp].name, elo: this.ranked ? eloOf(this.joined[opp].playerId) : null },
      })
    }
    this.broadcastViews()
  }

  // The engine pauses its effects queue while fx events wait for the client
  // FX player. Online games run without engine-driven animation pauses, so
  // pop any fx immediately (fxEnabled defaults to off; this is a belt-and-
  // braces guard).
  drainFx() {
    let guard = 0
    while (this.game.fxQueue?.length && guard++ < 1000) {
      this.game = reducer(this.game, { type: 'fx-done' })
    }
  }

  apply(action) {
    this.game = reducer(this.game, action)
    this.drainFx()
  }

  handleAction(client, raw) {
    if (!this.game || this.game.phase === 'gameover') return
    const seat = this.seats.get(client.sessionId)
    if (!seat) return
    // p2's client believes it is p1 — translate its action into real seats.
    const action = seat === 'p2' ? swapSeatTokens(raw) : raw
    if (!action || !CLIENT_ACTIONS.has(action.type)) return

    // Identity checks; illegal-by-rules actions are rejected by matchGuard
    // inside the reducer itself.
    const actor = actorOf(action)
    if (actor && actor !== seat && action.type !== 'click') return
    if (action.type === 'click' && action.actor !== seat) return
    if ((action.type === 'resolve-choice' || action.type === 'skip-choice') && this.game.pending?.chooserPlayer !== seat) return
    if (action.type === 'close-reveal' && this.game.reveal?.player !== seat) return
    if (action.type === 'concede') action.player = seat

    this.apply(action)
    this.broadcastViews()
  }

  broadcastViews() {
    for (const client of this.clients) {
      const seat = this.seats.get(client.sessionId)
      if (!seat) continue
      const payload = {
        view: maskStateFor(this.game, seat),
        // Click targets for the pending choice, only for whoever must answer.
        targets: this.game.pending?.chooserPlayer === seat ? pendingClickTargets(this.game) : [],
        // Legal actions for this seat — powers the client's UI affordances.
        actions: enumerateActions(this.game, seat),
      }
      client.send('view', seat === 'p2' ? swapSeatTokens(payload) : payload)
    }
    if (this.game.phase === 'gameover') this.finish()
  }

  finish() {
    if (this.settled) return
    this.settled = true
    const winnerSeat = this.game.winner
    const loserSeat = winnerSeat === 'p1' ? 'p2' : 'p1'
    let eloBySeat = null
    if (this.ranked && this.joined[winnerSeat]?.playerId && this.joined[loserSeat]?.playerId) {
      const result = recordRankedResult(this.joined[winnerSeat].playerId, this.joined[loserSeat].playerId)
      eloBySeat = {
        [winnerSeat]: result[this.joined[winnerSeat].playerId],
        [loserSeat]: result[this.joined[loserSeat].playerId],
      }
    }
    for (const client of this.clients) {
      const seat = this.seats.get(client.sessionId)
      if (!seat) continue
      client.send('result', {
        youWon: seat === winnerSeat,
        reason: this.game.winReason,
        ranked: this.ranked,
        elo: eloBySeat ? eloBySeat[seat] : null,
      })
    }
  }

  async onLeave(client, consented) {
    const seat = this.seats.get(client.sessionId)
    const gameRunning = this.game && this.game.phase !== 'gameover'
    if (!seat) return
    if (!gameRunning) {
      // Left while waiting for an opponent (or after the result screen):
      // free the seat so a private room can accept a new guest.
      if (!this.game) {
        this.seats.delete(client.sessionId)
        delete this.joined[seat]
      }
      return
    }
    if (!consented) {
      // Network drop: hold the seat and let them resume.
      this.broadcastToOthers(client, 'opp-disconnected', { seconds: RECONNECT_GRACE_SECONDS })
      try {
        await this.allowReconnection(client, RECONNECT_GRACE_SECONDS)
        this.broadcastToOthers(client, 'opp-reconnected', {})
        this.broadcastViews()
        return
      } catch {
        // fell through: never came back
      }
    }
    if (this.game && this.game.phase !== 'gameover') {
      this.apply({ type: 'concede', player: seat })
      this.broadcastViews()
    }
  }

  broadcastToOthers(client, type, message) {
    for (const other of this.clients) {
      if (other.sessionId !== client.sessionId) other.send(type, message)
    }
  }
}

// Private friendly match: created with a shareable code, joined by that code
// (gameServer.define(...).filterBy(['code'])). Never affects Elo. Note:
// setPrivate() would hide the room from join() queries entirely, so instead
// the room stays listed and the code is verified explicitly on every join.
export class PrivateMatchRoom extends MatchRoom {
  ranked = false

  onJoin(client, options = {}) {
    const code = String(options.code ?? '').toUpperCase()
    if (!code || code !== this.metadata?.code) throw new Error('Wrong or missing match code.')
    super.onJoin(client, options)
  }
}

// Ranked queue: joinOrCreate pairs the first two players waiting.
export class RankedMatchRoom extends MatchRoom {
  ranked = true
}

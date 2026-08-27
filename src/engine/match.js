// Match-mode rules: setup/mulligans, turn ownership, once-per-turn limits,
// prizes, promotion, and win conditions. Everything here is a no-op in
// sandbox mode.
import { opposite, shuffle, flipCoins, energyUnits } from './utils.js'
import { getSlot, updateZone, pushLog, pushFx } from './state.js'
import { DECKS, makeDeck, baseGameState, getPowerEffects } from './cards.js'
import { powerActive, evolutionBlocked, retreatCostOf } from './powers.js'

export const RULES = {
  openingHand: 7,
  prizeCount: 6,
  benchMax: 5,
  firstPlayerCanAttack: false, // easy to flip for 1999-authentic rules
  mulliganOpponentDraws: 1, // extra cards the opponent may draw per mulligan
}

const hasBasic = (hand) => hand.some((c) => c.supertype === 'pokemon' && c.stage === 'basic')

// --- match creation -------------------------------------------------------

// Decks come either from a preset id (p1DeckId) or an explicit card-name
// list + display name (p1DeckList / p1DeckName — used by custom decks).
export function initialMatchState({
  p1DeckId = 'blazeSurf',
  p2DeckId = 'jungleMind',
  p1DeckList = null,
  p1DeckName = null,
  p2DeckList = null,
  p2DeckName = null,
} = {}) {
  const log = []
  const sides = {}
  const mulligans = { p1: 0, p2: 0 }

  for (const p of ['p1', 'p2']) {
    const deckId = p === 'p1' ? p1DeckId : p2DeckId
    const list = (p === 'p1' ? p1DeckList : p2DeckList) ?? DECKS[deckId]?.list ?? DECKS.blazeSurf.list
    const name = (p === 'p1' ? p1DeckName : p2DeckName) ?? DECKS[deckId]?.name ?? deckId
    let deck = makeDeck(list)
    let hand = deck.slice(0, RULES.openingHand)
    let rest = deck.slice(RULES.openingHand)
    let guard = 0
    while (!hasBasic(hand) && guard++ < 50) {
      mulligans[p]++
      deck = shuffle([...hand, ...rest])
      hand = deck.slice(0, RULES.openingHand)
      rest = deck.slice(RULES.openingHand)
    }
    if (mulligans[p] > 0) log.push(`${p} mulliganed ${mulligans[p]} time${mulligans[p] > 1 ? 's' : ''} (no Basic Pokémon).`)
    sides[p] = { hand, deck: rest, deckName: name }
  }

  // Opponent draws extra cards for each mulligan
  for (const p of ['p1', 'p2']) {
    const extra = mulligans[opposite[p]] * RULES.mulliganOpponentDraws
    if (extra > 0) {
      sides[p].hand = [...sides[p].hand, ...sides[p].deck.slice(0, extra)]
      sides[p].deck = sides[p].deck.slice(extra)
      log.push(`${p} drew ${extra} extra card${extra > 1 ? 's' : ''} for the mulligan${extra > 1 ? 's' : ''}.`)
    }
  }

  // Set prizes aside
  const base = baseGameState()
  const state = {
    ...base,
    mode: 'match',
    phase: 'setup',
    turnNumber: 0,
    setupDone: { p1: false, p2: false },
    log: [
      `Match started: ${sides.p1.deckName} vs ${sides.p2.deckName}.`,
      ...log,
      'Setup: place your Active Pokémon (and any Benched Basics), then press Ready.',
    ],
  }
  for (const p of ['p1', 'p2']) {
    state[p] = {
      ...base[p],
      hand: sides[p].hand,
      prizes: sides[p].deck.slice(0, RULES.prizeCount),
      deck: sides[p].deck.slice(RULES.prizeCount),
    }
  }
  return state
}

// --- helpers --------------------------------------------------------------

export function gameOver(state, winner, reason) {
  if (state.phase === 'gameover') return state
  state = { ...state, phase: 'gameover', winner, winReason: reason, pending: null, effectsQueue: [] }
  return pushLog(state, `*** ${winner} wins: ${reason} ***`)
}

export function hasRainDance(state, player) {
  return state[player].mon.some((s) => powerActive(state, s, 'Rain Dance'))
}

// Turn rules apply in a match, or in the sandbox when the "turn based"
// toggle is on (for testing once-per-turn powers and similar interactions).
export const turnRulesActive = (state) => state.mode === 'match' || !!state.enforceTurns

// May `player` attach this energy card to this slot right now?
export function canAttachEnergy(state, player, card, destSlot) {
  // Crystal Beam: no energy attachments to the marked pokemon (even in sandbox
  // the marker means the effect is live; the catalog drop path bypasses this)
  if (destSlot?.markers?.energyBlock) {
    return { ok: false, reason: `Energy can't be attached to ${destSlot.name} this turn.` }
  }
  if (!turnRulesActive(state)) return { ok: true, consumesFlag: false }
  if (card.energy === 'water' && destSlot?.type === 'water' && hasRainDance(state, player)) {
    return { ok: true, consumesFlag: false, rainDance: true }
  }
  if (state.turnFlags.energyAttached) {
    return { ok: false, reason: 'Already attached an energy this turn.' }
  }
  return { ok: true, consumesFlag: true }
}

export function canEvolveTarget(state, slot) {
  if (!turnRulesActive(state)) return { ok: true }
  if (evolutionBlocked(state)) return { ok: false, reason: "Aerodactyl's Prehistoric Power blocks evolution." }
  // Giovanni (trainer): the marked pokemon ignores evolution timing this turn
  if (slot.markers?.giovanni) return { ok: true }
  if (state.turnNumber <= 2) return { ok: false, reason: "Pokémon can't evolve on either player's first turn." }
  if (slot.turnPlayed === state.turnNumber) return { ok: false, reason: `${slot.name} was played or evolved this turn.` }
  return { ok: true }
}

export function drawForTurn(state, player) {
  if (state[player].deck.length === 0) {
    return gameOver(state, opposite[player], `${player} has no cards left to draw`)
  }
  state = updateZone(state, player, 'hand', (h) => [...h, state[player].deck[0]])
  state = updateZone(state, player, 'deck', (d) => d.slice(1))
  return pushLog(state, `${player} drew a card.`)
}

export function beginPlay(state) {
  const f = flipCoins(1)
  const first = f.heads > 0 ? 'p1' : 'p2'
  state = pushLog(state, `Opening coin flip: ${f.results[0]} — ${first} goes first.`)
  state = pushFx(state, { kind: 'coins', results: f.results, label: `Opening flip — ${first} goes first` })
  state = {
    ...state,
    phase: 'playing',
    turnPlayer: first,
    turnNumber: 1,
    turnFlags: { energyAttached: false, retreated: false, powersUsed: {} },
  }
  state = pushLog(state, `--- ${first}'s turn (turn 1) ---`)
  return drawForTurn(state, first)
}

// --- action guard ---------------------------------------------------------

export function actorOf(action) {
  switch (action.type) {
    case 'drop':
      return action.source?.player
    case 'click':
    case 'end-turn':
    case 'resolve-choice':
    case 'skip-choice':
      return action.actor
    default:
      return action.player
  }
}

function validateDrop(state, action) {
  const { source, dest } = action
  if (dest.zone) return 'Cards can only be played onto the board.'
  const actor = source?.player
  const card = state[actor]?.hand?.find((c) => c.uid === source.uid)
  if (!card) return 'Invalid card.'
  if (dest.player !== actor) return 'You can only play cards on your own side.'
  const destSlot = state[dest.player].mon[dest.id]

  if (state.phase === 'setup') {
    if (state.setupDone[actor]) return 'You are already ready.'
    if (destSlot) return 'That spot is taken.'
    if (!state[actor].mon[0] && dest.id !== 0) return 'Place your Active Pokémon first.'
    if (card.supertype === 'pokemon' && card.stage === 'basic') return null
    if (card.doll) return dest.id === 0 ? "Clefairy Doll can't be your starting Active." : null
    return 'Only Basic Pokémon can be played during setup.'
  }

  // playing phase
  if (card.supertype === 'energy') {
    if (!destSlot) return 'Attach energy to a Pokémon.'
    const check = canAttachEnergy(state, actor, card, destSlot)
    return check.ok ? null : check.reason
  }
  if ((card.stage === 'basic' || card.doll) && !destSlot) return null
  if (card.supertype === 'pokemon' && destSlot && card.evolvesFrom === (destSlot.species ?? destSlot.name)) {
    const check = canEvolveTarget(state, destSlot)
    return check.ok ? null : check.reason
  }
  return 'Invalid move.'
}

// Returns an error string when the action is not allowed, null when it is.
export function matchGuard(state, action) {
  const isMatch = state.mode === 'match'
  if (!isMatch && !state.enforceTurns) return null
  const t = action.type

  if (t === 'reset' || t === 'concede' || t === 'toggle-turn-rules') return null
  if (t === 'fx-done' || t === 'set-fx-enabled') return null
  if (t === 'view-zone') return isMatch && action.zone !== 'discard' ? 'Those cards are hidden.' : null
  if (t === 'close-view' || t === 'close-reveal') return null
  if (state.phase === 'gameover') return 'The game is over.'
  if (t === 'debug-spawn') return isMatch ? 'Not available in a match.' : null
  // Sandbox testing tools (card catalog spawns, dragging to deck/discard/hand)
  // stay usable even while turn rules are enforced.
  if (!isMatch && t === 'drop' && (action.source?.from === 'catalog' || action.dest?.zone)) return null
  if (t === 'draw') return 'Draws are automatic while turn rules are on.'

  const actor = actorOf(action)

  if (state.pending) {
    if (!['click', 'resolve-choice', 'skip-choice'].includes(t)) return 'Resolve the current choice first.'
    // In the sandbox one human answers choices for both sides.
    if (!isMatch) return null
    if (!actor) return 'Unknown actor.'
    return actor === state.pending.chooserPlayer ? null : "It isn't your choice to make."
  }
  if (!actor) return 'Unknown actor.'
  if (t === 'click') return null // board clicks are no-ops without a pending choice
  if (state.effectsQueue.length || state.fxQueue.length) return 'Wait for effects to resolve.'

  if (state.phase === 'setup') {
    if (t === 'drop') return validateDrop(state, action)
    if (t === 'setup-done') {
      if (state.setupDone[actor]) return 'Already ready.'
      return state[actor].mon[0] ? null : 'Place an Active Pokémon first.'
    }
    return 'Finish setup first.'
  }

  // phase === 'playing'
  if (t === 'setup-done') return 'Setup is already complete.'
  if (actor !== state.turnPlayer) return "It isn't your turn."
  if (t === 'drop') return validateDrop(state, action)
  if (t === 'attack' && isMatch && state.turnNumber === 1 && !RULES.firstPlayerCanAttack) {
    return "The first player can't attack on the first turn."
  }
  if (t === 'retreat') {
    if (state.turnFlags.retreated) return 'Already retreated this turn.'
    const active = state[actor].mon[0]
    const units = active ? energyUnits(active.energyAttached).length : 0
    if (active && units < retreatCostOf(state, actor)) return 'Not enough energy to retreat.'
  }
  if (t === 'use-power') {
    const slot = getSlot(state, { player: actor, id: action.id })
    const power = slot?.power ? getPowerEffects(slot.power.name) : null
    if (power?.oncePerTurn && state.turnFlags.powersUsed[slot.uid]) {
      return `${slot.power.name} can only be used once per turn.`
    }
  }
  return null
}

// --- post-action settlement -----------------------------------------------

// Runs after every action in match mode. Awards prizes, forces promotion,
// checks win conditions, and finishes the turn after an attack resolves.
// `endTurnFn` is passed in by the reducer to avoid an import cycle.
export function settleMatch(state, endTurnFn) {
  if (state.mode !== 'match') {
    // Turn-based sandbox: attacks still end the turn, but there are no
    // prizes, forced promotions, or win conditions.
    if (state.enforceTurns && state.endTurnAfterResolve && !state.pending && !state.effectsQueue.length && !state.fxQueue.length && endTurnFn) {
      state = { ...state, endTurnAfterResolve: false }
      state = endTurnFn(state)
    }
    return state
  }
  let guard = 0
  while (guard++ < 30) {
    if (state.phase === 'gameover' || state.pending || state.effectsQueue.length || state.fxQueue.length) return state

    if (state.phase === 'playing') {
      // loss by no Pokémon in play
      for (const p of ['p1', 'p2']) {
        if (state[p].mon.every((s) => !s)) return gameOver(state, opposite[p], `${p} has no Pokémon in play`)
      }
      // prize awards
      const owedTo = ['p1', 'p2'].find((p) => state.prizesOwed[p] > 0)
      if (owedTo) {
        state = {
          ...state,
          pending: {
            what: 'prize',
            chooserPlayer: owedTo,
            prompt: `Take a prize card (${state.prizesOwed[owedTo]} owed)`,
          },
        }
        return state
      }
      // promotion of a new active
      const needsPromote = ['p1', 'p2'].find((p) => !state[p].mon[0] && state[p].mon.some(Boolean))
      if (needsPromote) {
        state = {
          ...state,
          pending: {
            what: 'pokemon',
            promote: true,
            chooserPlayer: needsPromote,
            prompt: `${needsPromote}: choose your new Active Pokémon`,
          },
        }
        return state
      }
      // attack (or attempted attack) ends the turn
      if (state.endTurnAfterResolve && endTurnFn) {
        state = { ...state, endTurnAfterResolve: false }
        state = endTurnFn(state)
        continue
      }
    }
    return state
  }
  return state
}

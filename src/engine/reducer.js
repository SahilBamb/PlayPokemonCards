import { opposite, flipCoins, costMatch } from './utils.js'
import { getSlot, updateSlot, updateZone, pushLog, setContext } from './state.js'
import { EFFECTS, buildAttackEffects, evolveSlot } from './primitives.js'
import { applyDamage, checkKO } from './damage.js'
import { makeCard, makeSlot, getAttackEffects, getTrainerEffects, getPowerEffects, initialGameState } from './cards.js'
import { validPokemonRefs, candidateCards, energyCandidates, energyChooseSlotRef, chooseZoneOwner, trainerPlayable } from './targets.js'
import { matchGuard, settleMatch, canAttachEnergy, beginPlay, drawForTurn, gameOver, initialMatchState } from './match.js'

function condition(state, cond) {
  const ctx = state.context
  switch (cond) {
    case 'heads':
      return (ctx.heads ?? 0) > 0
    case 'tails':
      return (ctx.tails ?? 0) > 0
    case 'didDamage':
      return !!ctx.didDamage
    default:
      return true
  }
}

export function checkRequires(state, req, sourceRef) {
  const slot = getSlot(state, sourceRef)
  const defender = getSlot(state, { player: opposite[sourceRef.player], id: 0 })
  if (req.startsWith('notMarked:')) return !slot?.markers?.[req.split(':')[1]]
  switch (req) {
    case 'defenderAsleep':
      return defender?.status === 'asleep'
    case 'wasAttackedLastTurn':
      return slot?.lastHit?.turnNumber === state.turnNumber - 1
    case 'defenderHasWeakness':
      return !!(defender?.weaknessOverride ?? defender?.weakness)
    default:
      return true
  }
}

// Drain the effects queue until it's empty or a CHOOSE pauses it.
function runQueue(state) {
  while (state.effectsQueue.length > 0 && !state.pending) {
    const effect = state.effectsQueue[0]
    state = { ...state, effectsQueue: state.effectsQueue.slice(1) }
    if (effect.flip) {
      const f = flipCoins(effect.flip)
      state = setContext(state, { heads: f.heads, tails: f.tails, flipResults: f.results })
      state = pushLog(state, `Coin flip: ${f.results.join(' ')}`)
    }
    if (effect.if && !condition(state, effect.if)) continue
    const fn = EFFECTS[effect.type]
    if (!fn) {
      console.warn('Unknown effect type', effect.type)
      continue
    }
    state = fn(state, effect)
  }
  return state
}

function startActivation(state, ctx, effects) {
  state = { ...state, context: ctx, effectsQueue: [...effects] }
  return runQueue(state)
}

// --- actions ---

function doAttack(state, action) {
  const { player, id, attackName } = action
  const ref = { player, id }
  const slot = getSlot(state, ref)
  const atk = slot?.attacks?.find((a) => a.name === attackName)
  if (!slot || !atk) return state
  if (state.pending || state.effectsQueue.length) return state

  if (slot.status === 'asleep' || slot.status === 'paralyzed') {
    return pushLog(state, `${slot.name} is ${slot.status} and can't attack.`)
  }
  if (slot.attackLock?.name === attackName) {
    return pushLog(state, `${slot.name} can't use ${attackName} this turn (Amnesia).`)
  }
  const enc = getAttackEffects(slot.name, attackName)
  if (enc?.requires && !checkRequires(state, enc.requires, ref)) {
    return pushLog(state, `${attackName} can't be used right now.`)
  }
  const burn = slot.power?.name === 'Energy Burn' ? 'fire' : null
  if (!costMatch({ cost: atk.cost, energyAttached: slot.energyAttached, burn })) {
    return pushLog(state, `Not enough energy for ${attackName}.`)
  }

  // In a match, declaring an attack ends the turn once it resolves —
  // including attacks that fizzle to confusion or Sand-attack.
  if (state.mode === 'match') state = { ...state, endTurnAfterResolve: true }

  const ctx = { player, source: ref, isAttack: true, attackCost: atk.cost, attackName }
  state = { ...state, context: ctx }

  if (slot.status === 'confused') {
    const f = flipCoins(1)
    state = pushLog(state, `${slot.name} is confused... flip: ${f.results[0]}`)
    if (f.tails > 0) {
      state = pushLog(state, `${slot.name} hurt itself in confusion!`)
      state = applyDamage(state, ref, 20, {})
      return state
    }
  }
  if (slot.accuracyDebuff) {
    const f = flipCoins(1)
    state = pushLog(state, `Sand-attack: ${slot.name} flips... ${f.results[0]}`)
    if (f.tails > 0) return pushLog(state, `${slot.name}'s attack failed!`)
  }

  state = pushLog(state, `${slot.name} used ${attackName}!`)
  return startActivation(state, state.context, buildAttackEffects(slot, atk, enc))
}

function playTrainer(state, action) {
  const { player, uid } = action
  if (state.pending || state.effectsQueue.length) return state
  const card = state[player].hand.find((c) => c.uid === uid)
  if (!card || card.supertype !== 'trainer' || card.doll) return state
  const effects = getTrainerEffects(card.name)
  if (!effects) return pushLog(state, `${card.name} isn't implemented.`)
  if (!trainerPlayable(state, player, effects, uid)) {
    return pushLog(state, `${card.name} can't be played right now — it would have no effect.`)
  }
  state = updateZone(state, player, 'hand', (h) => h.filter((c) => c.uid !== uid))
  state = updateZone(state, player, 'discard', (d) => [...d, card])
  state = pushLog(state, `${player} played ${card.name}.`)
  return startActivation(state, { player, trainerName: card.name }, effects)
}

function usePower(state, action) {
  const { player, id } = action
  if (state.pending || state.effectsQueue.length) return state
  const ref = { player, id }
  const slot = getSlot(state, ref)
  const power = slot?.power ? getPowerEffects(slot.power.name) : null
  if (!power || power.passive) return state
  if (slot.status) return pushLog(state, `${slot.name} is ${slot.status}; its power can't be used.`)
  if (state.mode === 'match' && power.oncePerTurn) {
    state = { ...state, turnFlags: { ...state.turnFlags, powersUsed: { ...state.turnFlags.powersUsed, [slot.uid]: true } } }
  }
  state = pushLog(state, `${slot.name} used ${slot.power.name}.`)
  return startActivation(state, { player, source: ref }, power.effects)
}

function retreat(state, action) {
  const { player } = action
  if (state.pending || state.effectsQueue.length) return state
  const ref = { player, id: 0 }
  const slot = getSlot(state, ref)
  if (!slot || slot.doll) return state
  if (!state[player].mon.slice(1).some(Boolean)) return pushLog(state, 'No Benched Pokémon to retreat into.')
  if (slot.status === 'asleep' || slot.status === 'paralyzed') {
    return pushLog(state, `${slot.name} is ${slot.status} and can't retreat.`)
  }
  // Retreating (even a failed confused attempt) uses the once-per-turn retreat
  if (state.mode === 'match') state = { ...state, turnFlags: { ...state.turnFlags, retreated: true } }
  if (slot.status === 'confused') {
    const f = flipCoins(1)
    state = pushLog(state, `Confused retreat flip: ${f.results[0]}`)
    if (f.tails > 0) return pushLog(state, `${slot.name} failed to retreat!`)
  }
  const cost = slot.retreatCost ?? 0
  const effects = [
    ...(cost > 0
      ? [
          { type: 'CHOOSE', what: 'energy', from: 'self', count: cost, unitsMode: true, prompt: `Discard ${cost} energy to retreat` },
          { type: 'DISCARD_ENERGY' },
        ]
      : []),
    { type: 'CHOOSE', what: 'pokemon', player: 'self', zone: 'bench', prompt: 'Choose your new Active Pokémon' },
    { type: 'SWITCH_ACTIVE', player: 'self' },
  ]
  return startActivation(state, { player, source: ref }, effects)
}

function handleDrop(state, action) {
  const { source, dest } = action
  if (state.pending) return state
  const card = state[source.player]?.hand?.find((c) => c.uid === source.uid)
  if (!card || source.from !== 'hand') return state
  const destSlot = state[dest.player]?.mon?.[dest.id]

  // attach energy
  if (card.supertype === 'energy' && destSlot) {
    const check = canAttachEnergy(state, source.player, card, destSlot)
    if (!check.ok) return pushLog(state, check.reason)
    if (check.consumesFlag) {
      state = { ...state, turnFlags: { ...state.turnFlags, energyAttached: true } }
    }
    state = updateZone(state, source.player, 'hand', (h) => h.filter((c) => c.uid !== card.uid))
    // Keep the whole card on the attachment: when it later hits the discard
    // pile (KO, attack cost, retreat...) it must still be a real energy card
    // so filters like Energy Retrieval's `basicEnergy` can find it.
    state = updateSlot(state, dest, (s) => ({
      ...s,
      energyAttached: [...s.energyAttached, { ...card, units: card.units ?? 1 }],
    }))
    return pushLog(state, `Attached ${card.name} to ${destSlot.name}${check.rainDance ? ' (Rain Dance)' : ''}.`)
  }
  // play a basic (or Clefairy Doll) to an empty spot
  if ((card.stage === 'basic' || card.doll) && !destSlot && dest.player === source.player) {
    state = updateZone(state, source.player, 'hand', (h) => h.filter((c) => c.uid !== card.uid))
    state = updateZone(state, dest.player, 'mon', (m) => m.map((s, i) => (i === dest.id ? makeSlot(card, state.turnNumber) : s)))
    return pushLog(state, `${card.name} was put into play.`)
  }
  // evolve
  if (card.supertype === 'pokemon' && destSlot && card.evolvesFrom === destSlot.name) {
    state = updateZone(state, source.player, 'hand', (h) => h.filter((c) => c.uid !== card.uid))
    state = updateZone(state, dest.player, 'mon', (m) =>
      m.map((s, i) => (i === dest.id ? evolveSlot(s, card, state.turnNumber) : s))
    )
    return pushLog(state, `${destSlot.name} evolved into ${card.name}!`)
  }
  return state
}

function discardDoll(state, action) {
  const ref = { player: action.player, id: action.id }
  const slot = getSlot(state, ref)
  if (!slot?.doll) return state
  const energy = slot.energyAttached.map(({ isBuzzap, originalCard, ...e }) => (isBuzzap ? originalCard : e))
  state = updateZone(state, ref.player, 'mon', (m) => m.map((s, i) => (i === ref.id ? null : s)))
  state = updateZone(state, ref.player, 'discard', (d) => [
    ...d,
    { ...slot, dc: undefined, energyAttached: undefined, prevStack: undefined, markers: undefined },
    ...energy,
  ])
  return pushLog(state, 'Clefairy Doll was discarded.')
}

function expireForPlayer(slot, player) {
  let s = slot
  const expired = (x) => x && x.expiresAfterTurnOf === player
  if (expired(s.guard)) s = { ...s, guard: null }
  if (expired(s.attackLock)) s = { ...s, attackLock: null }
  if (expired(s.accuracyDebuff)) s = { ...s, accuracyDebuff: false }
  const markers = Object.fromEntries(Object.entries(s.markers ?? {}).filter(([, v]) => !expired(v)))
  if (Object.keys(markers).length !== Object.keys(s.markers ?? {}).length) s = { ...s, markers }
  return s
}

function endTurn(state) {
  if (state.pending || state.effectsQueue.length) return state
  const player = state.turnPlayer

  // between-turns: poison, then sleep checks, on both actives
  for (const p of ['p1', 'p2']) {
    const ref = { player: p, id: 0 }
    const active = getSlot(state, ref)
    if (!active) continue
    if (active.poisoned) {
      state = pushLog(state, `${active.name} takes ${active.poisonAmount} poison damage.`)
      state = updateSlot(state, ref, (s) => ({ ...s, dc: (s.dc ?? 0) + s.poisonAmount }))
      state = checkKO(state, ref)
    }
    const after = getSlot(state, ref)
    if (after?.status === 'asleep') {
      const f = flipCoins(1)
      state = pushLog(state, `${after.name} sleep check: ${f.results[0]}`)
      if (f.heads > 0) {
        state = updateSlot(state, ref, (s) => ({ ...s, status: null }))
        state = pushLog(state, `${after.name} woke up!`)
      }
    }
  }

  // paralysis clears at the end of its owner's turn
  const active = getSlot(state, { player, id: 0 })
  if (active?.status === 'paralyzed') {
    state = updateSlot(state, { player, id: 0 }, (s) => ({ ...s, status: null }))
    state = pushLog(state, `${active.name} is no longer paralyzed.`)
  }

  // expire guards / markers / locks keyed to the ending turn
  for (const p of ['p1', 'p2']) {
    state = updateZone(state, p, 'mon', (mon) => mon.map((s) => (s ? expireForPlayer(s, player) : s)))
  }

  state = { ...state, turnPlayer: opposite[player], turnNumber: state.turnNumber + 1, context: {} }
  state = pushLog(state, `--- ${opposite[player]}'s turn (turn ${state.turnNumber}) ---`)

  if (state.mode === 'match' && state.phase !== 'gameover') {
    state = { ...state, turnFlags: { energyAttached: false, retreated: false, powersUsed: {} } }
    state = drawForTurn(state, state.turnPlayer)
  }
  return state
}

// --- pending-choice resolution ---

// All refs a board click may currently select (promotion or a CHOOSE).
export function pendingClickTargets(state) {
  const pending = state.pending
  if (!pending || pending.what !== 'pokemon') return []
  if (pending.promote) {
    const p = pending.chooserPlayer
    return state[p].mon.map((s, i) => (s && i > 0 ? { player: p, id: i } : null)).filter(Boolean)
  }
  return validPokemonRefs(state, pending)
}

function boardClick(state, action) {
  const pending = state.pending
  if (!pending) return state
  if (pending.what !== 'pokemon') return state
  const ref = { player: action.player, id: action.id }
  const valid = pendingClickTargets(state)
  if (!valid.some((r) => r.player === ref.player && r.id === ref.id)) {
    return pushLog(state, 'Invalid target.')
  }
  if (pending.promote) {
    const slot = getSlot(state, ref)
    state = updateZone(state, ref.player, 'mon', (m) => m.map((s, i) => (i === 0 ? slot : i === ref.id ? null : s)))
    state = { ...state, pending: null }
    return pushLog(state, `${ref.player} promoted ${slot.name} to Active.`)
  }
  const key = pending.storeAs ?? 'chosen'
  state = setContext(state, { [key]: ref })
  state = { ...state, pending: null }
  return runQueue(state)
}

function takePrize(state, action) {
  const pending = state.pending
  const p = pending.chooserPlayer
  const index = action.payload?.index ?? 0
  const card = state[p].prizes[index]
  if (!card) return state
  state = updateZone(state, p, 'prizes', (z) => z.filter((_, i) => i !== index))
  state = updateZone(state, p, 'hand', (h) => [...h, card])
  state = { ...state, prizesOwed: { ...state.prizesOwed, [p]: state.prizesOwed[p] - 1 }, pending: null }
  state = pushLog(state, `${p} took a prize card (${state[p].prizes.length} left).`)
  if (state[p].prizes.length === 0) return gameOver(state, p, `${p} took all their prizes`)
  if (state.prizesOwed[p] > 0 && state[p].prizes.length > 0) {
    state = { ...state, pending: { ...pending, prompt: `Take a prize card (${state.prizesOwed[p]} owed)` } }
  }
  return state
}

function resolveChoice(state, action) {
  const pending = state.pending
  if (!pending) return state
  if (pending.what === 'prize') return takePrize(state, action)
  const { payload } = action
  let patch = {}
  switch (pending.what) {
    case 'cards': {
      const owner = chooseZoneOwner(state, pending)
      const cards = state[owner][pending.from].filter((c) => payload.uids.includes(c.uid))
      patch = { chosenCards: { owner, zone: pending.from, cards } }
      break
    }
    case 'energy': {
      const ref = energyChooseSlotRef(state, pending)
      patch = { chosenEnergy: { ref, uids: payload.uids } }
      break
    }
    case 'attack':
      patch = { chosenAttack: payload.attackName }
      break
    case 'type':
      patch = { chosenType: payload.type }
      break
    case 'order':
      patch = { chosenOrder: payload.uids }
      break
    default:
      return state
  }
  state = setContext(state, patch)
  state = { ...state, pending: null }
  return runQueue(state)
}

function skipChoice(state) {
  const pending = state.pending
  if (!pending || !pending.optional) return state
  const key = pending.storeAs ?? (pending.what === 'pokemon' ? 'chosen' : null)
  if (key) state = setContext(state, { [key]: null })
  state = { ...state, pending: null }
  state = pushLog(state, 'Choice skipped.')
  return runQueue(state)
}

function setupDone(state, action) {
  const { player } = action
  state = { ...state, setupDone: { ...state.setupDone, [player]: true } }
  state = pushLog(state, `${player} is ready.`)
  if (state.setupDone.p1 && state.setupDone.p2) state = beginPlay(state)
  return state
}

export function reducer(state, action) {
  // Match-mode gating: turn ownership, phase, once-per-turn limits.
  const rejection = matchGuard(state, action)
  if (rejection) return pushLog(state, rejection)
  state = baseReducer(state, action)
  // Match-mode settlement: prizes, promotion, win conditions, auto end-turn.
  return settleMatch(state, endTurn)
}

function baseReducer(state, action) {
  switch (action.type) {
    case 'setup-done':
      return setupDone(state, action)
    case 'concede':
      return gameOver(state, opposite[action.player], `${action.player} conceded`)
    case 'draw': {
      if (state.pending) return state
      const { player } = action
      if (state[player].deck.length === 0) return pushLog(state, 'Deck is empty.')
      state = updateZone(state, player, 'hand', (h) => [...h, state[player].deck[0]])
      return updateZone(state, player, 'deck', (d) => d.slice(1))
    }
    case 'drop':
      return handleDrop(state, action)
    case 'attack':
      return doAttack(state, action)
    case 'play-trainer':
      return playTrainer(state, action)
    case 'use-power':
      return usePower(state, action)
    case 'retreat':
      return retreat(state, action)
    case 'discard-doll':
      return discardDoll(state, action)
    case 'end-turn':
      return endTurn(state)
    case 'click':
      return boardClick(state, action)
    case 'resolve-choice':
      return resolveChoice(state, action)
    case 'skip-choice':
      return skipChoice(state)
    case 'view-zone':
      return { ...state, viewZone: { player: action.player, zone: action.zone } }
    case 'close-view':
      return { ...state, viewZone: null }
    case 'reset':
      return initialGameState()
    // sandbox console helper: put any card into a hand
    case 'debug-spawn':
      try {
        return updateZone(state, action.player, 'hand', (h) => [...h, makeCard(action.name)])
      } catch {
        return pushLog(state, `Unknown card: ${action.name}`)
      }
    default:
      return state
  }
}

export { initialGameState, initialMatchState, validPokemonRefs, candidateCards, energyCandidates }

// enumerateActions(state, player): every legal action `player` may dispatch
// right now. Used by the AI driver today; a Colyseus server would use it for
// validation later. All returned actions are plain serializable objects.
import { opposite, costMatch, energyUnits } from './utils.js'
import { getSlot } from './state.js'
import { getAttackEffects, getPowerEffects, getTrainerEffects } from './cards.js'
import { candidateCards, energyCandidates, trainerPlayable } from './targets.js'
import { checkRequires, pendingClickTargets } from './reducer.js'
import { RULES, canAttachEnergy, canEvolveTarget } from './match.js'

const ENERGY_TYPES = ['grass', 'fire', 'water', 'lightning', 'psychic', 'fighting', 'colorless']

// Choice answers for the current pending prompt.
function pendingActions(state, player) {
  const pending = state.pending
  if ((pending.chooserPlayer ?? state.context?.player) !== player) return []
  const acts = []

  if (pending.what === 'pokemon') {
    for (const r of pendingClickTargets(state)) {
      acts.push({ type: 'click', player: r.player, id: r.id, actor: player })
    }
  } else if (pending.what === 'prize') {
    state[player].prizes.forEach((_, index) =>
      acts.push({ type: 'resolve-choice', actor: player, payload: { index } })
    )
  } else if (pending.what === 'cards' || pending.what === 'energy') {
    const cands = pending.what === 'cards' ? candidateCards(state, pending) : energyCandidates(state, pending)
    const wanted = pending.count === 'all' ? cands.length : (pending.count ?? pending.upTo ?? 1)
    if (pending.unitsMode) {
      // accumulate cards until enough energy units are discarded
      const uids = []
      let units = 0
      for (const c of cands) {
        if (units >= wanted) break
        uids.push(c.uid)
        units += c.units ?? 1
      }
      if (units >= wanted) acts.push({ type: 'resolve-choice', actor: player, payload: { uids } })
    } else if (wanted <= 1) {
      for (const c of cands) acts.push({ type: 'resolve-choice', actor: player, payload: { uids: [c.uid] } })
    } else {
      const n = Math.min(wanted, cands.length)
      acts.push({ type: 'resolve-choice', actor: player, payload: { uids: cands.slice(0, n).map((c) => c.uid) } })
    }
  } else if (pending.what === 'attack') {
    const def = getSlot(state, { player: opposite[state.context.player], id: 0 })
    for (const a of def?.attacks ?? []) {
      acts.push({ type: 'resolve-choice', actor: player, payload: { attackName: a.name } })
    }
  } else if (pending.what === 'type') {
    for (const t of ENERGY_TYPES) acts.push({ type: 'resolve-choice', actor: player, payload: { type: t } })
  } else if (pending.what === 'order') {
    const n = pending.count ?? 1
    const uids = state[state.context.player].deck.slice(0, n).map((c) => c.uid)
    acts.push({ type: 'resolve-choice', actor: player, payload: { uids } })
  }

  if (pending.optional) acts.push({ type: 'skip-choice', actor: player })
  return acts
}

function setupActions(state, player) {
  const acts = []
  const side = state[player]
  // Active must be placed first; dolls can't start as Active.
  const emptyIds = side.mon[0] ? side.mon.map((s, i) => (s ? null : i)).filter((i) => i !== null) : [0]
  for (const card of side.hand) {
    const isBasic = card.supertype === 'pokemon' && card.stage === 'basic'
    if (!isBasic && !card.doll) continue
    for (const id of emptyIds) {
      if (card.doll && id === 0) continue
      acts.push({ type: 'drop', source: { player, from: 'hand', uid: card.uid }, dest: { player, id } })
    }
  }
  if (side.mon[0]) acts.push({ type: 'setup-done', player })
  return acts
}

function turnActions(state, player) {
  const acts = []
  const side = state[player]
  const occupied = side.mon.map((s, i) => (s ? i : null)).filter((i) => i !== null)
  const firstEmpty = side.mon.findIndex((s) => !s)

  for (const card of side.hand) {
    if (card.supertype === 'energy') {
      for (const id of occupied) {
        if (canAttachEnergy(state, player, card, side.mon[id]).ok) {
          acts.push({ type: 'drop', source: { player, from: 'hand', uid: card.uid }, dest: { player, id } })
        }
      }
    } else if ((card.stage === 'basic' || card.doll) && firstEmpty !== -1) {
      acts.push({ type: 'drop', source: { player, from: 'hand', uid: card.uid }, dest: { player, id: firstEmpty } })
    } else if (card.supertype === 'pokemon' && card.evolvesFrom) {
      for (const id of occupied) {
        const slot = side.mon[id]
        if (slot.name === card.evolvesFrom && canEvolveTarget(state, slot).ok) {
          acts.push({ type: 'drop', source: { player, from: 'hand', uid: card.uid }, dest: { player, id } })
        }
      }
    } else if (card.supertype === 'trainer' && !card.doll) {
      if (trainerPlayable(state, player, getTrainerEffects(card.name), card.uid)) {
        acts.push({ type: 'play-trainer', player, uid: card.uid })
      }
    }
  }

  for (const id of occupied) {
    const slot = side.mon[id]
    if (slot.doll) acts.push({ type: 'discard-doll', player, id })
    const power = slot.power ? getPowerEffects(slot.power.name) : null
    if (power && !power.passive && !slot.status && !(power.oncePerTurn && state.turnFlags.powersUsed[slot.uid])) {
      acts.push({ type: 'use-power', player, id })
    }
  }

  // attacks (active only)
  const active = side.mon[0]
  const firstTurnBlock = state.mode === 'match' && state.turnNumber === 1 && !RULES.firstPlayerCanAttack
  if (active && !active.doll && !firstTurnBlock && active.status !== 'asleep' && active.status !== 'paralyzed') {
    const burn = active.power?.name === 'Energy Burn' ? 'fire' : null
    for (const atk of active.attacks ?? []) {
      if (active.attackLock?.name === atk.name) continue
      if (!costMatch({ cost: atk.cost, energyAttached: active.energyAttached, burn })) continue
      const enc = getAttackEffects(active.name, atk.name)
      if (enc?.requires && !checkRequires(state, enc.requires, { player, id: 0 })) continue
      acts.push({ type: 'attack', player, id: 0, attackName: atk.name })
    }
  }

  // retreat
  const benched = side.mon.slice(1).some(Boolean)
  if (
    active && !active.doll && benched && !state.turnFlags.retreated &&
    active.status !== 'asleep' && active.status !== 'paralyzed' &&
    energyUnits(active.energyAttached).length >= (active.retreatCost ?? 0)
  ) {
    acts.push({ type: 'retreat', player })
  }

  acts.push({ type: 'end-turn', actor: player })
  return acts
}

export function enumerateActions(state, player) {
  if (state.phase === 'gameover') return []
  if (state.pending) return pendingActions(state, player)
  if (state.effectsQueue.length) return []
  if (state.phase === 'setup') return state.setupDone[player] ? [] : setupActions(state, player)
  if (state.turnPlayer !== player) return []
  return turnActions(state, player)
}

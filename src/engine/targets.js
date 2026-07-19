import { opposite, energyUnits } from './utils.js'
import { byName } from './cards.js'

// --- pokemon-slot filters used by CHOOSE what:'pokemon' ---
function slotMatches(state, ref, slot, spec) {
  const ctx = state.context
  const f = spec.filter ?? {}
  if (f.damaged && !(slot.dc > 0)) return false
  if (f.hasEnergy && slot.energyAttached.length === 0) return false
  if (f.hasEnergyType && !energyUnits(slot.energyAttached).includes(f.hasEnergyType)) return false
  if (f.evolved && !(slot.prevStack?.length > 0)) return false
  if (f.canTake10 && !((slot.dc ?? 0) + 10 < slot.hp)) return false
  if (f.notSelf && ctx.source && ref.player === ctx.source.player && ref.id === ctx.source.id) return false
  if (f.breederTarget) {
    const stage2 = ctx.chosenCards?.cards?.[0]
    if (!breederTargetRefs(state, ref.player, stage2).some((r) => r.id === ref.id)) return false
  }
  return true
}

// Which of `player`'s pokemon this Stage 2 card could be Breeder'd onto now.
// Breeder respects normal evolution timing in match mode: not on either
// player's first turn, and not onto a pokemon that entered play this turn.
export function breederTargetRefs(state, player, stage2) {
  const stage1 = stage2 ? byName[stage2.evolvesFrom] : null
  const basicName = stage1?.evolvesFrom
  if (!basicName) return []
  const refs = []
  state[player].mon.forEach((slot, id) => {
    if (!slot || slot.name !== basicName) return
    if (state.mode === 'match' && (state.turnNumber <= 2 || slot.turnPlayed === state.turnNumber)) return
    refs.push({ player, id })
  })
  return refs
}

// Valid {player, id} refs for a pokemon choice.
export function validPokemonRefs(state, spec) {
  const ctx = state.context
  const players =
    spec.player === 'both' ? ['p1', 'p2'] : spec.player === 'opp' ? [opposite[ctx.player]] : [ctx.player]
  const refs = []
  for (const p of players) {
    state[p].mon.forEach((slot, id) => {
      if (!slot) return
      if (spec.zone === 'bench' && id === 0) return
      if (spec.zone === 'active' && id !== 0) return
      if (!slotMatches(state, { player: p, id }, slot, spec)) return
      refs.push({ player: p, id })
    })
  }
  return refs
}

// --- card filters used by CHOOSE what:'cards' ---
export function cardMatches(card, filter = {}, state = null, owner = null) {
  if (filter.supertype && card.supertype !== filter.supertype) return false
  if (filter.stage && card.stage !== filter.stage) return false
  if (filter.basicEnergy && !(card.supertype === 'energy' && card.energy !== 'doublecolorless')) return false
  if (filter.basicPokemon && !((card.supertype === 'pokemon' && card.stage === 'basic') || card.doll)) return false
  if (filter.breederUsable && !(state && breederTargetRefs(state, owner, card).length > 0)) return false
  return true
}

export function chooseZoneOwner(state, spec) {
  return spec.player === 'opp' ? opposite[state.context.player] : state.context.player
}

export function candidateCards(state, spec) {
  const owner = chooseZoneOwner(state, spec)
  return state[owner][spec.from].filter((c) => cardMatches(c, spec.filter, state, owner))
}

// A trainer that can't actually do anything shouldn't be playable (and
// wasted). Checked against the current state: the first effect when it's a
// CHOOSE, plus any effect explicitly tagged `precheck: true` — used for later
// choices that don't depend on earlier ones (e.g. Energy Retrieval's
// discard-pile pick, which playing the card can never enable).
export function trainerPlayable(state, player, effects, trainerUid = null) {
  if (!effects?.length) return true
  // The trainer itself leaves the hand before its effects run, so it can't
  // satisfy its own "discard N cards from your hand" requirement.
  const hand = trainerUid ? state[player].hand.filter((c) => c.uid !== trainerUid) : state[player].hand
  const probe = { ...state, [player]: { ...state[player], hand }, context: { player } }
  const toCheck = effects.filter((e, i) => e.type === 'CHOOSE' && (i === 0 || e.precheck))
  return toCheck.every((e) => {
    // Fixed-count card choices (Computer Search's "discard 2") need the full
    // count available, not just one.
    if (e.what === 'cards' && typeof e.count === 'number' && e.count > 1) {
      return candidateCards(probe, e).length >= e.count
    }
    return chooseHasOptions(probe, e)
  })
}

// Resolve which slot an energy-choose points at.
export function energyChooseSlotRef(state, spec) {
  const ctx = state.context
  if (spec.from === 'self') return ctx.source
  if (spec.from === 'defender') return { player: opposite[ctx.player], id: 0 }
  if (spec.from === 'chosen') return ctx.chosen
  return spec.from
}

export function energyCandidates(state, spec) {
  const ref = energyChooseSlotRef(state, spec)
  const slot = ref ? state[ref.player]?.mon?.[ref.id] : null
  if (!slot) return []
  return slot.energyAttached.filter((e) => {
    if (spec.filter?.energyType && e.energy !== spec.filter.energyType) return false
    return true
  })
}

// Does a CHOOSE effect have at least one legal option right now?
export function chooseHasOptions(state, effect) {
  switch (effect.what) {
    case 'pokemon':
      return validPokemonRefs(state, effect).length > 0
    case 'cards':
      return candidateCards(state, effect).length > 0
    case 'energy':
      return energyCandidates(state, effect).length > 0
    case 'attack': {
      const def = state[opposite[state.context.player]].mon[0]
      return (def?.attacks?.length ?? 0) > 0
    }
    case 'type':
      return true
    case 'order':
      return state[state.context.player].deck.length > 0
    default:
      return true
  }
}

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
    const stage1 = stage2 ? byName[stage2.evolvesFrom] : null
    if (!stage1 || slot.name !== stage1.evolvesFrom) return false
  }
  return true
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
export function cardMatches(card, filter = {}) {
  if (filter.supertype && card.supertype !== filter.supertype) return false
  if (filter.stage && card.stage !== filter.stage) return false
  if (filter.basicEnergy && !(card.supertype === 'energy' && card.energy !== 'doublecolorless')) return false
  if (filter.basicPokemon && !((card.supertype === 'pokemon' && card.stage === 'basic') || card.doll)) return false
  return true
}

export function chooseZoneOwner(state, spec) {
  return spec.player === 'opp' ? opposite[state.context.player] : state.context.player
}

export function candidateCards(state, spec) {
  const owner = chooseZoneOwner(state, spec)
  return state[owner][spec.from].filter((c) => cardMatches(c, spec.filter))
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

import { opposite, energyUnits } from './utils.js'
import { byName } from './cards.js'
import { evolutionBlocked, powerInPlay, maxHpOf } from './powers.js'

// --- pokemon-slot filters used by CHOOSE what:'pokemon' ---
function slotMatches(state, ref, slot, spec) {
  const ctx = state.context
  const f = spec.filter ?? {}
  if (f.damaged && !(slot.dc > 0)) return false
  if (f.hasEnergy && slot.energyAttached.length === 0) return false
  if (f.hasEnergyType && !energyUnits(slot.energyAttached).includes(f.hasEnergyType)) return false
  if (f.evolved && !(slot.prevStack?.length > 0)) return false
  if (f.canTake10 && !((slot.dc ?? 0) + 10 < maxHpOf(state, slot))) return false
  if (f.notSelf && ctx.source && ref.player === ctx.source.player && ref.id === ctx.source.id) return false
  if (f.notChosen && ctx.chosen && ref.player === ctx.chosen.player && ref.id === ctx.chosen.id) return false
  if (f.nameIncludes && !slot.name.includes(f.nameIncludes)) return false
  if (f.statused && !slot.status && !slot.poisoned) return false
  if (f.typeIs && (slot.typeOverride ?? slot.type) !== f.typeIs) return false
  if (f.breederTarget) {
    const stage2 = ctx.chosenCards?.cards?.[0]
    if (!breederTargetRefs(state, ref.player, stage2).some((r) => r.id === ref.id)) return false
  }
  // Lunar Power: the pokemon the already-chosen card evolves from
  if (f.evolvesFromChosenCard) {
    const card = ctx.chosenCards?.cards?.[0]
    if (!card || card.evolvesFrom !== (slot.species ?? slot.name)) return false
  }
  return true
}

// Which of `player`'s pokemon this Stage 2 card could be Breeder'd onto now.
// Breeder respects normal evolution timing in match mode: not on either
// player's first turn, and not onto a pokemon that entered play this turn.
export function breederTargetRefs(state, player, stage2) {
  const stage1 = stage2 ? byName[stage2.evolvesFrom] : null
  const basicName = stage1?.evolvesFrom // species name — matches any print
  if (!basicName) return []
  if ((state.mode === 'match' || state.enforceTurns) && evolutionBlocked(state)) return []
  const refs = []
  state[player].mon.forEach((slot, id) => {
    if (!slot || (slot.species ?? slot.name) !== basicName) return
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
// Basic energy: any plain energy card that isn't DCE or a Rocket special.
const isBasicEnergyCard = (card) => card.supertype === 'energy' && card.energy !== 'doublecolorless' && !card.special

export function cardMatches(card, filter = {}, state = null, owner = null) {
  if (filter.supertype && card.supertype !== filter.supertype) return false
  if (filter.stage && card.stage !== filter.stage) return false
  if (filter.basicEnergy && !isBasicEnergyCard(card)) return false
  if (filter.basicPokemon && !((card.supertype === 'pokemon' && card.stage === 'basic') || card.doll)) return false
  if (filter.pokemonType && !(card.supertype === 'pokemon' && card.type === filter.pokemonType)) return false
  if (filter.speciesIn && !filter.speciesIn.includes(card.species ?? card.name)) return false
  if (filter.energyOfType && !(card.supertype === 'energy' && card.energy === filter.energyOfType)) return false
  if (filter.evolvesFrom && card.evolvesFrom !== filter.evolvesFrom) return false
  // Evolution card (any Stage 1/2), e.g. The Boss's Way / Evolutionary Light
  if (filter.evolution && !(card.supertype === 'pokemon' && card.stage !== 'basic')) return false
  if (filter.nameIncludes && !card.name.includes(filter.nameIncludes)) return false
  if (filter.nameIs && card.name !== filter.nameIs) return false
  // Nightly Garbage Run: Pokémon cards and/or basic Energy
  if (filter.pokemonOrBasicEnergy && !(card.supertype === 'pokemon' || isBasicEnergyCard(card))) return false
  // Erika's Clefairy's Lunar Power: a card that evolves from one of your benched pokemon
  if (filter.evolvesFromBenched && state) {
    const ok = state[owner].mon.some((s, i) => i > 0 && s && card.evolvesFrom === (s.species ?? s.name))
    if (!ok) return false
  }
  if (filter.breederUsable && !(state && breederTargetRefs(state, owner, card).length > 0)) return false
  return true
}

export function chooseZoneOwner(state, spec) {
  return spec.player === 'opp' ? opposite[state.context.player] : state.context.player
}

// The pool of cards a CHOOSE what:'cards' looks at. from:'deckTop' with a
// `look` count restricts the pool to the top of the deck (Misty's Wrath,
// Master Ball).
export function chooseZoneCards(state, spec) {
  const owner = chooseZoneOwner(state, spec)
  if (spec.from === 'deckTop') return state[owner].deck.slice(0, spec.look ?? 1)
  return state[owner][spec.from]
}

export function candidateCards(state, spec) {
  const owner = chooseZoneOwner(state, spec)
  return chooseZoneCards(state, spec).filter((c) => cardMatches(c, spec.filter, state, owner))
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

// Psyduck's Headache / Rocket's Secret Experiment: `player` can't play
// trainers through turn `until`. Dark Vileplume's Hay Fever blocks everyone.
export function trainerBlocked(state, player) {
  if (powerInPlay(state, 'Hay Fever')) return true
  const b = state.trainerBlock
  if (!b || b.player !== player) return false
  const until = b.until ?? b.turnNumber
  return state.turnNumber <= until
}

// Tickling Machine: `player`'s hand is set aside until the end of their next
// turn — they can't play cards from it.
export function handBlocked(state, player) {
  const b = state.handBlock
  return !!b && b.player === player && state.turnNumber <= b.untilEndOfTurn
}

// Whose deck a CHOOSE what:'order' effect works on. Prophecy sets
// deck:'fromOption' and lets a prior option choice pick either player.
export function orderDeckOwner(state, spec) {
  const ctx = state.context
  if (spec.deck === 'fromOption' && ctx.chosenOption === 'oppDeck') return opposite[ctx.player]
  return ctx.player
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
    case 'option':
      return true
    case 'order':
      return state[orderDeckOwner(state, effect)].deck.length > 0
    default:
      return true
  }
}

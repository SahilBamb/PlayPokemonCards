// Passive Pokémon Power machinery (Jungle/Fossil/Rocket/Gym). All checks
// funnel through powerActive so Muk's Toxic Gas, Goop Gas Attack, Stare
// markers, and special conditions shut powers off consistently.
import { opposite } from './utils.js'
import { getSlot } from './state.js'

const eachSlot = (state, fn) => {
  for (const p of ['p1', 'p2']) {
    state[p].mon.forEach((slot, id) => slot && fn(slot, { player: p, id }))
  }
}

// Muk: while Toxic Gas is active, all other Pokémon Powers stop working.
// (A statused Muk turns back off.)
export function toxicGasInPlay(state) {
  let found = false
  eachSlot(state, (slot) => {
    if (slot.power?.name === 'Toxic Gas' && !slot.status && !slot.markers?.powerOff) found = true
  })
  return found && !powersGloballyOff(state)
}

// Goop Gas Attack / Sabrina's Gengar's Dark Wave: every power off until the
// end of the opponent's next turn.
export function powersGloballyOff(state) {
  return !!state.powersOff && state.turnNumber <= state.powersOff.untilEndOfTurn
}

// Powers that explicitly keep working while their Pokémon has a special
// condition (per card text).
const WORKS_WHILE_STATUSED = new Set([
  'Pollen Defense', 'Gaseous Form', 'Photosynthesis', 'Rebellion', 'Shock Blast', 'Restless Sleep',
])

// Is this slot's power currently working? Powers stop while the Pokémon is
// Asleep/Confused/Paralyzed (unless the card says otherwise), while a Stare
// marker sits on it, and (except Toxic Gas itself) while Muk is out.
export function powerActive(state, slot, name) {
  if (!slot || slot.power?.name !== name) return false
  if (powersGloballyOff(state)) return false
  if (slot.markers?.powerOff) return false
  if (slot.status && !WORKS_WHILE_STATUSED.has(name)) return false
  if (name !== 'Toxic Gas' && toxicGasInPlay(state)) return false
  return true
}

// Any slot in play (either side) with this power active?
export function powerInPlay(state, name) {
  let found = null
  eachSlot(state, (slot, ref) => {
    if (!found && powerActive(state, slot, name)) found = ref
  })
  return found
}

// Aerodactyl: no evolution cards can be played while Prehistoric Power works.
export const evolutionBlocked = (state) => !!powerInPlay(state, 'Prehistoric Power')

// --- stadiums ---------------------------------------------------------------

export const stadiumInPlay = (state) => state.stadium?.card ?? null
export const stadiumActive = (state, name) => state.stadium?.card?.name === name

// Narrow Gym: no player may have more than 4 Benched Pokémon.
export const benchCap = (state) => (stadiumActive(state, 'Narrow Gym') ? 4 : 5)

// --- HP modifiers -----------------------------------------------------------

// Sabrina's Gastly's Gaseous Form (+10 HP per Psychic energy) and Koga's
// Ditto's Giant Growth (max HP becomes 80). Anything comparing dc to HP
// should use this instead of slot.hp.
export function maxHpOf(state, slot) {
  if (!slot) return 0
  let hp = slot.hp ?? 0
  if (slot.markers?.giantGrowth) hp = 80
  if (powerActive(state, slot, 'Gaseous Form')) {
    const psychic = (slot.energyAttached ?? []).reduce(
      (n, e) => n + (e.energy === 'psychic' ? e.units ?? 1 : 0), 0)
    hp += 10 * psychic
  }
  return hp
}

// May this activated power be used right now? (Shared by the reducer and the
// AI's action enumeration; oncePerTurn flags are checked by matchGuard.)
export function canUsePower(state, ref, slot, powerDef) {
  if (!slot?.power || !powerDef || powerDef.passive) return { ok: false }
  // whenPlayed powers fire from the hand, never as a board action
  if (powerDef.whenPlayed) return { ok: false }
  if (powersGloballyOff(state)) return { ok: false, reason: 'All Pokémon Powers are shut off right now.' }
  if (slot.markers?.powerOff) return { ok: false, reason: `${slot.power.name} has stopped working.` }
  if (slot.status) return { ok: false, reason: `${slot.name} is ${slot.status}; its power can't be used.` }
  if (slot.power.name !== 'Toxic Gas' && toxicGasInPlay(state)) {
    return { ok: false, reason: `Toxic Gas shuts off ${slot.power.name}.` }
  }
  if (powerDef.benchOnly && ref.id === 0) {
    return { ok: false, reason: `${slot.power.name} only works from the Bench.` }
  }
  if (powerDef.activeOnly && ref.id !== 0) {
    return { ok: false, reason: `${slot.power.name} only works while Active.` }
  }
  const rulesOn = state.mode === 'match' || !!state.enforceTurns
  if (powerDef.notTurnPlayed && rulesOn && slot.turnPlayed === state.turnNumber) {
    return { ok: false, reason: `${slot.power.name} can't be used the turn ${slot.name} came into play.` }
  }
  return { ok: true }
}

// Ditto's Transform: while Ditto is Active it copies the opposing Active's
// combat stats (type, attacks, weakness, resistance, retreat cost) — but not
// HP or its power. combatView returns the slot as it fights: pass any slot
// ref through this before reading combat stats.
//   .effectName - card name to use for attack-effect lookups
export function combatView(state, ref) {
  const slot = getSlot(state, ref)
  if (!slot) return null
  let base = { ...slot, type: slot.typeOverride ?? slot.type, effectName: slot.name }
  // Brock's Ninetales' Shapeshift: fights as the attached Evolution card.
  if (slot.shapeshift && powerActive(state, slot, 'Shapeshift')) {
    const c = slot.shapeshift
    base = {
      ...base,
      type: c.type,
      attacks: c.attacks,
      weakness: c.weakness,
      resistance: c.resistance,
      retreatCost: c.retreatCost,
      effectName: c.name,
    }
  }
  // Sabrina's Alakazam's Psylink: copies every attack of your Psychic
  // Pokémon in play (their effect lookups still use plain attack names).
  if (powerActive(state, slot, 'Psylink')) {
    const extra = []
    state[ref.player].mon.forEach((s, id) => {
      if (!s || (s.uid === slot.uid && id === ref.id)) return
      if ((s.typeOverride ?? s.type) !== 'psychic') return
      for (const a of s.attacks ?? []) {
        if (!(base.attacks ?? []).some((x) => x.name === a.name) && !extra.some((x) => x.name === a.name)) {
          extra.push(a)
        }
      }
    })
    if (extra.length) base = { ...base, attacks: [...(base.attacks ?? []), ...extra] }
  }
  // Recall (trainer): the pokemon may also use its pre-evolutions' attacks.
  if (slot.markers?.recall && slot.prevStack?.length) {
    const extra = []
    for (const prev of slot.prevStack) {
      for (const a of prev.attacks ?? []) {
        if (!(base.attacks ?? []).some((x) => x.name === a.name) && !extra.some((x) => x.name === a.name)) {
          extra.push(a)
        }
      }
    }
    if (extra.length) base = { ...base, attacks: [...(base.attacks ?? []), ...extra] }
  }
  if (ref.id !== 0 || !powerActive(state, slot, 'Transform')) return base
  const counterpart = getSlot(state, { player: opposite[ref.player], id: 0 })
  if (!counterpart || counterpart.power?.name === 'Transform') return base // two Dittos: no copy
  return {
    ...base,
    type: counterpart.typeOverride ?? counterpart.type,
    attacks: counterpart.attacks,
    weakness: counterpart.weakness,
    resistance: counterpart.resistance,
    retreatCost: counterpart.retreatCost,
    weaknessOverride: counterpart.weaknessOverride,
    resistanceOverride: counterpart.resistanceOverride,
    effectName: counterpart.name,
  }
}

// Dodrio: each benched Dodrio with Retreat Aid pays 1 less to retreat.
// Dark Muk's Sticky Goo (+2 while it's the opposing Active), The Rocket's
// Training Gym (+1 all), and Cerulean City Gym (-1 for Misty Pokémon) stack.
export function retreatCostOf(state, player) {
  const view = combatView(state, { player, id: 0 })
  if (!view) return 0
  let cost = view.retreatCost ?? 0
  state[player].mon.forEach((slot, id) => {
    if (id > 0 && powerActive(state, slot, 'Retreat Aid')) cost--
  })
  const oppActive = getSlot(state, { player: opposite[player], id: 0 })
  if (powerActive(state, oppActive, 'Sticky Goo')) cost += 2
  if (stadiumActive(state, "The Rocket's Training Gym")) cost += 1
  if (stadiumActive(state, 'Cerulean City Gym') && view.name.includes('Misty')) cost -= 1
  return Math.max(0, cost)
}

// Omanyte: your Clairvoyance lets you see the opponent's hand.
export function clairvoyanceFor(state, player) {
  let found = false
  state[player].mon.forEach((slot) => {
    if (powerActive(state, slot, 'Clairvoyance')) found = true
  })
  return found
}

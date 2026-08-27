// Small immutable-update helpers shared by the whole engine.
import { opposite } from './utils.js'

export const getSlot = (state, ref) => (ref ? state[ref.player]?.mon?.[ref.id] ?? null : null)

export const updateZone = (state, player, zone, fn) => ({
  ...state,
  [player]: { ...state[player], [zone]: fn(state[player][zone]) },
})

export const updateSlot = (state, ref, fn) =>
  updateZone(state, ref.player, 'mon', (mon) => mon.map((s, i) => (i === ref.id && s ? fn(s) : s)))

export const setSlot = (state, ref, value) =>
  updateZone(state, ref.player, 'mon', (mon) => mon.map((s, i) => (i === ref.id ? value : s)))

export const pushLog = (state, msg) => ({ ...state, log: [...state.log, msg].slice(-60) })

// Queue a visual/sound event for the UI to play. No-op unless the state was
// created with fx enabled (headless tests and fx-off settings skip it all).
export const pushFx = (state, fx) => (state.fxEnabled ? { ...state, fxQueue: [...state.fxQueue, fx] } : state)

export const setContext = (state, patch) => ({ ...state, context: { ...state.context, ...patch } })

// Resolve an effect's target spec into a {player, id} board reference.
// Specs are relative to the acting player (context.player) and the effect
// source (context.source, the attacking/power-using pokemon).
export function resolveTarget(state, targetSpec) {
  const ctx = state.context
  switch (targetSpec) {
    case 'self':
      return ctx.source
    case 'defender':
      return { player: opposite[ctx.player], id: 0 }
    case 'active':
      return { player: ctx.player, id: 0 }
    case 'chosen':
      return ctx.chosen ?? null
    case 'chosen2':
      return ctx.chosen2 ?? null
    default:
      return targetSpec ?? null
  }
}

// Iterate slots matching an `each` spec:
// { player: 'self'|'opp'|'both', zone: 'bench'|'active'|'all', filter, limit }
export function eachTargets(state, each) {
  const ctx = state.context
  const players =
    each.player === 'both' ? ['p1', 'p2'] : each.player === 'opp' ? [opposite[ctx.player]] : [ctx.player]
  // sameTypeAsDefender (Chain Lightning): no targets when the defender is colorless
  let defType = null
  if (each.filter?.sameTypeAsDefender) {
    const def = state[opposite[ctx.player]].mon[0]
    defType = def ? def.typeOverride ?? def.type : null
    if (!defType || defType === 'colorless') return []
  }
  const refs = []
  for (const p of players) {
    state[p].mon.forEach((slot, id) => {
      if (!slot) return
      if (each.zone === 'bench' && id === 0) return
      if (each.zone === 'active' && id !== 0) return
      if (each.filter?.damaged && !(slot.dc > 0)) return
      if (each.filter?.typeIs && (slot.typeOverride ?? slot.type) !== each.filter.typeIs) return
      if (each.filter?.notType && (slot.typeOverride ?? slot.type) === each.filter.notType) return
      if (each.filter?.speciesIn && !each.filter.speciesIn.includes(slot.species ?? slot.name)) return
      if (each.filter?.notSelf && ctx.source && p === ctx.source.player && id === ctx.source.id) return
      if (defType && (slot.typeOverride ?? slot.type) !== defType) return
      refs.push({ player: p, id })
    })
  }
  return each.limit ? refs.slice(0, each.limit) : refs
}

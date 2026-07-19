import { opposite, shuffle } from './utils.js'
import { getSlot, updateSlot, setSlot, updateZone, pushLog, setContext, resolveTarget, eachTargets } from './state.js'
import { applyDamage, resolveAmount, checkKO, awardPrizeFor } from './damage.js'
import { makeSlot, getAttackEffects, byName } from './cards.js'
import { chooseHasOptions } from './targets.js'

// ---------------------------------------------------------------------------
// Each primitive is (state, effect) => state. The acting player, effect source
// (attacker / power user) and all prior choices live in state.context.
// ---------------------------------------------------------------------------

function DAMAGE(state, effect) {
  const ctx = state.context
  if (effect.each) {
    for (const ref of eachTargets(state, effect.each)) {
      const amount = resolveAmount(state, effect.amount, ref)
      state = applyDamage(state, ref, amount, { isAttack: false, source: ctx.source })
    }
    return state
  }
  const ref = resolveTarget(state, effect.target)
  if (!ref || !getSlot(state, ref)) return state
  const amount = resolveAmount(state, effect.amount, ref)
  const isDefender = effect.target === 'defender'
  return applyDamage(state, ref, amount, {
    applyWR: isDefender,
    isAttack: isDefender && !!ctx.isAttack,
    source: ctx.source,
  })
}

function INFLICT_STATUS(state, effect) {
  const ref = resolveTarget(state, effect.target)
  const slot = getSlot(state, ref)
  if (!slot) return state
  if (slot.doll) return pushLog(state, `${slot.name} can't be affected by special conditions.`)
  if (effect.status === 'poisoned') {
    state = updateSlot(state, ref, (s) => ({ ...s, poisoned: true, poisonAmount: effect.poisonAmount ?? 10 }))
  } else {
    state = updateSlot(state, ref, (s) => ({ ...s, status: effect.status }))
  }
  return pushLog(state, `${slot.name} is now ${effect.status}.`)
}

function healSlot(state, ref, effect) {
  const slot = getSlot(state, ref)
  if (!slot || !(slot.dc > 0)) return state
  const healed = effect.amount === 'all' ? slot.dc : Math.min(slot.dc, effect.amount)
  state = updateSlot(state, ref, (s) => ({ ...s, dc: s.dc - healed }))
  state = pushLog(state, `${slot.name} healed ${healed} damage.`)
  if (effect.discardEnergy) {
    const energy = slot.energyAttached.filter((e) => !e.isBuzzap).map(({ isBuzzap, ...e }) => e)
    state = updateSlot(state, ref, (s) => ({ ...s, energyAttached: [] }))
    state = updateZone(state, ref.player, 'discard', (d) => [...d, ...energy])
  }
  return state
}

function HEAL(state, effect) {
  if (effect.each) {
    for (const ref of eachTargets(state, effect.each)) state = healSlot(state, ref, effect)
    return state
  }
  const ref = resolveTarget(state, effect.target)
  return ref ? healSlot(state, ref, effect) : state
}

function CURE_STATUS(state, effect) {
  const ref = resolveTarget(state, effect.target)
  const slot = getSlot(state, ref)
  if (!slot) return state
  state = updateSlot(state, ref, (s) => ({ ...s, status: null, poisoned: false, poisonAmount: 10 }))
  return pushLog(state, `${slot.name} is cured of all special conditions.`)
}

function DISCARD_ENERGY(state, effect) {
  const ctx = state.context
  // "Discard all" (Zapdos Thunderbolt) needs no prior choice.
  if (effect.count === 'all' && effect.from === 'self') {
    const ref = ctx.source
    const slot = getSlot(state, ref)
    if (!slot || slot.energyAttached.length === 0) return state
    const energy = slot.energyAttached.filter((e) => !e.isBuzzap).map(({ isBuzzap, ...e }) => e)
    state = updateSlot(state, ref, (s) => ({ ...s, energyAttached: [] }))
    state = updateZone(state, ref.player, 'discard', (d) => [...d, ...energy])
    return pushLog(state, `${slot.name} discarded all attached energy.`)
  }
  const pick = ctx.chosenEnergy
  if (!pick || !pick.uids?.length) return state
  const slot = getSlot(state, pick.ref)
  if (!slot) return state
  const removed = slot.energyAttached.filter((e) => pick.uids.includes(e.uid))
  state = updateSlot(state, pick.ref, (s) => ({
    ...s,
    energyAttached: s.energyAttached.filter((e) => !pick.uids.includes(e.uid)),
  }))
  state = updateZone(state, pick.ref.player, 'discard', (d) => [
    ...d,
    ...removed.map(({ isBuzzap, originalCard, ...e }) => (isBuzzap ? originalCard : e)),
  ])
  state = setContext(state, { chosenEnergy: null })
  return pushLog(state, `${slot.name} discarded ${removed.map((e) => e.name).join(', ')}.`)
}

function APPLY_GUARD(state, effect) {
  const ref = resolveTarget(state, effect.target)
  const slot = getSlot(state, ref)
  if (!slot) return state
  const guard = { kind: effect.kind, threshold: effect.threshold ?? 0, expiresAfterTurnOf: opposite[state.context.player] }
  state = updateSlot(state, ref, (s) => ({ ...s, guard }))
  const desc = effect.kind === 'all' ? 'all effects of attacks' : effect.kind === 'threshold' ? `damage of ${effect.threshold} or less` : 'all damage'
  return pushLog(state, `${slot.name} will prevent ${desc} next turn.`)
}

function SWITCH_ACTIVE(state, effect) {
  const ctx = state.context
  const benchRef = ctx.chosen
  if (!benchRef || benchRef.id === 0) return state
  const p = benchRef.player
  const mon = [...state[p].mon]
  const incoming = mon[benchRef.id]
  const outgoing = mon[0]
  if (!incoming) return state
  // Benching removes special conditions (and attack-scoped effects).
  mon[0] = { ...incoming, status: null, poisoned: false }
  mon[benchRef.id] = outgoing ? { ...outgoing, status: null, poisoned: false, guard: null, attackLock: null, accuracyDebuff: false } : null
  state = { ...state, [p]: { ...state[p], mon } }
  state = setContext(state, { chosen: null })
  return pushLog(state, `${incoming.name} is now ${p}'s Active Pokémon.`)
}

function ATTACK_LOCK(state, effect) {
  const ctx = state.context
  const ref = { player: opposite[ctx.player], id: 0 }
  const slot = getSlot(state, ref)
  if (!slot || !ctx.chosenAttack) return state
  state = updateSlot(state, ref, (s) => ({
    ...s,
    attackLock: { name: ctx.chosenAttack, expiresAfterTurnOf: opposite[ctx.player] },
  }))
  return pushLog(state, `${slot.name} can't use ${ctx.chosenAttack} next turn.`)
}

function ACCURACY_DEBUFF(state, effect) {
  const ref = resolveTarget(state, effect.target)
  const slot = getSlot(state, ref)
  if (!slot) return state
  state = updateSlot(state, ref, (s) => ({ ...s, accuracyDebuff: { expiresAfterTurnOf: opposite[state.context.player] } }))
  return pushLog(state, `${slot.name} must flip a coin to attack next turn.`)
}

function SET_MARKER(state, effect) {
  const ref = resolveTarget(state, effect.target)
  const slot = getSlot(state, ref)
  if (!slot) return state
  const expiresAfterTurnOf =
    effect.duration === 0 ? state.context.player : effect.duration === 1 ? opposite[state.context.player] : null
  state = updateSlot(state, ref, (s) => ({
    ...s,
    markers: { ...s.markers, [effect.marker]: { expiresAfterTurnOf } },
  }))
  return pushLog(state, `${effect.marker} applied to ${slot.name}.`)
}

function MODIFY_CARD(state, effect) {
  const ctx = state.context
  const ref = resolveTarget(state, effect.target)
  const slot = getSlot(state, ref)
  if (!slot || !ctx.chosenType) return state
  const field = effect.field === 'weakness' ? 'weaknessOverride' : 'resistanceOverride'
  state = updateSlot(state, ref, (s) => ({ ...s, [field]: ctx.chosenType }))
  return pushLog(state, `${slot.name}'s ${effect.field} is now ${ctx.chosenType}.`)
}

function COPY_ATTACK(state, effect) {
  const ctx = state.context
  const defRef = { player: opposite[ctx.player], id: 0 }
  const defender = getSlot(state, defRef)
  if (effect.mode === 'mirror') {
    const self = getSlot(state, ctx.source)
    const hit = self?.lastHit
    if (!hit || hit.turnNumber !== state.turnNumber - 1) {
      return pushLog(state, `Mirror Move: ${self?.name ?? 'attacker'} wasn't attacked last turn.`)
    }
    return applyDamage(state, defRef, hit.damage, { applyWR: false, isAttack: true, source: ctx.source })
  }
  // metronome: copy the chosen attack, waiving its energy/discard costs
  const atk = defender?.attacks?.find((a) => a.name === ctx.chosenAttack)
  if (!atk) return state
  state = pushLog(state, `Metronome copies ${atk.name}!`)
  const self = getSlot(state, ctx.source)
  const enc = getAttackEffects(defender.name, atk.name)
  const effects = buildAttackEffects(self, atk, enc, { skipCost: true })
  state = setContext(state, { attackCost: atk.cost })
  return { ...state, effectsQueue: [...effects, ...state.effectsQueue] }
}

// Shared with the reducer's attack action.
export function buildAttackEffects(slot, atk, enc, { skipCost = false } = {}) {
  const all = enc?.effects ?? []
  const costFx = skipCost ? [] : all.filter((e) => e.isCost)
  const restFx = all.filter((e) => !e.isCost)
  const effects = [...costFx]
  const numeric = parseInt(atk.damage, 10)
  if (!enc?.manual && numeric > 0) effects.push({ type: 'DAMAGE', target: 'defender', amount: numeric })
  effects.push(...restFx)
  return effects
}

function MOVE_CARDS(state, effect) {
  const ctx = state.context
  const owner = effect.player === 'opp' ? opposite[ctx.player] : ctx.player

  let cards
  if (effect.from === 'chosen') {
    const pick = ctx.chosenCards
    if (!pick || !pick.cards.length) return state
    cards = pick.cards
    state = updateZone(state, pick.owner, pick.zone, (z) => z.filter((c) => !cards.some((x) => x.uid === c.uid)))
    state = setContext(state, { chosenCards: null })
  } else {
    const zone = state[owner][effect.from]
    const matching = effect.filter ? zone.filter((c) => cardMatchesLoose(c, effect.filter)) : zone
    cards = effect.count === 'all' ? matching : matching.slice(0, effect.count ?? 1)
    state = updateZone(state, owner, effect.from, (z) => z.filter((c) => !cards.some((x) => x.uid === c.uid)))
  }
  if (!cards.length) return state

  const destOwner = effect.from === 'chosen' ? (effect.player === 'opp' ? opposite[ctx.player] : ctx.player) : owner

  if (effect.to === 'bench') {
    for (const card of cards) {
      const mon = state[destOwner].mon
      const idx = mon.findIndex((s, i) => i > 0 && !s)
      if (idx === -1) {
        state = updateZone(state, destOwner, 'discard', (d) => [...d, card])
        state = pushLog(state, `Bench is full; ${card.name} stays in the discard pile.`)
        continue
      }
      let slot = makeSlot(card, state.turnNumber)
      if (effect.halfHpDc) slot = { ...slot, dc: Math.floor(slot.hp / 2 / 10) * 10 }
      state = updateZone(state, destOwner, 'mon', (m) => m.map((s, i) => (i === idx ? slot : s)))
      state = pushLog(state, `${card.name} was put onto ${destOwner}'s bench.`)
    }
    return state
  }

  state = updateZone(state, destOwner, effect.to, (z) => [...z, ...cards])
  if (effect.to === 'deck' && effect.shuffle) {
    state = updateZone(state, destOwner, 'deck', shuffle)
  }
  const names = cards.length > 3 ? `${cards.length} cards` : cards.map((c) => c.name).join(', ')
  return pushLog(state, `${destOwner}: ${names} moved to ${effect.to}.`)
}

// MOVE_CARDS-internal filter (mirrors targets.cardMatches without the import cycle)
function cardMatchesLoose(card, filter) {
  if (filter.supertype && card.supertype !== filter.supertype) return false
  if (filter.basicEnergy && !(card.supertype === 'energy' && card.energy !== 'doublecolorless')) return false
  if (filter.basicPokemon && !((card.supertype === 'pokemon' && card.stage === 'basic') || card.doll)) return false
  return true
}

function SHUFFLE_DECK(state) {
  return updateZone(state, state.context.player, 'deck', shuffle)
}

function DEVOLVE(state) {
  const ref = state.context.chosen
  const slot = getSlot(state, ref)
  if (!slot || !(slot.prevStack?.length > 0)) return state
  const prev = slot.prevStack[slot.prevStack.length - 1]
  const topCard = { ...byName[slot.name], uid: slot.uid }
  state = updateZone(state, ref.player, 'discard', (d) => [...d, topCard])
  state = setSlot(state, ref, {
    ...slot,
    ...prev,
    prevStack: slot.prevStack.slice(0, -1),
    status: null,
    poisoned: false,
    guard: null,
    attackLock: null,
    accuracyDebuff: false,
    markers: {},
    weaknessOverride: null,
    resistanceOverride: null,
  })
  state = pushLog(state, `${slot.name} devolved into ${prev.name}.`)
  return checkKO(state, ref)
}

function EVOLVE(state, effect) {
  // Pokémon Breeder: chosenCards[0] is the Stage 2, chosen is the Basic in play.
  const ctx = state.context
  const card = ctx.chosenCards?.cards?.[0]
  const ref = ctx.chosen
  const slot = getSlot(state, ref)
  if (!card || !slot) return state
  state = updateZone(state, ctx.chosenCards.owner, ctx.chosenCards.zone, (z) => z.filter((c) => c.uid !== card.uid))
  state = setSlot(state, ref, evolveSlot(slot, card, state.turnNumber))
  state = setContext(state, { chosenCards: null, chosen: null })
  return pushLog(state, `${slot.name} evolved into ${card.name}!`)
}

// Shared with the reducer's drag-to-evolve path.
export function evolveSlot(slot, card, turnNumber) {
  const bottom = { ...byName[slot.name], uid: slot.uid }
  return {
    ...slot,
    ...card,
    prevStack: [...(slot.prevStack ?? []), bottom],
    status: null,
    poisoned: false,
    poisonAmount: 10,
    guard: null,
    attackLock: null,
    accuracyDebuff: false,
    markers: {},
    weaknessOverride: null,
    resistanceOverride: null,
    turnPlayed: turnNumber,
  }
}

function SCOOP_UP(state) {
  const ref = state.context.chosen
  const slot = getSlot(state, ref)
  if (!slot) return state
  const basic = slot.prevStack?.[0] ?? { ...(byName[slot.name] ?? {}), uid: slot.uid }
  const rest = []
  if (slot.prevStack?.length > 0) {
    rest.push({ ...byName[slot.name], uid: slot.uid }, ...slot.prevStack.slice(1))
  }
  rest.push(...slot.energyAttached.map(({ isBuzzap, originalCard, ...e }) => (isBuzzap ? originalCard : e)))
  state = setSlot(state, ref, null)
  state = updateZone(state, ref.player, 'hand', (h) => [...h, basic])
  state = updateZone(state, ref.player, 'discard', (d) => [...d, ...rest])
  state = setContext(state, { chosen: null })
  return pushLog(state, `${basic.name} was scooped up.`)
}

function MOVE_DC(state) {
  const { chosen, chosen2 } = state.context
  const from = getSlot(state, chosen)
  const to = getSlot(state, chosen2)
  if (!from || !to || !(from.dc > 0)) return state
  state = updateSlot(state, chosen, (s) => ({ ...s, dc: s.dc - 10 }))
  state = updateSlot(state, chosen2, (s) => ({ ...s, dc: (s.dc ?? 0) + 10 }))
  state = setContext(state, { chosen: null, chosen2: null })
  return pushLog(state, `Moved a damage counter from ${from.name} to ${to.name}.`)
}

function MOVE_ENERGY(state) {
  const { chosen, chosen2, chosenEnergy } = state.context
  const from = getSlot(state, chosen)
  const to = getSlot(state, chosen2)
  if (!from || !to || !chosenEnergy?.uids?.length) return state
  const moved = from.energyAttached.filter((e) => chosenEnergy.uids.includes(e.uid))
  state = updateSlot(state, chosen, (s) => ({
    ...s,
    energyAttached: s.energyAttached.filter((e) => !chosenEnergy.uids.includes(e.uid)),
  }))
  state = updateSlot(state, chosen2, (s) => ({ ...s, energyAttached: [...s.energyAttached, ...moved] }))
  state = setContext(state, { chosen: null, chosen2: null, chosenEnergy: null })
  return pushLog(state, `Moved ${moved.map((e) => e.name).join(', ')} from ${from.name} to ${to.name}.`)
}

function BUZZAP(state) {
  const ctx = state.context
  const sourceRef = ctx.source
  const slot = getSlot(state, sourceRef)
  const target = getSlot(state, ctx.chosen)
  if (!slot || !target || !ctx.chosenType) return state
  // Electrode is Knocked Out (counts for a prize); its card becomes a 2-unit
  // energy on the target.
  state = awardPrizeFor(state, sourceRef.player)
  const stack = [...(slot.prevStack ?? []), ...slot.energyAttached.map(({ isBuzzap, originalCard, ...e }) => (isBuzzap ? originalCard : e))]
  state = updateZone(state, sourceRef.player, 'discard', (d) => [...d, ...stack])
  state = setSlot(state, sourceRef, null)
  const buzzapEnergy = {
    uid: slot.uid,
    name: 'Electrode',
    energy: ctx.chosenType,
    units: 2,
    isBuzzap: true,
    originalCard: { ...byName['Electrode'], uid: slot.uid },
  }
  state = updateSlot(state, ctx.chosen, (s) => ({ ...s, energyAttached: [...s.energyAttached, buzzapEnergy] }))
  state = setContext(state, { chosen: null, chosenType: null })
  return pushLog(state, `Buzzap: Electrode is now 2 ${ctx.chosenType} energy on ${target.name}.`)
}

function REORDER_DECK(state) {
  const ctx = state.context
  const order = ctx.chosenOrder
  if (!order?.length) return state
  const deck = state[ctx.player].deck
  const topN = deck.slice(0, order.length)
  const reordered = order.map((uid) => topN.find((c) => c.uid === uid)).filter(Boolean)
  state = updateZone(state, ctx.player, 'deck', (d) => [...reordered, ...d.slice(order.length)])
  state = setContext(state, { chosenOrder: null })
  return pushLog(state, `Rearranged the top ${order.length} cards of the deck.`)
}

// CHOOSE pauses the queue by setting state.pending. If nothing legal exists,
// it resolves to "no choice" so downstream primitives no-op.
// `chooser: 'opp'` (e.g. Whirlwind) hands the decision to the opponent of the
// acting player; chooserPlayer tells the UI and AI whose input is required.
function CHOOSE(state, effect) {
  if (!chooseHasOptions(state, effect)) {
    state = pushLog(state, `No valid choice for: ${effect.prompt ?? effect.what}`)
    return clearChoice(state, effect)
  }
  const chooserPlayer = effect.chooser === 'opp' ? opposite[state.context.player] : state.context.player
  return { ...state, pending: { ...effect, chooserPlayer } }
}

function clearChoice(state, effect) {
  const key = effect.storeAs ?? (effect.what === 'pokemon' ? 'chosen' : `chosen${cap(effect.what)}`)
  return setContext(state, { [key]: null })
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export const EFFECTS = {
  DAMAGE,
  INFLICT_STATUS,
  HEAL,
  CURE_STATUS,
  DISCARD_ENERGY,
  APPLY_GUARD,
  SWITCH_ACTIVE,
  ATTACK_LOCK,
  ACCURACY_DEBUFF,
  SET_MARKER,
  MODIFY_CARD,
  COPY_ATTACK,
  MOVE_CARDS,
  SHUFFLE_DECK,
  DEVOLVE,
  EVOLVE,
  SCOOP_UP,
  MOVE_DC,
  MOVE_ENERGY,
  BUZZAP,
  REORDER_DECK,
  CHOOSE,
}

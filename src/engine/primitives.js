import { opposite, shuffle, flipCoins } from './utils.js'
import { getSlot, updateSlot, setSlot, updateZone, pushLog, pushFx, setContext, resolveTarget, eachTargets } from './state.js'
import { applyDamage, resolveAmount, checkKO, awardPrizeFor } from './damage.js'
import { makeSlot, getAttackEffects, getTrainerEffects, byName } from './cards.js'
import { chooseHasOptions, chooseZoneCards, orderDeckOwner } from './targets.js'
import { powerActive, benchCap } from './powers.js'

// ---------------------------------------------------------------------------
// Each primitive is (state, effect) => state. The acting player, effect source
// (attacker / power user) and all prior choices live in state.context.
// ---------------------------------------------------------------------------

function DAMAGE(state, effect) {
  const ctx = state.context
  if (effect.each) {
    for (const ref of eachTargets(state, effect.each)) {
      const amount = resolveAmount(state, effect.amount, ref)
      state = applyDamage(state, ref, amount, { isAttack: false, fromAttack: !!ctx.isAttack, source: ctx.source })
    }
    return state
  }
  let ref = resolveTarget(state, effect.target)
  // fallback 'defender': redirect attacks (promo Zapdos) hit the defending
  // pokemon when no redirect target was available/chosen.
  if ((!ref || !getSlot(state, ref)) && effect.fallback === 'defender') {
    ref = resolveTarget(state, 'defender')
  }
  if (!ref || !getSlot(state, ref)) return state
  const amount = resolveAmount(state, effect.amount, ref)
  const isDefender = effect.target === 'defender' || (effect.fallback === 'defender' && ref.id === 0 && ref.player !== ctx.player)
  return applyDamage(state, ref, amount, {
    // Sonicboom skips W/R; Sneak Attack applies it to a chosen target
    applyWR: (isDefender && !effect.noWR) || !!effect.applyWR,
    isAttack: isDefender && !!ctx.isAttack,
    fromAttack: !!ctx.isAttack,
    source: ctx.source,
    pierce: !!effect.pierce, // Swift ignores everything on the defender
  })
}

// Thunderstorm: flip one coin per matching target; heads damages that target,
// selfPerTails hits the attacker for each tails.
function DAMAGE_PER_FLIP(state, effect) {
  const ctx = state.context
  let tails = 0
  const results = []
  for (const ref of eachTargets(state, effect.each)) {
    const f = flipCoins(1)
    results.push(f.results[0])
    if (f.heads > 0) {
      state = applyDamage(state, ref, effect.amount, { fromAttack: true, source: ctx.source })
    } else {
      tails++
    }
  }
  if (results.length) state = pushLog(state, `Coin flips: ${results.join(' ')}`)
  if (effect.selfPerTails && tails > 0 && getSlot(state, ctx.source)) {
    state = applyDamage(state, ctx.source, effect.selfPerTails * tails, { fromAttack: true, source: ctx.source })
  }
  return state
}

function INFLICT_STATUS(state, effect) {
  const ref = resolveTarget(state, effect.target)
  const slot = getSlot(state, ref)
  if (!slot) return state
  if (slot.doll) return pushLog(state, `${slot.name} can't be affected by special conditions.`)
  // 'fromOption': Magic Pollen lets the attacker pick the condition
  const status = effect.status === 'fromOption' ? state.context.chosenOption : effect.status
  if (!status) return state
  if (powerActive(state, slot, 'Thick Skinned')) {
    return pushLog(state, `Thick Skinned: ${slot.name} can't be ${status}.`)
  }
  if (status === 'poisoned') {
    state = updateSlot(state, ref, (s) => ({ ...s, poisoned: true, poisonAmount: effect.poisonAmount ?? 10 }))
  } else {
    state = updateSlot(state, ref, (s) => ({ ...s, status }))
  }
  // Shapeshift: a special condition dumps the attached Evolution card
  if (slot.shapeshift) {
    state = updateZone(state, ref.player, 'discard', (d) => [...d, slot.shapeshift])
    state = updateSlot(state, ref, (s) => ({ ...s, shapeshift: null }))
    state = pushLog(state, `${slot.name}'s Shapeshift card was discarded.`)
  }
  state = pushFx(state, { kind: 'status', target: ref, status })
  return pushLog(state, `${slot.name} is now ${status}.`)
}

function healSlot(state, ref, effect) {
  const slot = getSlot(state, ref)
  if (!slot || !(slot.dc > 0)) return state
  // 'dealt' / 'halfDealt': Leech Life / Mega Drain heal from damage just done
  const dealt = state.context?.lastDamageDealt ?? 0
  const want =
    effect.amount === 'all' ? slot.dc
    : effect.amount === 'dealt' ? dealt
    : effect.amount === 'halfDealt' ? Math.ceil(dealt / 2 / 10) * 10
    : effect.amount?.perHeads != null ? effect.amount.perHeads * (state.context?.heads ?? 0)
    : effect.amount
  if (!(want > 0)) return state
  const healed = Math.min(slot.dc, want)
  state = updateSlot(state, ref, (s) => ({ ...s, dc: s.dc - healed }))
  // lastHealed: Sabrina's Jynx's Helping Hand draws per counter removed
  state = setContext(state, { lastHealed: healed })
  state = pushLog(state, `${slot.name} healed ${healed} damage.`)
  state = pushFx(state, { kind: 'heal', target: ref, amount: healed })
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

function cureSlot(state, ref, only = null) {
  const slot = getSlot(state, ref)
  if (!slot) return state
  // only: Good Morning cures just Asleep
  if (only) {
    if (slot.status !== only) return state
    state = updateSlot(state, ref, (s) => ({ ...s, status: null }))
    return pushLog(state, `${slot.name} is no longer ${only}.`)
  }
  state = updateSlot(state, ref, (s) => ({ ...s, status: null, poisoned: false, poisonAmount: 10 }))
  return pushLog(state, `${slot.name} is cured of all special conditions.`)
}

function CURE_STATUS(state, effect) {
  // each: promo Venusaur's Solar Power cures both Active Pokémon
  if (effect.each) {
    for (const ref of eachTargets(state, effect.each)) state = cureSlot(state, ref, effect.only)
    return state
  }
  const ref = resolveTarget(state, effect.target)
  return ref ? cureSlot(state, ref, effect.only) : state
}

function DISCARD_ENERGY(state, effect) {
  const ctx = state.context
  // Auto-discards from self, no prior choice needed:
  //   count:'all'   - Zapdos' Thunderbolt
  //   count:'heads' - Dark Charizard's Continuous Fireball (per heads flipped)
  //   count: N      - discard the first N matching (filter.energyType)
  if (effect.from === 'self' && (effect.count === 'all' || effect.count === 'heads' || typeof effect.count === 'number')) {
    const ref = ctx.source
    const slot = getSlot(state, ref)
    if (!slot || slot.energyAttached.length === 0) return state
    let pool = slot.energyAttached
    if (effect.filter?.energyType) pool = pool.filter((e) => e.energy === effect.filter.energyType)
    const n = effect.count === 'all' ? pool.length : effect.count === 'heads' ? (ctx.heads ?? 0) : effect.count
    const removed = pool.slice(0, n)
    if (!removed.length) return state
    state = updateSlot(state, ref, (s) => ({
      ...s,
      energyAttached: s.energyAttached.filter((e) => !removed.some((r) => r.uid === e.uid)),
    }))
    state = updateZone(state, ref.player, 'discard', (d) => [
      ...d,
      ...removed.map(({ isBuzzap, originalCard, ...e }) => (isBuzzap ? originalCard : e)),
    ])
    state = setContext(state, { lastDiscardCount: removed.length })
    return pushLog(state, `${slot.name} discarded ${removed.map((e) => e.name).join(', ')}.`)
  }
  const pick = ctx.chosenEnergy
  if (!pick || !pick.uids?.length) return state
  const slot = getSlot(state, pick.ref)
  if (!slot) return state
  // Brock's Protection: opponents can't remove that pokemon's energy
  if (slot.markers?.energyProtect && pick.ref.player !== ctx.player) {
    return pushLog(state, `Brock's Protection: ${slot.name}'s energy can't be removed.`)
  }
  const removed = slot.energyAttached.filter((e) => pick.uids.includes(e.uid))
  state = updateSlot(state, pick.ref, (s) => ({
    ...s,
    energyAttached: s.energyAttached.filter((e) => !pick.uids.includes(e.uid)),
  }))
  state = updateZone(state, pick.ref.player, 'discard', (d) => [
    ...d,
    ...removed.map(({ isBuzzap, originalCard, ...e }) => (isBuzzap ? originalCard : e)),
  ])
  // lastDiscardCount: Wildfire mills the opponent per energy discarded
  state = setContext(state, { chosenEnergy: null, lastDiscardCount: removed.length })
  return pushLog(state, `${slot.name} discarded ${removed.map((e) => e.name).join(', ')}.`)
}

// Misty's Golduck's Super Removal: one energy off every opposing pokemon.
function DISCARD_ENERGY_EACH(state, effect) {
  const ctx = state.context
  const p = effect.player === 'opp' ? opposite[ctx.player] : ctx.player
  state[p].mon.forEach((slot, id) => {
    const cur = getSlot(state, { player: p, id })
    if (!cur || cur.energyAttached.length === 0) return
    if (cur.markers?.energyProtect && p !== ctx.player) {
      state = pushLog(state, `Brock's Protection: ${cur.name}'s energy can't be removed.`)
      return
    }
    const e = cur.energyAttached[0]
    state = updateSlot(state, { player: p, id }, (s) => ({ ...s, energyAttached: s.energyAttached.slice(1) }))
    state = updateZone(state, p, 'discard', (d) => [...d, ...(e.isBuzzap ? [e.originalCard] : [e])])
    state = pushLog(state, `${cur.name} discarded ${e.name}.`)
  })
  return state
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
  // useSource: the power's own pokemon switches in (Dragonite's Step In)
  const benchRef = effect.useSource ? ctx.source : ctx.chosen
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
  // lastSwitched: where the old active landed (Sinkhole needs it)
  state = setContext(state, { chosen: null, lastSwitched: outgoing ? { player: p, id: benchRef.id } : null })
  return pushLog(state, `${incoming.name} is now ${p}'s Active Pokémon.`)
}

function ATTACK_LOCK(state, effect = {}) {
  const ctx = state.context
  // self: the attacker can't attack (or use this attack) on its next turn
  // (Tunneling, Rampage aftermath, etc.). all: any attack is locked.
  if (effect.self) {
    const ref = ctx.source ?? { player: ctx.player, id: 0 }
    const slot = getSlot(state, ref)
    if (!slot) return state
    const name = effect.all ? '*' : (effect.attackName ?? ctx.attackName ?? ctx.chosenAttack)
    state = updateSlot(state, ref, (s) => ({
      ...s,
      attackLock: { name, expiresAfterTurnOf: ctx.player, notBeforeTurn: state.turnNumber + 1 },
    }))
    return pushLog(state, effect.all ? `${slot.name} can't attack next turn.` : `${slot.name} can't use ${name} next turn.`)
  }
  const ref = { player: opposite[ctx.player], id: 0 }
  const slot = getSlot(state, ref)
  if (!slot) return state
  const name = effect.all ? '*' : ctx.chosenAttack
  if (!name) return state
  state = updateSlot(state, ref, (s) => ({
    ...s,
    attackLock: { name, expiresAfterTurnOf: opposite[ctx.player] },
  }))
  return pushLog(state, effect.all ? `${slot.name} can't attack next turn.` : `${slot.name} can't use ${name} next turn.`)
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
  // duration 0: expires when my turn ends; 1: after opponent's turn;
  // 2: after my *next* turn (Swords Dance).
  const expiresAfterTurnOf =
    effect.duration === 0 || effect.duration === 2
      ? state.context.player
      : effect.duration === 1
        ? opposite[state.context.player]
        : null
  const marker = { expiresAfterTurnOf }
  if (effect.duration === 2) marker.notBeforeTurn = state.turnNumber + 1
  if (effect.value != null) marker.value = effect.value
  state = updateSlot(state, ref, (s) => ({
    ...s,
    markers: { ...s.markers, [effect.marker]: marker },
  }))
  return pushLog(state, `${effect.marker} applied to ${slot.name}.`)
}

function MODIFY_CARD(state, effect) {
  const ctx = state.context
  const ref = resolveTarget(state, effect.target)
  const slot = getSlot(state, ref)
  if (!slot || !ctx.chosenType) return state
  const field =
    effect.field === 'weakness' ? 'weaknessOverride' : effect.field === 'type' ? 'typeOverride' : 'resistanceOverride'
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
    // deckTop choices live in the real deck zone
    const zone = pick.zone === 'deckTop' ? 'deck' : pick.zone
    state = updateZone(state, pick.owner, zone, (z) => z.filter((c) => !cards.some((x) => x.uid === c.uid)))
    state = setContext(state, { chosenCards: null })
  } else if (effect.from === 'handRandom') {
    // a random card from the hand (Rocket's Sneak Attack-style surprises)
    const hand = state[owner].hand
    if (!hand.length) return state
    cards = [hand[Math.floor(Math.random() * hand.length)]]
    state = updateZone(state, owner, 'hand', (z) => z.filter((c) => c.uid !== cards[0].uid))
  } else {
    const zone = state[owner][effect.from]
    const matching = effect.filter ? zone.filter((c) => cardMatchesLoose(c, effect.filter)) : zone
    // 'lastDiscarded': count set by the preceding DISCARD_ENERGY (Wildfire);
    // 'lastHealed': counters removed by the preceding HEAL (Helping Hand);
    // 'lastMoved' (Sabrina's Gaze) / 'lastMovedTimes2' (Blaine's Gamble)
    const count =
      effect.count === 'lastDiscarded' ? (ctx.lastDiscardCount ?? 0)
      : effect.count === 'lastHealed' ? Math.floor((ctx.lastHealed ?? 0) / 10)
      : effect.count === 'lastMoved' ? (ctx.lastMovedCount ?? 0)
      : effect.count === 'lastMovedTimes2' ? 2 * (ctx.lastMovedCount ?? 0)
      : effect.count === 'heads' ? (ctx.heads ?? 0) // Call Will-o'-the-wisp
      : effect.count
    cards = count === 'all' ? matching : matching.slice(0, count ?? 1)
    state = updateZone(state, owner, effect.from, (z) => z.filter((c) => !cards.some((x) => x.uid === c.uid)))
  }
  if (!cards.length) return state
  // lastMovedCards feeds Lava Burst's fire-energy count
  state = setContext(state, { lastMovedCount: cards.length, lastMovedCards: cards })

  const destOwner = effect.from === 'chosen' ? (effect.player === 'opp' ? opposite[ctx.player] : ctx.player) : owner

  if (effect.to === 'bench') {
    for (const card of cards) {
      const mon = state[destOwner].mon
      const benched = mon.filter((s, i) => i > 0 && s).length
      const idx = benched >= benchCap(state) ? -1 : mon.findIndex((s, i) => i > 0 && !s)
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

  // top: place on top of the deck (Recycle) instead of the bottom
  state = updateZone(state, destOwner, effect.to, (z) => (effect.top ? [...cards, ...z] : [...z, ...cards]))
  if (effect.to === 'deck' && effect.shuffle) {
    state = updateZone(state, destOwner, 'deck', shuffle)
  }
  const names = cards.length > 3 ? `${cards.length} cards` : cards.map((c) => c.name).join(', ')
  return pushLog(state, `${destOwner}: ${names} moved to ${effect.to}.`)
}

// MOVE_CARDS-internal filter (mirrors targets.cardMatches without the import cycle)
function cardMatchesLoose(card, filter) {
  if (filter.supertype && card.supertype !== filter.supertype) return false
  if (filter.basicEnergy && !(card.supertype === 'energy' && card.energy !== 'doublecolorless' && !card.special)) return false
  if (filter.basicPokemon && !((card.supertype === 'pokemon' && card.stage === 'basic') || card.doll)) return false
  if (filter.energyType && card.energy !== filter.energyType) return false
  return true
}

function SHUFFLE_DECK(state, effect = {}) {
  const p = effect.player === 'opp' ? opposite[state.context.player] : state.context.player
  return updateZone(state, p, 'deck', shuffle)
}

function DEVOLVE(state, effect = {}) {
  const ref = state.context.chosen
  const slot = getSlot(state, ref)
  if (!slot || !(slot.prevStack?.length > 0)) return state
  const prev = slot.prevStack[slot.prevStack.length - 1]
  const topCard = { ...byName[slot.name], uid: slot.uid }
  // toHand: Mew's Devolution Beam returns the evolution card to its player's
  // hand; Devolution Spray discards it.
  state = updateZone(state, ref.player, effect.toHand ? 'hand' : 'discard', (d) => [...d, topCard])
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
    typeOverride: null,
  })
  state = pushLog(state, `${slot.name} devolved into ${prev.name}.`)
  return checkKO(state, ref)
}

function EVOLVE(state, effect) {
  // Pokémon Breeder: chosenCards[0] is the Stage 2, chosen is the Basic in play.
  // useSource: the power's own pokemon evolves (Eevee's Chain Reaction).
  const ctx = state.context
  const card = ctx.chosenCards?.cards?.[0]
  const ref = effect.useSource ? ctx.source : ctx.chosen
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
    // Giovanni's timing exemption explicitly carries through the evolution
    markers: slot.markers?.giovanni ? { giovanni: slot.markers.giovanni } : {},
    weaknessOverride: null,
    resistanceOverride: null,
    typeOverride: null,
    turnPlayed: turnNumber,
  }
}

// Pidgeot's Hurricane: return the defending pokemon and everything attached
// to it to its owner's hand. No-op when the defender was already KO'd.
function BOUNCE(state, effect) {
  const ref = resolveTarget(state, effect.target ?? 'defender')
  const slot = getSlot(state, ref)
  if (!slot) return state
  const cards = []
  if (!slot.isBuzzapEnergy) cards.push({ ...(byName[slot.name] ?? slot), uid: slot.uid })
  cards.push(...(slot.prevStack ?? []))
  cards.push(...slot.energyAttached.map(({ isBuzzap, originalCard, ...e }) => (isBuzzap ? originalCard : e)))
  state = setSlot(state, ref, null)
  state = updateZone(state, ref.player, 'hand', (h) => [...h, ...cards])
  return pushLog(state, `${slot.name} and all attached cards returned to ${ref.player}'s hand.`)
}

function SCOOP_UP(state, effect = {}) {
  // useSource: the power's own pokemon returns to hand (Tentacool's Cowardice)
  const ref = effect.useSource ? state.context.source : state.context.chosen
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

function MOVE_DC(state, effect = {}) {
  const ctx = state.context
  const fromRef = ctx.chosen
  // toSource: counters land on the power's own pokemon (Slowbro); noKo keeps
  // it alive (Strange Behavior), allowKo lets it drop (Gengar's Curse).
  const toRef = effect.toSource ? ctx.source : ctx.chosen2
  const from = getSlot(state, fromRef)
  const to = getSlot(state, toRef)
  if (!from || !to || !(from.dc > 0)) return state
  if (effect.noKo && (to.dc ?? 0) + 10 >= to.hp) {
    return pushLog(state, `${to.name} would be Knocked Out — the damage counter stays put.`)
  }
  state = updateSlot(state, fromRef, (s) => ({ ...s, dc: s.dc - 10 }))
  state = updateSlot(state, toRef, (s) => ({ ...s, dc: (s.dc ?? 0) + 10 }))
  state = setContext(state, { chosen: null, chosen2: null })
  state = pushLog(state, `Moved a damage counter from ${from.name} to ${to.name}.`)
  return effect.allowKo ? checkKO(state, toRef) : state
}

function MOVE_ENERGY(state, effect = {}) {
  const ctx = state.context
  // fromSource/toSource: the power's own pokemon is one end of the move;
  // fromDefender: rob the defending pokemon (Energy Control targets ctx refs).
  const fromRef = effect.fromSource ? ctx.source : effect.fromDefender ? { player: opposite[ctx.player], id: 0 } : ctx.chosen
  const toRef = effect.toSource ? ctx.source : ctx.chosen2 ?? ctx.chosen
  const from = getSlot(state, fromRef)
  const to = getSlot(state, toRef)
  if (!from || !to) return state
  if (from.markers?.energyProtect && fromRef.player !== ctx.player) {
    return pushLog(state, `Brock's Protection: ${from.name}'s energy can't be moved.`)
  }
  // all: move every attached energy (Energy Bomb-style effects)
  const uids = effect.all ? from.energyAttached.map((e) => e.uid) : ctx.chosenEnergy?.uids
  if (!uids?.length) return state
  const moved = from.energyAttached.filter((e) => uids.includes(e.uid))
  state = updateSlot(state, fromRef, (s) => ({
    ...s,
    energyAttached: s.energyAttached.filter((e) => !uids.includes(e.uid)),
  }))
  state = updateSlot(state, toRef, (s) => ({ ...s, energyAttached: [...s.energyAttached, ...moved] }))
  // lastMovedEnergy: Blaine's Magmar deals damage per energy just moved
  state = setContext(state, { chosen: null, chosen2: null, chosenEnergy: null, lastMovedEnergy: moved.length })
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

// Mankey's Peek: look at one hidden card. ctx.chosenOption picks which; the
// revealed card is stored on state.reveal for the peeking player's UI only.
function REVEAL(state, effect = {}) {
  const ctx = state.context
  const opp = opposite[ctx.player]
  // show: 'oppHand' reveals the whole hand (Rocket's Sneak Attack, Wobbuffet)
  if (effect.show === 'oppHand') {
    const hand = state[opp].hand
    if (!hand.length) return pushLog(state, `${opp}'s hand is empty.`)
    state = pushLog(state, `${ctx.player} looked at ${opp}'s hand.`)
    return { ...state, reveal: { player: ctx.player, cards: hand, label: "Your opponent's hand" } }
  }
  const opt = ctx.chosenOption
  if (!opt) return state
  let card = null
  let label = ''
  if (opt === 'myDeck') {
    card = state[ctx.player].deck[0]
    label = 'Top card of your deck'
  } else if (opt === 'oppDeck') {
    card = state[opp].deck[0]
    label = "Top card of your opponent's deck"
  } else if (opt === 'oppHand') {
    const hand = state[opp].hand
    card = hand.length ? hand[Math.floor(Math.random() * hand.length)] : null
    label = "Random card from your opponent's hand"
  } else if (opt === 'oppPrize') {
    card = state[opp].prizes[0]
    label = "One of your opponent's prizes"
  }
  state = setContext(state, { chosenOption: null })
  if (!card) return pushLog(state, 'Nothing to look at there.')
  state = pushLog(state, `${ctx.player} peeked at a hidden card.`)
  return { ...state, reveal: { player: ctx.player, cards: [card], label } }
}

function REORDER_DECK(state, effect = {}) {
  const ctx = state.context
  const order = ctx.chosenOrder
  if (!order?.length) return state
  const owner = orderDeckOwner(state, effect) // Prophecy can target either deck
  const deck = state[owner].deck
  const topN = deck.slice(0, order.length)
  const reordered = order.map((uid) => topN.find((c) => c.uid === uid)).filter(Boolean)
  state = updateZone(state, owner, 'deck', (d) => [...reordered, ...d.slice(order.length)])
  state = setContext(state, { chosenOrder: null, chosenOption: null })
  return pushLog(state, `Rearranged the top ${order.length} cards of ${owner}'s deck.`)
}

// Mr. Fuji: a benched pokemon and everything attached is shuffled into the deck.
// target 'defender'/'self' skips the choice (Fly Away, Scram-like attacks).
function SHUFFLE_INTO_DECK(state, effect = {}) {
  const ref = effect.target ? resolveTarget(state, effect.target) : state.context.chosen
  const slot = getSlot(state, ref)
  if (!slot) return state
  const cards = []
  if (!slot.isBuzzapEnergy) cards.push({ ...(byName[slot.name] ?? slot), uid: slot.uid })
  cards.push(...(slot.prevStack ?? []))
  cards.push(...slot.energyAttached.map(({ isBuzzap, originalCard, ...e }) => (isBuzzap ? originalCard : e)))
  state = setSlot(state, ref, null)
  state = updateZone(state, ref.player, 'deck', (d) => shuffle([...d, ...cards]))
  state = setContext(state, { chosen: null })
  return pushLog(state, `${slot.name} and all attached cards were shuffled into the deck.`)
}

// Psyduck's Headache: the opponent can't play trainers on their next turn.
// self + turns 2: Rocket's Secret Experiment blocks yourself for two turns.
function TRAINER_BLOCK(state, effect = {}) {
  const who = effect.self ? state.context.player : opposite[state.context.player]
  const until = state.turnNumber + (effect.turns ?? 1)
  state = { ...state, trainerBlock: { player: who, until } }
  return pushLog(state, `${who} can't play Trainer cards ${effect.turns > 1 ? `for ${effect.turns} turns` : 'next turn'}.`)
}

// Tickling Machine: the opponent's hand is set aside; they can't play cards
// from it until the end of their next turn.
function HAND_BLOCK(state) {
  const opp = opposite[state.context.player]
  state = { ...state, handBlock: { player: opp, untilEndOfTurn: state.turnNumber + 1 } }
  return pushLog(state, `${opp}'s hand is set aside until the end of their next turn.`)
}

// Goop Gas Attack / Dark Wave: every Pokémon Power stops working until the
// end of the opponent's next turn.
function POWERS_OFF(state) {
  state = { ...state, powersOff: { untilEndOfTurn: state.turnNumber + 1 } }
  return pushLog(state, 'All Pokémon Powers stop working until the end of the next turn.')
}

// Stare / Gaze: one chosen pokemon's power is shut off while it stays in play.
function POWER_OFF_TARGET(state, effect = {}) {
  const ref = effect.target ? resolveTarget(state, effect.target) : state.context.chosen
  const slot = getSlot(state, ref)
  if (!slot) return state
  state = updateSlot(state, ref, (s) => ({ ...s, markers: { ...s.markers, powerOff: { permanent: true } } }))
  state = setContext(state, { chosen: null })
  return pushLog(state, `${slot.name}'s Pokémon Power no longer works.`)
}

// Here Comes Team Rocket!: all prizes flip face up for the rest of the game.
function PRIZES_FACE_UP(state) {
  state = { ...state, prizesFaceUp: true }
  return pushLog(state, "Here Comes Team Rocket! Everyone's prizes are face up.")
}

// Transparent Walls: your bench takes no attack damage this turn.
function BENCH_GUARD(state) {
  const p = state.context.player
  state = { ...state, benchGuard: { player: p, untilEndOfTurn: state.turnNumber + 1 } }
  return pushLog(state, `${p}'s benched Pokémon take no attack damage until the end of the next turn.`)
}

// Misty / Charity / Vermilion City Gym: flat attack boost or reduction that
// applies to this turn's attacks (consumed via state.turnFlags).
function SET_TURNFLAG(state, effect) {
  state = { ...state, turnFlags: { ...state.turnFlags, [effect.flag]: effect.value ?? true } }
  if (effect.log) state = pushLog(state, effect.log)
  return state
}

// Sabrina's Golduck's Damage Shift: move 1 damage counter from each of your
// damaged pokemon onto the defending pokemon.
function DAMAGE_SHIFT(state) {
  const ctx = state.context
  const defRef = { player: opposite[ctx.player], id: 0 }
  const def = getSlot(state, defRef)
  if (!def) return state
  let moved = 0
  state[ctx.player].mon.forEach((slot, id) => {
    const cur = getSlot(state, { player: ctx.player, id })
    if (!cur || !(cur.dc > 0)) return
    state = updateSlot(state, { player: ctx.player, id }, (s) => ({ ...s, dc: s.dc - 10 }))
    moved += 10
  })
  if (!moved) return state
  state = updateSlot(state, defRef, (s) => ({ ...s, dc: (s.dc ?? 0) + moved }))
  state = pushLog(state, `Damage Shift moved ${moved / 10} damage counter(s) onto ${def.name}.`)
  return checkKO(state, defRef, ctx.source)
}

// Shapeshift (Brock's Ninetales): attach a chosen Evolution card from hand;
// Ninetales copies everything from it until end of turn / status / return.
function SHAPESHIFT(state) {
  const ctx = state.context
  const card = ctx.chosenCards?.cards?.[0]
  const ref = ctx.source
  const slot = getSlot(state, ref)
  if (!card || !slot) return state
  state = updateZone(state, ctx.chosenCards.owner, ctx.chosenCards.zone, (z) => z.filter((c) => c.uid !== card.uid))
  // A previous Shapeshift card gets discarded first
  if (slot.shapeshift) {
    state = updateZone(state, ref.player, 'discard', (d) => [...d, slot.shapeshift])
  }
  state = updateSlot(state, ref, (s) => ({ ...s, shapeshift: card }))
  state = setContext(state, { chosenCards: null })
  return pushLog(state, `${slot.name} shapeshifted into ${card.name}!`)
}

// Recall (trainer): the chosen pokemon can use its pre-evolutions' attacks
// this turn (combatView reads the recall marker).
function RECALL(state) {
  const ref = state.context.chosen
  const slot = getSlot(state, ref)
  if (!slot || !(slot.prevStack?.length > 0)) return state
  state = updateSlot(state, ref, (s) => ({
    ...s,
    markers: { ...s.markers, recall: { expiresAfterTurnOf: state.context.player } },
  }))
  state = setContext(state, { chosen: null })
  return pushLog(state, `${slot.name} remembers its old attacks this turn.`)
}

// Attach the chosen energy cards (from deck/discard/hand) to a pokemon in
// play — promo Mewtwo's Energy Absorption, promo Pikachu's Recharge.
function ATTACH_ENERGY(state, effect = {}) {
  const ctx = state.context
  const pick = ctx.chosenCards
  if (!pick?.cards?.length) return state
  const ref = effect.to === 'chosen' ? ctx.chosen : ctx.source
  const slot = getSlot(state, ref)
  if (!slot) return state
  state = updateZone(state, pick.owner, pick.zone, (z) => z.filter((c) => !pick.cards.some((x) => x.uid === c.uid)))
  const units = pick.cards.map((c) => ({
    uid: c.uid,
    name: c.name,
    energy: c.energy,
    units: c.units ?? (c.energy === 'doublecolorless' ? 2 : 1),
  }))
  state = updateSlot(state, ref, (s) => ({ ...s, energyAttached: [...s.energyAttached, ...units] }))
  state = setContext(state, { chosenCards: null })
  return pushLog(state, `Attached ${pick.cards.map((c) => c.name).join(', ')} to ${slot.name}.`)
}

// Rocket's Hitmonchan etc.: chosen energy cards return to the owner's hand.
function ENERGY_TO_HAND(state, effect = {}) {
  const ctx = state.context
  const ref = effect.fromSource ? ctx.source : ctx.chosen
  const slot = getSlot(state, ref)
  if (!slot) return state
  const uids = effect.all ? slot.energyAttached.map((e) => e.uid) : ctx.chosenEnergy?.uids
  if (!uids?.length) return state
  const moved = slot.energyAttached.filter((e) => uids.includes(e.uid))
  state = updateSlot(state, ref, (s) => ({
    ...s,
    energyAttached: s.energyAttached.filter((e) => !uids.includes(e.uid)),
  }))
  state = updateZone(state, ref.player, 'hand', (h) => [
    ...h,
    ...moved.map(({ isBuzzap, originalCard, ...e }) => (isBuzzap ? originalCard : e)),
  ])
  state = setContext(state, { chosen: null, chosenEnergy: null })
  return pushLog(state, `${moved.map((e) => e.name).join(', ')} returned to ${ref.player}'s hand.`)
}

// Dark Dugtrio's Sinkhole: after an opponent retreats, tails means the
// retreated pokemon takes 20 (no W/R). Runs after every retreat; no-op
// unless the other side has an active Sinkhole.
function SINKHOLE_CHECK(state) {
  const ctx = state.context
  const retreated = ctx.lastSwitched
  if (!retreated || !getSlot(state, retreated)) return state
  const opp = opposite[ctx.player]
  const hasSinkhole = state[opp].mon.some((s) => powerActive(state, s, 'Sinkhole'))
  if (!hasSinkhole) return state
  const f = flipCoins(1)
  state = pushLog(state, `Sinkhole: flip... ${f.results[0]}`)
  state = pushFx(state, { kind: 'coins', results: f.results, label: 'Sinkhole' })
  if (f.tails > 0) {
    state = pushLog(state, `Sinkhole catches ${getSlot(state, retreated).name}!`)
    state = applyDamage(state, retreated, 20, {})
  }
  return state
}

// Rocket's Mewtwo's Juxtapose: swap damage-counter totals with the defender.
function JUXTAPOSE(state) {
  const ctx = state.context
  const selfRef = ctx.source
  const defRef = { player: opposite[ctx.player], id: 0 }
  const self = getSlot(state, selfRef)
  const def = getSlot(state, defRef)
  if (!self || !def) return state
  const a = self.dc ?? 0
  const b = def.dc ?? 0
  state = updateSlot(state, selfRef, (s) => ({ ...s, dc: b }))
  state = updateSlot(state, defRef, (s) => ({ ...s, dc: a }))
  state = pushLog(state, `Juxtapose: swapped ${a / 10} and ${b / 10} damage counters.`)
  state = checkKO(state, defRef, selfRef)
  return checkKO(state, selfRef)
}

// Rattata's Trickery: swap one of your prizes with the top card of your deck.
function SWAP_PRIZE_TOPDECK(state) {
  const p = state.context.player
  const prize = state[p].prizes[0]
  const top = state[p].deck[0]
  if (!prize || !top) return pushLog(state, 'Nothing to swap.')
  state = updateZone(state, p, 'prizes', (z) => [top, ...z.slice(1)])
  state = updateZone(state, p, 'deck', (d) => [prize, ...d.slice(1)])
  return pushLog(state, `Trickery: swapped a prize with the top card of the deck.`)
}

// Misty's Wish (opponent accepted): swap your first prize with a chosen hand card.
function PRIZE_SWAP(state) {
  const ctx = state.context
  const p = ctx.player
  const card = ctx.chosenCards?.cards?.[0]
  const prize = state[p].prizes[0]
  if (!card || !prize) return state
  state = updateZone(state, p, 'hand', (h) => [...h.filter((c) => c.uid !== card.uid), prize])
  state = updateZone(state, p, 'prizes', (z) => [card, ...z.slice(1)])
  state = setContext(state, { chosenCards: null })
  return pushLog(state, `${p} swapped a prize card with a card from their hand.`)
}

// Lt. Surge's Treaty: each player puts one of their prizes into their hand.
function TAKE_PRIZE_BOTH(state) {
  for (const p of ['p1', 'p2']) {
    const prize = state[p].prizes[0]
    if (!prize) continue
    state = updateZone(state, p, 'prizes', (z) => z.slice(1))
    state = updateZone(state, p, 'hand', (h) => [...h, prize])
    state = pushLog(state, `${p} took a prize into their hand (${state[p].prizes.length} left).`)
  }
  return state
}

// Lt. Surge (trainer): a Basic from your hand becomes the Active; the old
// Active goes to the Bench.
function NEW_ACTIVE_FROM_HAND(state) {
  const ctx = state.context
  const p = ctx.player
  const card = ctx.chosenCards?.cards?.[0]
  if (!card) return state
  const mon = state[p].mon
  const idx = mon.findIndex((s, i) => i > 0 && !s)
  if (idx === -1) return pushLog(state, 'The Bench is full.')
  const old = mon[0]
  state = updateZone(state, p, 'hand', (h) => h.filter((c) => c.uid !== card.uid))
  state = updateZone(state, p, 'mon', (m) =>
    m.map((s, i) => (i === 0 ? makeSlot(card, state.turnNumber) : i === idx ? { ...old, status: null, poisoned: false } : s)))
  state = setContext(state, { chosenCards: null })
  return pushLog(state, `${card.name} jumps in as ${p}'s Active Pokémon!`)
}

// Digger: players alternate flips; the first to flip tails takes 10 on
// their Active.
function DIGGER(state) {
  const ctx = state.context
  let current = ctx.player
  const results = []
  // cap guards against a rigged/mocked coin that never lands tails
  for (let i = 0; i < 50; i++) {
    const heads = Math.random() > 0.5
    results.push(heads ? 'H' : 'T')
    if (!heads) break
    current = opposite[current]
  }
  state = pushLog(state, `Digger: ${results.join(' ')} — ${current}'s Active takes 10.`)
  state = pushFx(state, { kind: 'coins', results, label: 'Digger' })
  const ref = { player: current, id: 0 }
  if (getSlot(state, ref)) state = applyDamage(state, ref, 10, {})
  return state
}

// Trash Exchange: discard pile shuffles into the deck, then mill that many.
function TRASH_EXCHANGE(state) {
  const p = state.context.player
  const n = state[p].discard.length
  if (!n) return pushLog(state, 'The discard pile is empty.')
  state = updateZone(state, p, 'deck', (d) => shuffle([...d, ...state[p].discard]))
  state = updateZone(state, p, 'discard', () => [])
  const milled = state[p].deck.slice(0, n)
  state = updateZone(state, p, 'deck', (d) => d.slice(n))
  state = updateZone(state, p, 'discard', (d) => [...d, ...milled])
  return pushLog(state, `Trash Exchange: shuffled ${n} cards into the deck, then discarded ${milled.length} from the top.`)
}

// Look at the deck top and sort by a filter: matches to `matchTo`, the rest
// to `restTo`. Fervor (own deck, fire energy -> hand, rest -> discard) and
// False Charity (opp deck top: trainer -> discard, rest -> hand).
function DECK_TOP_SORT(state, effect) {
  const ctx = state.context
  const p = effect.player === 'opp' ? opposite[ctx.player] : ctx.player
  const top = state[p].deck.slice(0, effect.look ?? 1)
  if (!top.length) return state
  state = updateZone(state, p, 'deck', (d) => d.slice(top.length))
  const matches = top.filter((c) => cardMatchesLoose(c, effect.filter ?? {}))
  const rest = top.filter((c) => !matches.includes(c))
  if (matches.length) {
    state = updateZone(state, p, effect.matchTo, (z) => [...z, ...matches])
    state = pushLog(state, `${matches.map((c) => c.name).join(', ')} went to ${p}'s ${effect.matchTo}.`)
  }
  if (rest.length) {
    state = updateZone(state, p, effect.restTo, (z) => [...z, ...rest])
    state = pushLog(state, `${rest.length} card(s) went to ${p}'s ${effect.restTo}.`)
  }
  return state
}

// Detonate / Mega Thrash: any Stadium in play is blown up.
function DISCARD_STADIUM(state) {
  if (!state.stadium?.card) return state
  const { card, player } = state.stadium
  state = updateZone(state, player, 'discard', (d) => [...d, card])
  state = { ...state, stadium: null }
  return pushLog(state, `${card.name} was destroyed!`)
}

// Sabrina's Psychic Control: run a trainer from the opponent's discard pile
// as if it were yours (the card itself stays where it is).
function COPY_TRAINER(state) {
  const ctx = state.context
  const card = ctx.chosenCards?.cards?.[0]
  if (!card) return state
  const effects = getTrainerEffects(card.name)
  state = setContext(state, { chosenCards: null })
  if (!effects) return pushLog(state, `${card.name} isn't implemented.`)
  state = pushLog(state, `${ctx.player} copies ${card.name}!`)
  return { ...state, effectsQueue: [...effects, ...state.effectsQueue] }
}

// Misty's Tentacool's Crystal Beam: the defender can't get energy next turn.
function ENERGY_BLOCK(state) {
  const ref = { player: opposite[state.context.player], id: 0 }
  const slot = getSlot(state, ref)
  if (!slot) return state
  state = updateSlot(state, ref, (s) => ({
    ...s,
    markers: { ...s.markers, energyBlock: { expiresAfterTurnOf: opposite[state.context.player] } },
  }))
  return pushLog(state, `Energy can't be attached to ${slot.name} next turn.`)
}

// Queue sub-effects; combined with flip/if it gives one level of branching
// (Surprise Thunder's second coin, quiz-style either/or cards).
function CHAIN(state, effect) {
  return { ...state, effectsQueue: [...effect.effects, ...state.effectsQueue] }
}

// Computer Error: the player's turn ends once the card resolves (only
// meaningful under turn rules; free sandbox has no turn to end).
function END_TURN(state) {
  if (state.mode !== 'match' && !state.enforceTurns) return state
  state = pushLog(state, 'The turn ends.')
  return { ...state, endTurnAfterResolve: true }
}

// CHOOSE pauses the queue by setting state.pending. If nothing legal exists,
// it resolves to "no choice" so downstream primitives no-op.
// `chooser: 'opp'` (e.g. Whirlwind) hands the decision to the opponent of the
// acting player; chooserPlayer tells the UI and AI whose input is required.
function CHOOSE(state, effect) {
  // 'lastMoved' counts resolve when the choice opens (Sleight of Hand's
  // "search for that many")
  if (effect.count === 'lastMoved') effect = { ...effect, count: state.context.lastMovedCount ?? 0 }
  if (effect.upTo === 'lastMoved') effect = { ...effect, upTo: state.context.lastMovedCount ?? 0 }
  if ((effect.count ?? effect.upTo) === 0) return clearChoice(state, effect)
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
  DAMAGE_PER_FLIP,
  BOUNCE,
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
  REVEAL,
  REORDER_DECK,
  SHUFFLE_INTO_DECK,
  TRAINER_BLOCK,
  HAND_BLOCK,
  POWERS_OFF,
  POWER_OFF_TARGET,
  PRIZES_FACE_UP,
  BENCH_GUARD,
  SET_TURNFLAG,
  DAMAGE_SHIFT,
  SHAPESHIFT,
  RECALL,
  DISCARD_ENERGY_EACH,
  ENERGY_TO_HAND,
  ATTACH_ENERGY,
  SINKHOLE_CHECK,
  JUXTAPOSE,
  SWAP_PRIZE_TOPDECK,
  PRIZE_SWAP,
  TAKE_PRIZE_BOTH,
  NEW_ACTIVE_FROM_HAND,
  DIGGER,
  TRASH_EXCHANGE,
  DECK_TOP_SORT,
  DISCARD_STADIUM,
  COPY_TRAINER,
  ENERGY_BLOCK,
  CHAIN,
  END_TURN,
  CHOOSE,
}

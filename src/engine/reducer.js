import { opposite, flipCoins, costMatch, energyUnits } from './utils.js'
import { getSlot, updateSlot, updateZone, pushLog, pushFx, setContext } from './state.js'
import { EFFECTS, buildAttackEffects, evolveSlot } from './primitives.js'
import { applyDamage, checkKO } from './damage.js'
import { makeCard, makeSlot, getAttackEffects, getTrainerEffects, getPowerEffects, initialGameState } from './cards.js'
import { validPokemonRefs, candidateCards, energyCandidates, energyChooseSlotRef, chooseZoneOwner, chooseZoneCards, chooseHasOptions, trainerPlayable, trainerBlocked, handBlocked, orderDeckOwner } from './targets.js'
import { STADIUM_ACTIONS } from '../data/cardEffects.js'
import { matchGuard, settleMatch, canAttachEnergy, beginPlay, drawForTurn, gameOver, initialMatchState, turnRulesActive } from './match.js'
import { powerActive, combatView, canUsePower, retreatCostOf, benchCap, maxHpOf, stadiumActive } from './powers.js'

function condition(state, cond) {
  const ctx = state.context
  // 'option:x': branch on a prior CHOOSE what:'option' pick (Treaty, Wish)
  if (cond.startsWith('option:')) return ctx.chosenOption === cond.split(':')[1]
  switch (cond) {
    case 'heads':
      return (ctx.heads ?? 0) > 0
    case 'tails':
      return (ctx.tails ?? 0) > 0
    case 'didDamage':
      return !!ctx.didDamage
    case 'allHeads': // "if both coins are heads"
      return (ctx.heads ?? 0) > 0 && (ctx.tails ?? 0) === 0
    case 'allTails':
      return (ctx.tails ?? 0) > 0 && (ctx.heads ?? 0) === 0
    case 'notAllHeads': // Knockout Needle's fallback damage
      return (ctx.tails ?? 0) > 0
    case 'headsEq1': // Misty's Psyduck's ESP
      return (ctx.heads ?? 0) === 1
    case 'headsEq2':
      return (ctx.heads ?? 0) === 2
    case 'headsEq3':
      return (ctx.heads ?? 0) === 3
    case 'noChosen': // fallbacks when an optional choice was skipped/impossible
      return !ctx.chosen
    case 'discardedEnergy': // Flame Pillar's bench snipe needs the discard
      return (ctx.lastDiscardCount ?? 0) > 0
    case 'noSelfBench': // Energy Bomb's discard fallback
      return !state[ctx.player].mon.some((s, i) => i > 0 && s)
    case 'defenderMaxHp50': { // Giovanni's Nidoking's Intimidate
      const def = getSlot(state, { player: opposite[ctx.player], id: 0 })
      return !!def && maxHpOf(state, def) <= 50
    }
    case 'defenderDamaged': {
      const def = getSlot(state, { player: opposite[ctx.player], id: 0 })
      return (def?.dc ?? 0) > 0
    }
    case 'defenderHasWeakness': {
      // Texture Magic only rewrites a weakness the defender actually has
      const def = getSlot(state, { player: opposite[ctx.player], id: 0 })
      return !!(def?.weaknessOverride ?? def?.weakness)
    }
    default:
      return true
  }
}

export function checkRequires(state, req, sourceRef) {
  const slot = getSlot(state, sourceRef)
  const defender = getSlot(state, { player: opposite[sourceRef.player], id: 0 })
  if (req.startsWith('notMarked:')) return !slot?.markers?.[req.split(':')[1]]
  if (req.startsWith('marked:')) return !!slot?.markers?.[req.split(':')[1]] // Earthdrill needs Lie Low
  if (req.startsWith('hasEnergyType:')) {
    // Fireball / Playing with Fire: only with that energy type attached
    const t = req.split(':')[1]
    return (slot?.energyAttached ?? []).some((e) => e.energy === t)
  }
  switch (req) {
    case 'defenderAsleep':
      return defender?.status === 'asleep'
    case 'wasAttackedLastTurn':
      return slot?.lastHit?.turnNumber === state.turnNumber - 1
    case 'defenderHasWeakness':
      return !!(defender?.weaknessOverride ?? defender?.weakness)
    case 'benchSpace': // Call for Family and friends
      return state[sourceRef.player].mon.some((s, i) => i > 0 && !s)
    case 'selfDamaged': // Spacing Out
      return (slot?.dc ?? 0) > 0
    case 'oppBench': // attacks that need an opposing benched pokemon
      return state[opposite[sourceRef.player]].mon.some((s, i) => i > 0 && s)
    case 'selfBench': // Scram-style escapes need somewhere to go
      return state[sourceRef.player].mon.some((s, i) => i > 0 && s)
    case 'selfDamaged2': // Giovanni's Nidoran ♂'s Retaliation
      return (slot?.dc ?? 0) >= 20
    case 'sameEnergyCount': // Sabrina's Abra's Synchronize
      return !!defender && (slot?.energyAttached?.length ?? 0) === defender.energyAttached.length
    default:
      return true
  }
}

// Dynamic coin counts: { count: 'oppBench' | 'defenderDc' | 'selfEnergyType'
// | 'lastDiscarded' | 'speciesInPlay', ... }.
function dynamicFlipCount(state, spec) {
  const ctx = state.context
  const opp = opposite[ctx.player]
  switch (spec.count) {
    case 'oppBench': // Dark Hypno's Bench Manipulation
      return state[opp].mon.filter((s, i) => i > 0 && s).length
    case 'defenderDc': // Pendulum Curse
      return (getSlot(state, { player: opp, id: 0 })?.dc ?? 0) / 10
    case 'selfEnergyType': { // Continuous Fireball / Water Punch
      const src = getSlot(state, ctx.source)
      return (src?.energyAttached ?? []).reduce((n, e) => n + (e.energy === spec.energyType ? e.units ?? 1 : 0), 0)
    }
    case 'lastDiscarded': // Discharge: per energy just discarded
      return ctx.lastDiscardCount ?? 0
    case 'speciesInPlay': { // Night Spirits
      let n = 0
      state[ctx.player].mon.forEach((s) => {
        if (s && spec.species.includes(s.species ?? s.name)) n++
      })
      return n
    }
    default:
      return 0
  }
}

// Drain the effects queue until it's empty or a CHOOSE (or an fx event
// awaiting playback) pauses it.
function runQueue(state) {
  while (state.effectsQueue.length > 0 && !state.pending && !state.fxQueue.length) {
    const effect = state.effectsQueue[0]
    state = { ...state, effectsQueue: state.effectsQueue.slice(1) }
    if (effect.flip) {
      let f
      if (effect.flip === 'untilTails') {
        // Stone Barrage: flip until tails, count the heads
        const results = []
        let heads = 0
        for (;;) {
          const h = Math.random() > 0.5
          results.push(h ? 'H' : 'T')
          if (!h) break
          heads++
        }
        f = { coins: results.length, heads, tails: 1, results }
      } else if (effect.flip === 'perEnergy') {
        // Big Eggsplosion: one coin per energy attached to the attacker
        const src = getSlot(state, state.context.source)
        f = flipCoins(energyUnits(src?.energyAttached ?? []).length)
      } else if (typeof effect.flip === 'object') {
        f = flipCoins(dynamicFlipCount(state, effect.flip))
      } else {
        f = flipCoins(effect.flip)
      }
      // Sabrina's ESP: the marked attacker re-flips once when everything came
      // up tails (the only time a re-flip is clearly worth it).
      const src = getSlot(state, state.context.source)
      if (state.context.isAttack && src?.markers?.esp && f.coins > 0 && f.heads === 0) {
        state = pushLog(state, `Sabrina's ESP: re-flipping ${f.results.join(' ')}...`)
        f = flipCoins(f.coins)
      }
      state = setContext(state, { heads: f.heads, tails: f.tails, flipResults: f.results })
      state = pushLog(state, `Coin flip: ${f.results.length ? f.results.join(' ') : '(no coins)'}`)
      if (f.results.length) state = pushFx(state, { kind: 'coins', results: f.results, label: 'Coin flip' })
      if (state.fxQueue.length) {
        // Show the coins before the effect resolves: re-queue the effect
        // (flip already consumed, results in context) and pause here.
        const rest = { ...effect }
        delete rest.flip
        return { ...state, effectsQueue: [rest, ...state.effectsQueue] }
      }
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
  // combatView: Ditto's Transform copies the defender's attacks/type
  const view = combatView(state, ref)
  const atk = view?.attacks?.find((a) => a.name === attackName)
  if (!slot || !atk) return state
  if (state.pending || state.effectsQueue.length || state.fxQueue.length) return state

  if (slot.status === 'asleep' || slot.status === 'paralyzed') {
    return pushLog(state, `${slot.name} is ${slot.status} and can't attack.`)
  }
  // '*' locks every attack (Tunneling and other "can't attack next turn")
  if (slot.attackLock && (slot.attackLock.name === attackName || slot.attackLock.name === '*')) {
    return pushLog(state, slot.attackLock.name === '*'
      ? `${slot.name} can't attack this turn.`
      : `${slot.name} can't use ${attackName} this turn (Amnesia).`)
  }
  const enc = getAttackEffects(view.effectName, attackName)
  if (enc?.requires && !checkRequires(state, enc.requires, ref)) {
    return pushLog(state, `${attackName} can't be used right now.`)
  }
  // Energy Burn: everything counts as fire; Photosynthesis: as grass
  const burn = powerActive(state, slot, 'Energy Burn') ? 'fire'
    : powerActive(state, slot, 'Photosynthesis') ? 'grass'
    : null
  const wild = powerActive(state, slot, 'Transform') // Ditto pays with anything
  if (!costMatch({ cost: atk.cost, energyAttached: slot.energyAttached, burn, wild })) {
    return pushLog(state, `Not enough energy for ${attackName}.`)
  }

  // Under turn rules, declaring an attack ends the turn once it resolves —
  // including attacks that fizzle to confusion or Sand-attack.
  if (turnRulesActive(state)) state = { ...state, endTurnAfterResolve: true }

  const ctx = { player, source: ref, isAttack: true, attackCost: atk.cost, attackName }
  state = { ...state, context: ctx }
  state = pushFx(state, { kind: 'attack', source: ref, attackName, cardType: view.type })

  // Misty's Gyarados' Rebellion: two tails cancels the attack and shuffles
  // Gyarados away (works even while confused).
  if (slot.power?.name === 'Rebellion' && !slot.markers?.powerOff) {
    const f = flipCoins(2)
    state = pushLog(state, `Rebellion: ${slot.name} flips... ${f.results.join(' ')}`)
    state = pushFx(state, { kind: 'coins', results: f.results, label: 'Rebellion' })
    if (f.tails === 2) {
      state = pushLog(state, `${slot.name} rebels and flees!`)
      state = setContext(state, {})
      return runQueue({ ...state, effectsQueue: [{ type: 'SHUFFLE_INTO_DECK', target: 'self' }] })
    }
  }

  if (slot.status === 'confused') {
    const f = flipCoins(1)
    state = pushLog(state, `${slot.name} is confused... flip: ${f.results[0]}`)
    state = pushFx(state, { kind: 'coins', results: f.results, label: `${slot.name} is confused` })
    if (f.tails > 0) {
      state = pushLog(state, `${slot.name} hurt itself in confusion!`)
      state = applyDamage(state, ref, 20, {})
      return state
    }
  }
  if (slot.accuracyDebuff) {
    const f = flipCoins(1)
    state = pushLog(state, `Sand-attack: ${slot.name} flips... ${f.results[0]}`)
    state = pushFx(state, { kind: 'coins', results: f.results, label: 'Sand-attack accuracy check' })
    if (f.tails > 0) return pushLog(state, `${slot.name}'s attack failed!`)
  }
  // Fossil Haunter's Transparency: heads prevents everything the attack does.
  const defSlot = getSlot(state, { player: opposite[player], id: 0 })
  if (powerActive(state, defSlot, 'Transparency')) {
    const f = flipCoins(1)
    state = pushLog(state, `Transparency: ${defSlot.name} flips... ${f.results[0]}`)
    state = pushFx(state, { kind: 'coins', results: f.results, label: 'Transparency' })
    if (f.heads > 0) return pushLog(state, `Transparency prevented ${attackName}!`)
  }

  // Vermilion City Gym: Lt. Surge attackers flip — heads +10, tails 10 self
  if (stadiumActive(state, 'Vermilion City Gym') && slot.name.includes('Lt. Surge')) {
    const f = flipCoins(1)
    state = pushLog(state, `Vermilion City Gym: flip... ${f.results[0]}`)
    state = pushFx(state, { kind: 'coins', results: f.results, label: 'Vermilion City Gym' })
    if (f.heads > 0) {
      state = setContext(state, { attackBonus: 10 })
    } else {
      state = applyDamage(state, ref, 10, {})
      if (!getSlot(state, ref)) return state
    }
  }

  state = pushLog(state, `${slot.name} used ${attackName}!`)
  const effects = buildAttackEffects(slot, atk, enc)
  // Koga's Ninja Trick: the marked defender may slip to the bench before the
  // attack lands (the trick is spent either way).
  const defNow = getSlot(state, { player: opposite[player], id: 0 })
  if (defNow?.markers?.ninjaTrick && state[opposite[player]].mon.some((s, i) => i > 0 && s)) {
    effects.unshift(
      { type: 'CHOOSE', what: 'pokemon', player: 'opp', zone: 'bench', chooser: 'opp', optional: true, prompt: 'Ninja Trick: switch to a Benched Pokémon before the attack?' },
      { type: 'SWITCH_ACTIVE', player: 'opp' },
    )
    state = updateSlot(state, { player: opposite[player], id: 0 }, (s) => ({
      ...s,
      markers: Object.fromEntries(Object.entries(s.markers ?? {}).filter(([k]) => k !== 'ninjaTrick')),
    }))
  }
  return startActivation(state, state.context, effects)
}

function playTrainer(state, action) {
  const { player, uid } = action
  if (state.pending || state.effectsQueue.length || state.fxQueue.length) return state
  const card = state[player].hand.find((c) => c.uid === uid)
  if (!card || card.supertype !== 'trainer' || card.doll) return state
  if (handBlocked(state, player)) return pushLog(state, 'Your hand is set aside — you can\'t play cards from it right now.')
  if (trainerBlocked(state, player)) return pushLog(state, "You can't play Trainer cards this turn.")

  // Stadium cards sit next to the arena instead of resolving effects. A new
  // one (different name) replaces the old, which is discarded.
  if (card.subtype === 'stadium') {
    if (state.stadium?.card?.name === card.name) {
      return pushLog(state, `${card.name} is already in play.`)
    }
    state = updateZone(state, player, 'hand', (h) => h.filter((c) => c.uid !== uid))
    if (state.stadium?.card) {
      const old = state.stadium
      state = updateZone(state, old.player, 'discard', (d) => [...d, old.card])
      state = pushLog(state, `${old.card.name} was discarded.`)
    }
    state = { ...state, stadium: { card, player } }
    return pushLog(state, `${player} played ${card.name} — it's now in play.`)
  }

  const effects = getTrainerEffects(card.name)
  if (!effects) return pushLog(state, `${card.name} isn't implemented.`)
  // Hand-composition gates (Blaine's Last Resort, Good Manners)
  const restOfHand = state[player].hand.filter((c) => c.uid !== uid)
  if (effects.gate === 'emptyHand' && restOfHand.length > 0) {
    return pushLog(state, `${card.name} needs to be the only card in your hand.`)
  }
  if (effects.gate === 'noBasics' && restOfHand.some((c) => c.supertype === 'pokemon' && c.stage === 'basic')) {
    return pushLog(state, `${card.name} can't be played with Basic Pokémon in your hand.`)
  }
  if (!trainerPlayable(state, player, effects, uid)) {
    return pushLog(state, `${card.name} can't be played right now — it would have no effect.`)
  }
  // No Removal Gym: Energy Removal costs 2 extra discards from hand
  const removalTax = stadiumActive(state, 'No Removal Gym') &&
    (card.name === 'Energy Removal' || card.name === 'Super Energy Removal')
  if (removalTax && restOfHand.length < 2) {
    return pushLog(state, `No Removal Gym: you need 2 cards to discard to play ${card.name}.`)
  }
  state = updateZone(state, player, 'hand', (h) => h.filter((c) => c.uid !== uid))
  state = updateZone(state, player, 'discard', (d) => [...d, card])
  state = pushLog(state, `${player} played ${card.name}.`)
  // Chaos Gym: tails means the card fizzles straight to the discard pile
  if (stadiumActive(state, 'Chaos Gym')) {
    const f = flipCoins(1)
    state = pushLog(state, `Chaos Gym: flip... ${f.results[0]}`)
    state = pushFx(state, { kind: 'coins', results: f.results, label: 'Chaos Gym' })
    if (f.tails > 0) return pushLog(state, `Chaos Gym scrambled ${card.name} — no effect.`)
  }
  const queue = removalTax
    ? [
        { type: 'CHOOSE', what: 'cards', from: 'hand', count: 2, prompt: 'No Removal Gym: discard 2 cards from your hand' },
        { type: 'MOVE_CARDS', from: 'chosen', to: 'discard' },
        ...effects,
      ]
    : [...effects]
  return startActivation(state, { player, trainerName: card.name }, queue)
}

function usePower(state, action) {
  const { player, id } = action
  if (state.pending || state.effectsQueue.length || state.fxQueue.length) return state
  const ref = { player, id }
  const slot = getSlot(state, ref)
  const power = slot?.power ? getPowerEffects(slot.power.name) : null
  if (!power || power.passive) return state
  const usable = canUsePower(state, ref, slot, power)
  if (!usable.ok) return usable.reason ? pushLog(state, usable.reason) : state
  if (turnRulesActive(state) && power.oncePerTurn) {
    state = { ...state, turnFlags: { ...state.turnFlags, powersUsed: { ...state.turnFlags.powersUsed, [slot.uid]: true } } }
  }
  state = pushLog(state, `${slot.name} used ${slot.power.name}.`)
  return startActivation(state, { player, source: ref }, power.effects)
}

// Stadiums with a per-turn player action (Celadon / Saffron / Fuchsia gyms).
function useStadium(state, action) {
  const { player } = action
  if (state.pending || state.effectsQueue.length || state.fxQueue.length) return state
  const card = state.stadium?.card
  const spec = card ? STADIUM_ACTIONS[card.name] : null
  if (!spec) return state
  if (turnRulesActive(state) && spec.oncePerTurn && state.turnFlags?.stadiumUsed) {
    return pushLog(state, `${card.name} was already used this turn.`)
  }
  // No legal target: don't burn the once-per-turn use
  const first = spec.effects[0]
  if (first?.type === 'CHOOSE' && !chooseHasOptions({ ...state, context: { player } }, first)) {
    return pushLog(state, `${card.name}: nothing to use it on right now.`)
  }
  if (turnRulesActive(state) && spec.oncePerTurn) {
    state = { ...state, turnFlags: { ...state.turnFlags, stadiumUsed: true } }
  }
  state = pushLog(state, `${player} uses ${card.name}.`)
  return startActivation(state, { player }, spec.effects)
}

function retreat(state, action) {
  const { player } = action
  if (state.pending || state.effectsQueue.length || state.fxQueue.length) return state
  const ref = { player, id: 0 }
  const slot = getSlot(state, ref)
  if (!slot || slot.doll) return state
  if (!state[player].mon.slice(1).some(Boolean)) return pushLog(state, 'No Benched Pokémon to retreat into.')
  if (slot.status === 'asleep' || slot.status === 'paralyzed') {
    return pushLog(state, `${slot.name} is ${slot.status} and can't retreat.`)
  }
  if (slot.markers?.noRetreat) return pushLog(state, `${slot.name} can't retreat this turn.`)
  // Retreating (even a failed confused attempt) uses the once-per-turn retreat
  if (turnRulesActive(state)) state = { ...state, turnFlags: { ...state.turnFlags, retreated: true } }
  if (slot.status === 'confused') {
    const f = flipCoins(1)
    state = pushLog(state, `Confused retreat flip: ${f.results[0]}`)
    state = pushFx(state, { kind: 'coins', results: f.results, label: 'Confused retreat check' })
    if (f.tails > 0) return pushLog(state, `${slot.name} failed to retreat!`)
  }
  // retreatCostOf covers Dodrio's Retreat Aid and Ditto's copied cost
  const cost = retreatCostOf(state, player)
  const effects = [
    ...(cost > 0
      ? [
          { type: 'CHOOSE', what: 'energy', from: 'self', count: cost, unitsMode: true, prompt: `Discard ${cost} energy to retreat` },
          { type: 'DISCARD_ENERGY' },
        ]
      : []),
    { type: 'CHOOSE', what: 'pokemon', player: 'self', zone: 'bench', prompt: 'Choose your new Active Pokémon' },
    { type: 'SWITCH_ACTIVE', player: 'self' },
    // Dark Dugtrio's Sinkhole punishes the retreating pokemon on tails
    { type: 'SINKHOLE_CHECK' },
  ]
  return startActivation(state, { player, source: ref }, effects)
}

function handleDrop(state, action) {
  const { source, dest } = action
  if (state.pending) return state

  const fromCatalog = source.from === 'catalog'
  const card = fromCatalog
    ? makeCard(source.name)
    : source.from === 'hand'
      ? state[source.player]?.hand?.find((c) => c.uid === source.uid)
      : null
  if (!card) return state
  if (!fromCatalog && handBlocked(state, source.player)) {
    return pushLog(state, 'Your hand is set aside — you can\'t play cards from it right now.')
  }
  const takeFromHand = (s) =>
    fromCatalog ? s : updateZone(s, source.player, 'hand', (h) => h.filter((c) => c.uid !== card.uid))

  // drops onto a whole zone (deck / discard / hand) — sandbox testing tool
  if (dest.zone) {
    state = takeFromHand(state)
    if (dest.zone === 'deck') {
      state = updateZone(state, dest.player, 'deck', (d) => [card, ...d])
    } else {
      state = updateZone(state, dest.player, dest.zone, (z) => [...z, card])
    }
    return pushLog(state, `${card.name} was put ${dest.zone === 'deck' ? 'on top of' : 'into'} ${dest.player}'s ${dest.zone}.`)
  }

  const destSlot = state[dest.player]?.mon?.[dest.id]

  // attach energy
  if (card.supertype === 'energy' && destSlot) {
    // Crystal Beam: no energy attachments to the marked pokemon
    if (destSlot.markers?.energyBlock && !fromCatalog) {
      return pushLog(state, `Crystal Beam: energy can't be attached to ${destSlot.name} this turn.`)
    }
    let rainDance = false
    if (!fromCatalog) {
      const check = canAttachEnergy(state, source.player, card, destSlot)
      if (!check.ok) return pushLog(state, check.reason)
      if (check.consumesFlag) {
        state = { ...state, turnFlags: { ...state.turnFlags, energyAttached: true } }
      }
      rainDance = !!check.rainDance
    }
    state = takeFromHand(state)
    // Keep the whole card on the attachment: when it later hits the discard
    // pile (KO, attack cost, retreat...) it must still be a real energy card
    // so filters like Energy Retrieval's `basicEnergy` can find it.
    state = updateSlot(state, dest, (s) => ({
      ...s,
      energyAttached: [...s.energyAttached, { ...card, units: card.units ?? 1 }],
    }))
    state = pushLog(state, `Attached ${card.name} to ${destSlot.name}${rainDance ? ' (Rain Dance)' : ''}.`)
    // Special energies do something when attached from the hand
    if (card.special === 'rainbow' && !fromCatalog) {
      state = pushLog(state, `Rainbow Energy did 10 damage to ${destSlot.name}.`)
      state = applyDamage(state, dest, 10, {})
    } else if (card.special === 'fullheal') {
      state = updateSlot(state, dest, (s) => ({ ...s, status: null, poisoned: false, poisonAmount: 10 }))
      state = pushLog(state, `${destSlot.name} is cured of all special conditions.`)
    } else if (card.special === 'potion') {
      const cur = getSlot(state, dest)
      if (cur?.dc > 0) {
        state = updateSlot(state, dest, (s) => ({ ...s, dc: s.dc - 10 }))
        state = pushLog(state, `${destSlot.name} healed 10 damage.`)
      }
    }
    // Blaine's Ninetales' Healing Fire: fire attachments from hand heal 10
    if (card.energy === 'fire' && !fromCatalog && powerActive(state, getSlot(state, dest), 'Healing Fire')) {
      const cur = getSlot(state, dest)
      if (cur?.dc > 0) {
        state = updateSlot(state, dest, (s) => ({ ...s, dc: s.dc - 10 }))
        state = pushLog(state, `Healing Fire: ${destSlot.name} healed 10 damage.`)
      }
    }
    return state
  }
  // play to an empty spot: basics (or Clefairy Doll) from hand,
  // any Pokémon straight from the catalog
  const spawnable = fromCatalog
    ? card.supertype === 'pokemon' || card.doll
    : (card.stage === 'basic' || card.doll) && dest.player === source.player
  if (spawnable && !destSlot) {
    // Narrow Gym: at most 4 benched pokemon while it's in play
    if (dest.id > 0 && state[dest.player].mon.filter((s, i) => i > 0 && s).length >= benchCap(state)) {
      return pushLog(state, `The Bench is limited to ${benchCap(state)} Pokémon right now.`)
    }
    state = takeFromHand(state)
    state = updateZone(state, dest.player, 'mon', (m) => m.map((s, i) => (i === dest.id ? makeSlot(card, state.turnNumber) : s)))
    state = pushLog(state, `${card.name} was put into play.`)
    // Rocket's Minefield Gym: benching a basic from hand risks 2 counters
    if (!fromCatalog && dest.id > 0 && !card.doll && stadiumActive(state, "Rocket's Minefield Gym")) {
      const f = flipCoins(1)
      state = pushLog(state, `Rocket's Minefield Gym: flip... ${f.results[0]}`)
      state = pushFx(state, { kind: 'coins', results: f.results, label: "Rocket's Minefield Gym" })
      if (f.tails > 0) {
        state = updateSlot(state, dest, (s) => ({ ...s, dc: (s.dc ?? 0) + 20 }))
        state = pushLog(state, `${card.name} took 20 damage from the minefield.`)
        state = checkKO(state, dest)
      }
    }
    return whenPlayedPower(state, card, dest, fromCatalog)
  }
  // evolve (matched on species so re-prints from other sets stay compatible)
  if (card.supertype === 'pokemon' && destSlot && card.evolvesFrom === (destSlot.species ?? destSlot.name)) {
    state = takeFromHand(state)
    state = updateZone(state, dest.player, 'mon', (m) =>
      m.map((s, i) => (i === dest.id ? evolveSlot(s, card, state.turnNumber) : s))
    )
    state = pushLog(state, `${destSlot.name} evolved into ${card.name}!`)
    // Viridian City Gym: evolving a Giovanni pokemon heals 2 counters
    if (stadiumActive(state, 'Viridian City Gym') && card.name.includes('Giovanni')) {
      const cur = getSlot(state, dest)
      if (cur?.dc > 0) {
        state = updateSlot(state, dest, (s) => ({ ...s, dc: Math.max(0, s.dc - 20) }))
        state = pushLog(state, `Viridian City Gym: ${card.name} healed 20 damage.`)
      }
    }
    return whenPlayedPower(state, card, dest, fromCatalog)
  }
  return state
}

// "When you play this Pokémon from your hand..." powers (Summon Minions,
// Sneak Attack, Reel In, Call the Boss) trigger on entering play.
function whenPlayedPower(state, card, dest, fromCatalog) {
  if (fromCatalog) return state
  const power = card.power ? getPowerEffects(card.power.name) : null
  if (!power?.whenPlayed) return state
  const slot = getSlot(state, dest)
  if (!slot || !powerActive(state, slot, card.power.name)) return state
  state = pushLog(state, `${card.name}'s ${card.power.name} activates!`)
  return startActivation(state, { player: dest.player, source: { ...dest } }, power.effects)
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
  return pushLog(state, `${slot.name} was discarded.`)
}

function expireForPlayer(slot, player, turnNumber) {
  let s = slot
  // notBeforeTurn: duration-2 markers (Swords Dance) survive until the end
  // of their owner's *next* turn.
  const expired = (x) => x && x.expiresAfterTurnOf === player && !(x.notBeforeTurn > turnNumber)
  if (expired(s.guard)) s = { ...s, guard: null }
  if (expired(s.attackLock)) s = { ...s, attackLock: null }
  if (expired(s.accuracyDebuff)) s = { ...s, accuracyDebuff: false }
  const markers = Object.fromEntries(Object.entries(s.markers ?? {}).filter(([, v]) => !expired(v)))
  if (Object.keys(markers).length !== Object.keys(s.markers ?? {}).length) s = { ...s, markers }
  return s
}

function endTurn(state) {
  if (state.pending || state.effectsQueue.length || state.fxQueue.length) return state
  const player = state.turnPlayer

  // between-turns: poison, then sleep checks, on both actives
  for (const p of ['p1', 'p2']) {
    const ref = { player: p, id: 0 }
    const active = getSlot(state, ref)
    if (!active) continue
    if (active.poisoned) {
      state = pushLog(state, `${active.name} takes ${active.poisonAmount} poison damage.`)
      state = pushFx(state, { kind: 'poison-tick', target: ref, amount: active.poisonAmount })
      state = updateSlot(state, ref, (s) => ({ ...s, dc: (s.dc ?? 0) + s.poisonAmount }))
      state = checkKO(state, ref)
    }
    const after = getSlot(state, ref)
    if (after?.status === 'asleep') {
      const f = flipCoins(1)
      state = pushLog(state, `${after.name} sleep check: ${f.results[0]}`)
      state = pushFx(state, { kind: 'coins', results: f.results, label: `${after.name} sleep check` })
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
    state = updateZone(state, p, 'mon', (mon) => mon.map((s) => (s ? expireForPlayer(s, player, state.turnNumber) : s)))
  }

  state = { ...state, turnPlayer: opposite[player], turnNumber: state.turnNumber + 1, context: {}, reveal: null }

  // expire global effects keyed to turn numbers
  if (state.powersOff && state.turnNumber > state.powersOff.untilEndOfTurn) state = { ...state, powersOff: null }
  if (state.benchGuard && state.turnNumber > state.benchGuard.untilEndOfTurn) state = { ...state, benchGuard: null }
  if (state.handBlock && state.turnNumber > state.handBlock.untilEndOfTurn) {
    state = pushLog({ ...state, handBlock: null }, `${state.handBlock.player} gets their hand back.`)
  }
  if (state.trainerBlock && state.turnNumber > (state.trainerBlock.until ?? state.trainerBlock.turnNumber)) {
    state = { ...state, trainerBlock: null }
  }

  state = pushLog(state, `--- ${opposite[player]}'s turn (turn ${state.turnNumber}) ---`)

  if (turnRulesActive(state) && state.phase !== 'gameover') {
    state = { ...state, turnFlags: { energyAttached: false, retreated: false, powersUsed: {} } }
    if (state.mode === 'match') {
      state = drawForTurn(state, state.turnPlayer)
    } else if (state[state.turnPlayer].deck.length > 0) {
      // sandbox turn-based: draw for turn, but an empty deck never ends the game
      const next = state.turnPlayer
      state = updateZone(state, next, 'hand', (h) => [...h, state[next].deck[0]])
      state = updateZone(state, next, 'deck', (d) => d.slice(1))
      state = pushLog(state, `${next} drew a card.`)
    } else {
      state = pushLog(state, `${state.turnPlayer}'s deck is empty — no draw.`)
    }
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
      // deckTop pools come from a slice of the deck; MOVE_CARDS maps the
      // 'deckTop' zone back to the real deck when it removes them.
      const cards = chooseZoneCards(state, pending).filter((c) => payload.uids.includes(c.uid))
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
    case 'option':
      patch = { chosenOption: payload.option }
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
    case 'use-stadium':
      return useStadium(state, action)
    case 'discard-doll':
      return discardDoll(state, action)
    case 'end-turn':
      return endTurn(state)
    case 'fx-done':
      // The UI finished playing queued fx; resume the effects queue.
      return runQueue({ ...state, fxQueue: [] })
    case 'set-fx-enabled': {
      state = { ...state, fxEnabled: !!action.value }
      // Turning fx off mid-playback must not leave the game stuck.
      return state.fxEnabled ? state : runQueue({ ...state, fxQueue: [] })
    }
    case 'toggle-turn-rules': {
      if (state.mode === 'match') return state
      const on = !state.enforceTurns
      state = {
        ...state,
        enforceTurns: on,
        endTurnAfterResolve: false,
        turnFlags: { energyAttached: false, retreated: false, powersUsed: {} },
      }
      return pushLog(
        state,
        on
          ? `Turn-based rules ON — it's ${state.turnPlayer}'s turn. Attacks end the turn; energy/retreat/powers are once per turn.`
          : 'Turn-based rules OFF — free sandbox.'
      )
    }
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
    case 'close-reveal':
      return { ...state, reveal: null }
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

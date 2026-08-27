import { getSlot, updateSlot, setSlot, updateZone, pushLog, pushFx } from './state.js'
import { extraEnergy, flipCoins, shuffle } from './utils.js'
import { powerActive, combatView, maxHpOf, stadiumActive, powersGloballyOff, toxicGasInPlay } from './powers.js'

// Resolve a damage amount spec against the current context.
// number -> flat. Object specs cover every scaling attack in the card pool.
export function resolveAmount(state, amount, target) {
  if (typeof amount === 'number') return amount
  const ctx = state.context
  const self = getSlot(state, ctx.source)
  const defender = getSlot(state, target)
  let dmg = amount.base ?? 0
  if (amount.timesHeads != null) dmg += amount.timesHeads * (ctx.heads ?? 0)
  if (amount.timesTails != null) dmg += amount.timesTails * (ctx.tails ?? 0)
  if (amount.perHeads != null) dmg += amount.perHeads * (ctx.heads ?? 0)
  if (amount.perEnergyOnDefender != null && defender) dmg += amount.perEnergyOnDefender * defender.energyAttached.length
  if (amount.perDcOnDefender != null && defender) dmg += amount.perDcOnDefender * ((defender.dc ?? 0) / 10)
  if (amount.perDcOnSelf != null && self) dmg += amount.perDcOnSelf * ((self.dc ?? 0) / 10)
  if (amount.halfDefenderHP && defender) dmg += Math.ceil((defender.hp - (defender.dc ?? 0)) / 2 / 10) * 10
  // Sabrina's Kadabra's Life Drain: leave the defender at N HP
  if (amount.leaveDefenderAt != null && defender) {
    dmg += Math.max(0, maxHpOf(state, defender) - (defender.dc ?? 0) - amount.leaveDefenderAt)
  }
  if (amount.perExtraEnergy && self) {
    const extra = extraEnergy({
      type: amount.perExtraEnergy.type,
      cost: ctx.attackCost ?? {},
      energyAttached: self.energyAttached,
    })
    dmg += amount.perExtraEnergy.each * Math.min(extra, amount.perExtraEnergy.max ?? Infinity)
  }
  // Rocket's Zapdos' Electroburn: per energy of a type attached to self
  if (amount.perEnergyTypeOnSelf && self) {
    const n = self.energyAttached.reduce(
      (a, e) => a + (e.energy === amount.perEnergyTypeOnSelf.type ? e.units ?? 1 : 0), 0)
    dmg += amount.perEnergyTypeOnSelf.each * n
  }
  // Boyfriends / Magnetism / Mass Explosion: +N per matching pokemon in play
  if (amount.perInPlay) {
    const species = amount.perInPlay.speciesIn ?? [amount.perInPlay.species]
    const players = amount.perInPlay.player === 'both' ? ['p1', 'p2'] : [ctx.player]
    let n = 0
    for (const p of players) {
      state[p].mon.forEach((s, i) => {
        if (!s) return
        if (amount.perInPlay.zone === 'bench' && i === 0) return
        if (species.includes(s.species ?? s.name)) n++
      })
    }
    dmg += amount.perInPlay.each * n
  }
  // Blaine's Magmar's Lava Burst: per Fire Energy in the cards just milled
  if (amount.perLastMovedEnergy) {
    const n = (ctx.lastMovedCards ?? []).filter(
      (c) => c.supertype === 'energy' && c.energy === amount.perLastMovedEnergy.type).length
    dmg += amount.perLastMovedEnergy.each * n
  }
  // Do the Wave: +N per benched pokemon you have
  if (amount.perBench != null) {
    dmg += amount.perBench * state[ctx.player].mon.filter((s, i) => i > 0 && s).length
  }
  // Swords Dance -> Slash, Focus Energy, Giant Growth
  if (amount.plusIfMarker && self?.markers?.[amount.plusIfMarker.marker]) {
    dmg += amount.plusIfMarker.plus
  }
  // Giovanni's Nidorino's Rend / Erika's Jigglypuff's Pulled Punch
  if (amount.plusIfDefenderDamaged != null && defender && (defender.dc ?? 0) > 0) dmg += amount.plusIfDefenderDamaged
  if (amount.plusIfDefenderUndamaged != null && defender && !(defender.dc > 0)) dmg += amount.plusIfDefenderUndamaged
  // Misty's Dewgong's Ice Throw: doubled base vs a type
  if (amount.plusIfDefenderType && defender && (defender.typeOverride ?? defender.type) === amount.plusIfDefenderType.type) {
    dmg += amount.plusIfDefenderType.plus
  }
  // Koga's Arbok's Poison Power
  if (amount.plusIfSelfPoisoned != null && self?.poisoned) dmg += amount.plusIfSelfPoisoned
  // Roaring Flames: per energy discarded by the preceding DISCARD_ENERGY
  if (amount.perLastDiscarded != null) dmg += amount.perLastDiscarded * (ctx.lastDiscardCount ?? 0)
  // Vending Haunter's Poltergeist: per Trainer card in the opponent's hand
  if (amount.perOppHandTrainers != null) {
    const opp = ctx.player === 'p1' ? 'p2' : 'p1'
    dmg += amount.perOppHandTrainers * state[opp].hand.filter((c) => c.supertype === 'trainer').length
  }
  // Love Lariat: flat bonus if a matching pokemon is in play
  if (amount.plusIfInPlay) {
    const found = state[ctx.player].mon.some(
      (s, i) => s && !(amount.plusIfInPlay.zone === 'bench' && i === 0) &&
        amount.plusIfInPlay.speciesIn.includes(s.species ?? s.name))
    if (found) dmg += amount.plusIfInPlay.plus
  }
  return Math.max(0, dmg)
}

// In match mode a KO awards a prize to the opponent of the KO'd Pokémon's
// owner (Clefairy Doll excepted). Prizes are collected during settlement.
export function awardPrizeFor(state, koOwner) {
  if (state.mode !== 'match') return state
  const taker = koOwner === 'p1' ? 'p2' : 'p1'
  return { ...state, prizesOwed: { ...state.prizesOwed, [taker]: (state.prizesOwed[taker] ?? 0) + 1 } }
}

// Remove a KO'd slot: top card, evolution stack, and energy all go to that
// player's discard pile.
export function knockOut(state, ref, attackerRef = null) {
  const slot = getSlot(state, ref)
  if (!slot) return state

  // Dark Gyarados' Final Beam: on KO by an attack, heads deals 20 per Water
  // Energy back to the attacker.
  if (attackerRef && powerActive(state, slot, 'Final Beam')) {
    const water = slot.energyAttached.reduce((n, e) => n + (e.energy === 'water' ? e.units ?? 1 : 0), 0)
    if (water > 0 && getSlot(state, attackerRef)) {
      const f = flipCoins(1)
      state = pushLog(state, `Final Beam: ${slot.name} flips... ${f.results[0]}`)
      state = pushFx(state, { kind: 'coins', results: f.results, label: 'Final Beam' })
      if (f.heads > 0) {
        state = applyDamage(state, attackerRef, 20 * water, { applyWR: true, source: ref })
      }
    }
  }

  if (!slot.doll) state = awardPrizeFor(state, ref.player)
  // Rocket's Moltres' Rebirth: the KO'd card returns to hand (attachments
  // still discarded, the prize is still awarded).
  const rebirth = powerActive(state, slot, 'Rebirth')
  const cards = []
  if (!slot.isBuzzapEnergy) {
    const { supertype, name, species, set, rarity, number, image, stage, hp, type, evolvesFrom, weakness, resistance, retreatCost, power, attacks, text, energy, units, doll, uid } = slot
    cards.push({ supertype, name, species, set, rarity, number, image, stage, hp, type, evolvesFrom, weakness, resistance, retreatCost, power, attacks, text, energy, units, doll, uid })
  }
  cards.push(...(slot.prevStack ?? []))
  if (slot.shapeshift) cards.push(slot.shapeshift)
  cards.push(...slot.energyAttached.filter((e) => !e.isBuzzap).map(({ isBuzzap, ...e }) => e))
  // Buzzap'd Electrode goes to the discard as a pokemon card when discarded
  for (const e of slot.energyAttached.filter((e) => e.isBuzzap)) {
    cards.push(e.originalCard)
  }
  state = setSlot(state, ref, null)
  if (rebirth && cards.length) {
    const [top, ...rest] = cards
    state = updateZone(state, ref.player, 'hand', (h) => [...h, top])
    state = updateZone(state, ref.player, 'discard', (d) => [...d, ...rest])
    state = pushLog(state, `Rebirth: ${slot.name} returns to ${ref.player}'s hand.`)
  } else {
    state = updateZone(state, ref.player, 'discard', (d) => [...d, ...cards])
  }
  state = pushFx(state, { kind: 'ko', name: slot.name })
  return pushLog(state, `${slot.name} was Knocked Out!`)
}

export function checkKO(state, ref, attackerRef = null) {
  const slot = getSlot(state, ref)
  if (!slot || (slot.dc ?? 0) < maxHpOf(state, slot)) return state
  const hadDestinyBond = !!slot.markers?.destinyBond
  state = knockOut(state, ref, attackerRef)
  if (hadDestinyBond && attackerRef && getSlot(state, attackerRef)) {
    state = pushLog(state, `Destiny Bond: ${getSlot(state, attackerRef).name} is Knocked Out too!`)
    state = knockOut(state, attackerRef)
  }
  return state
}

// Brock's Primeape's Scram: at exactly 10 HP it shuffles itself (and all
// attached cards) into the deck.
function checkScram(state, ref) {
  const slot = getSlot(state, ref)
  if (!slot || !powerActive(state, slot, 'Scram')) return state
  if (maxHpOf(state, slot) - (slot.dc ?? 0) !== 10) return state
  const { supertype, name, species, set, rarity, number, image, stage, hp, type, evolvesFrom, weakness, resistance, retreatCost, power, attacks, text, uid } = slot
  const cards = [{ supertype, name, species, set, rarity, number, image, stage, hp, type, evolvesFrom, weakness, resistance, retreatCost, power, attacks, text, uid }]
  cards.push(...(slot.prevStack ?? []))
  cards.push(...slot.energyAttached.filter((e) => !e.isBuzzap).map(({ isBuzzap, ...e }) => e))
  state = setSlot(state, ref, null)
  state = updateZone(state, ref.player, 'deck', (d) => shuffle([...d, ...cards]))
  return pushLog(state, `Scram: ${slot.name} shuffled itself into the deck!`)
}

// Central damage pipeline. opts:
//   applyWR    - apply weakness/resistance (attack damage vs the defending active)
//   isAttack   - originates from an attack (guards + PlusPower/Defender apply)
//   fromAttack - attack-originated bench/self damage (passive powers apply)
//   source     - {player, id} of the attacker (for Strikes Back / Destiny Bond)
//   pierce     - Swift: ignores W/R, powers, guards, and markers
export function applyDamage(state, ref, rawAmount, opts = {}) {
  const { applyWR = false, isAttack = false, fromAttack = false, source = null, pierce = false } = opts
  const slot = getSlot(state, ref)
  if (!slot || rawAmount <= 0) return state

  let amount = rawAmount
  const attacker = source ? getSlot(state, source) : null
  const notes = []
  const vsAttack = isAttack || fromAttack
  const fromOpponent = source && source.player !== ref.player

  if (!pierce) {
    if (applyWR && attacker) {
      // combatView handles Ditto's Transform (copied type/weakness/resistance)
      const atkType = combatView(state, source)?.type ?? attacker.type
      const defView = combatView(state, ref) ?? slot
      const weakness = defView.weaknessOverride ?? defView.weakness
      let resistance = defView.resistanceOverride ?? defView.resistance
      // Pewter City Gym: no Resistance vs Brock Pokémon's attacks
      if (resistance && stadiumActive(state, 'Pewter City Gym') && attacker.name.includes('Brock')) resistance = null
      // Cinnabar City Gym: no Weakness when Water hits Blaine Pokémon
      const cinnabar = stadiumActive(state, 'Cinnabar City Gym') && atkType === 'water' && slot.name.includes('Blaine')
      if (weakness === atkType && !cinnabar) {
        amount *= 2
        notes.push('weakness x2')
      }
      if (resistance === atkType) {
        // Resistance Gym: -30 becomes -10
        const r = stadiumActive(state, 'Resistance Gym') ? 10 : 30
        amount = Math.max(0, amount - r)
        notes.push(`resistance -${r}`)
      }
    }
    // Misty (trainer): +20 this turn to attacks by Misty Pokémon.
    // Vermilion City Gym heads: +10 (set on context by the attack).
    if (isAttack && amount > 0 && attacker) {
      const boost = state.turnFlags?.attackBoost
      if (boost && attacker.name.includes(boost.nameIncludes)) {
        amount += boost.amount
        notes.push(`${boost.label} +${boost.amount}`)
      }
      if (state.context?.attackBonus) {
        amount += state.context.attackBonus
        notes.push(`+${state.context.attackBonus}`)
      }
      // Charity: the attacker chose to hold back.
      if (state.turnFlags?.attackReduce && source?.player === state.context?.player) {
        amount = Math.max(0, amount - state.turnFlags.attackReduce)
        notes.push(`Charity -${state.turnFlags.attackReduce}`)
      }
      // Dark Primeape's Frenzy: +30 while confused (works despite status).
      if (attacker.status === 'confused' && attacker.power?.name === 'Frenzy' &&
          !powersGloballyOff(state) && !toxicGasInPlay(state)) {
        amount += 30
        notes.push('Frenzy +30')
      }
    }
    if (isAttack && applyWR && attacker?.markers?.plusPower && amount > 0) {
      amount += 10
      notes.push('PlusPower +10')
    }
    if (isAttack && slot.markers?.defender) {
      amount = Math.max(0, amount - 20)
      notes.push('Defender -20')
    }
    // Minimize / Pounce / Snivel / Growl / Lie Low / Barrier Attack:
    // flat attack-damage reduction markers
    if (isAttack && slot.markers?.reduceDamage) {
      const v = slot.markers.reduceDamage.value ?? 0
      amount = Math.max(0, amount - v)
      notes.push(`reduced -${v}`)
    }
    // Light Screen / Deflector: halve attack damage
    if (isAttack && slot.markers?.halveDamage && amount > 0) {
      amount = Math.floor(amount / 2 / 10) * 10
      notes.push('halved ½')
    }
    // Passive defense powers (work anywhere in play, vs attack damage)
    if (vsAttack && amount > 0 && powerActive(state, slot, 'Kabuto Armor')) {
      amount = Math.floor(amount / 2 / 10) * 10
      notes.push('Kabuto Armor ½')
    }
    if (vsAttack && amount >= 30 && powerActive(state, slot, 'Invisible Wall')) {
      amount = 0
      notes.push('Invisible Wall')
    }
    if (vsAttack && amount > 0 && powerActive(state, slot, 'Shell Armor')) {
      amount = Math.max(0, amount - 10)
      notes.push('Shell Armor -10')
    }
    // Erika's Dratini: 20+ from a Basic Pokémon's attack becomes 10
    if (vsAttack && amount >= 20 && attacker?.stage === 'basic' && powerActive(state, slot, 'Strange Barrier')) {
      amount = 10
      notes.push('Strange Barrier')
    }
    // Erika's Ivysaur: while it's anyone's Active, every attack does half
    if (vsAttack && amount > 0) {
      const scent = ['p1', 'p2'].some((p) => powerActive(state, getSlot(state, { player: p, id: 0 }), 'Relaxing Scent'))
      if (scent) {
        amount = Math.ceil(amount / 2 / 10) * 10
        notes.push('Relaxing Scent ½')
      }
    }
    if (isAttack && slot.guard) {
      if (slot.guard.kind === 'damage' || slot.guard.kind === 'all') {
        amount = 0
        notes.push('prevented by guard')
      } else if (slot.guard.kind === 'threshold' && amount <= slot.guard.threshold) {
        amount = 0
        notes.push(`prevented (<= ${slot.guard.threshold})`)
      }
    }
    // Transparent Walls: no attack damage to that player's bench
    if (vsAttack && ref.id > 0 && amount > 0 && fromOpponent &&
        state.benchGuard?.player === ref.player && state.turnNumber <= state.benchGuard.untilEndOfTurn) {
      amount = 0
      notes.push('Transparent Walls')
    }
    // Rocket's Scyther's Shadow Images: flip until it takes damage
    if (isAttack && amount > 0 && slot.markers?.shadowImages && fromOpponent) {
      const f = flipCoins(1)
      state = pushLog(state, `Shadow Images: flip... ${f.results[0]}`)
      state = pushFx(state, { kind: 'coins', results: f.results, label: 'Shadow Images' })
      if (f.tails > 0) {
        amount = 0
        notes.push('Shadow Images')
      }
    }
    // Brock's Rhydon's Bench Guard: 10 of any bench damage moves to Rhydon
    if (vsAttack && ref.id > 0 && amount >= 10 && fromOpponent) {
      const guardId = state[ref.player].mon.findIndex(
        (s, i) => i > 0 && i !== ref.id && powerActive(state, s, 'Bench Guard'))
      if (guardId > 0) {
        amount -= 10
        const gRef = { player: ref.player, id: guardId }
        state = updateSlot(state, gRef, (s) => ({ ...s, dc: (s.dc ?? 0) + 10 }))
        state = pushLog(state, `Bench Guard: ${getSlot(state, gRef).name} takes 10 of the damage.`)
        state = checkKO(state, gRef)
        notes.push('Bench Guard -10')
      }
    }
  }

  if (amount <= 0) {
    return pushLog(state, `${slot.name} took no damage${notes.length ? ` (${notes.join(', ')})` : ''}.`)
  }

  state = updateSlot(state, ref, (s) => ({
    ...s,
    dc: (s.dc ?? 0) + amount,
    lastHit: isAttack && fromOpponent ? { damage: amount, turnNumber: state.turnNumber } : s.lastHit,
    // Shadow Images ends as soon as damage lands
    markers: s.markers?.shadowImages ? Object.fromEntries(Object.entries(s.markers).filter(([k]) => k !== 'shadowImages')) : s.markers,
  }))
  state = pushLog(state, `${slot.name} took ${amount} damage${notes.length ? ` (${notes.join(', ')})` : ''}.`)
  state = pushFx(state, { kind: 'hit', target: ref, amount })
  state = {
    ...state,
    context: {
      ...state.context,
      didDamage: state.context?.didDamage || amount > 0,
      // Mega Drain / Leech Life / Absorb heal based on damage dealt
      lastDamageDealt: isAttack ? amount : state.context?.lastDamageDealt,
    },
  }

  // Giovanni's Machamp's Fortitude: heads means it survives at 10 HP.
  const afterHit = getSlot(state, ref)
  if (afterHit && (afterHit.dc ?? 0) >= maxHpOf(state, afterHit) && vsAttack && fromOpponent &&
      powerActive(state, afterHit, 'Fortitude')) {
    const f = flipCoins(1)
    state = pushLog(state, `Fortitude: ${afterHit.name} flips... ${f.results[0]}`)
    state = pushFx(state, { kind: 'coins', results: f.results, label: 'Fortitude' })
    if (f.heads > 0) {
      state = updateSlot(state, ref, (s) => ({ ...s, dc: maxHpOf(state, s) - 10 }))
      state = pushLog(state, `${afterHit.name} hangs on at 10 HP!`)
    }
  }

  // --- retaliation triggered by taking attack damage -----------------------
  if (vsAttack && fromOpponent && attacker) {
    const cur = () => getSlot(state, ref)
    // Machamp's Strikes Back
    if (isAttack && powerActive(state, cur(), 'Strikes Back') && getSlot(state, source)) {
      state = pushLog(state, `Strikes Back: ${getSlot(state, source).name} takes 10 damage.`)
      state = updateSlot(state, source, (s) => ({ ...s, dc: (s.dc ?? 0) + 10 }))
      state = checkKO(state, source)
    }
    // Rocket's Snorlax: 20 back whenever it's damaged while Asleep
    if (cur()?.status === 'asleep' && powerActive(state, cur(), 'Restless Sleep') && getSlot(state, source)) {
      state = pushLog(state, `Restless Sleep: ${getSlot(state, source).name} takes 20 damage.`)
      state = updateSlot(state, source, (s) => ({ ...s, dc: (s.dc ?? 0) + 20 }))
      state = checkKO(state, source)
    }
    // Erika's Vileplume: flip heads confuses the attacking Active
    if (ref.id === 0 && isAttack && powerActive(state, cur() ?? slot, 'Pollen Defense') && getSlot(state, source)?.id === 0) {
      const f = flipCoins(1)
      state = pushLog(state, `Pollen Defense: flip... ${f.results[0]}`)
      state = pushFx(state, { kind: 'coins', results: f.results, label: 'Pollen Defense' })
      if (f.heads > 0 && getSlot(state, source) && !getSlot(state, source).doll) {
        state = updateSlot(state, source, (s) => ({ ...s, status: 'confused' }))
        state = pushLog(state, `${getSlot(state, source).name} is now confused.`)
      }
    }
    // Lt. Surge's Electrode: tails zaps both Actives for 20
    if (ref.id === 0 && powerActive(state, cur() ?? slot, 'Shock Blast')) {
      const f = flipCoins(1)
      state = pushLog(state, `Shock Blast: flip... ${f.results[0]}`)
      state = pushFx(state, { kind: 'coins', results: f.results, label: 'Shock Blast' })
      if (f.tails > 0) {
        for (const p of ['p1', 'p2']) {
          const aRef = { player: p, id: 0 }
          if (!getSlot(state, aRef)) continue
          state = updateSlot(state, aRef, (s) => ({ ...s, dc: (s.dc ?? 0) + 20 }))
          state = pushLog(state, `${getSlot(state, aRef).name} took 20 damage (Shock Blast).`)
          state = checkKO(state, aRef)
        }
      }
    }
    // Koga's Muk: heads discards an Energy from the attacker
    if (powerActive(state, cur() ?? slot, 'Energy Drain') && getSlot(state, source)?.energyAttached?.length) {
      const f = flipCoins(1)
      state = pushLog(state, `Energy Drain: flip... ${f.results[0]}`)
      state = pushFx(state, { kind: 'coins', results: f.results, label: 'Energy Drain' })
      if (f.heads > 0) {
        const atkSlot = getSlot(state, source)
        const e = atkSlot.energyAttached[0]
        state = updateSlot(state, source, (s) => ({ ...s, energyAttached: s.energyAttached.slice(1) }))
        state = updateZone(state, source.player, 'discard', (d) => [...d, ...(e.isBuzzap ? [e.originalCard] : [e])])
        state = pushLog(state, `Energy Drain discarded ${e.name} from ${atkSlot.name}.`)
      }
    }
    // reflect markers: Mirror Shell (equal), Crosscounter (double on heads),
    // Fire Wall (flat 10)
    const reflect = slot.markers?.reflectEqual ? amount
      : slot.markers?.reflect10 ? 10
      : null
    if (reflect != null && getSlot(state, source)) {
      state = pushLog(state, `${slot.name} strikes back for ${reflect}!`)
      state = applyDamage(state, source, reflect, { source: ref })
    }
    if (slot.markers?.reflectDouble && getSlot(state, source)) {
      const f = flipCoins(1)
      state = pushLog(state, `Crosscounter: flip... ${f.results[0]}`)
      state = pushFx(state, { kind: 'coins', results: f.results, label: 'Crosscounter' })
      if (f.heads > 0) {
        state = pushLog(state, `${slot.name} counters for ${amount * 2}!`)
        state = applyDamage(state, source, amount * 2, { source: ref })
      }
    }
    // Koga (trainer): this turn, damaging attacks by Koga Pokémon poison
    if (isAttack && state.turnFlags?.attackPoison && attacker.name.includes('Koga')) {
      const d = getSlot(state, ref)
      if (d && !d.doll && !powerActive(state, d, 'Thick Skinned')) {
        state = updateSlot(state, ref, (s) => ({ ...s, poisoned: true, poisonAmount: 10 }))
        state = pushLog(state, `Koga: ${d.name} is now poisoned.`)
      }
    }
  }

  state = checkScram(state, ref)
  return checkKO(state, ref, source)
}

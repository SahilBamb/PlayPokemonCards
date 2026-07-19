import { getSlot, updateSlot, setSlot, updateZone, pushLog } from './state.js'
import { extraEnergy } from './utils.js'

// Resolve a damage amount spec against the current context.
// number -> flat. Object specs cover every scaling attack in Base Set.
export function resolveAmount(state, amount, target) {
  if (typeof amount === 'number') return amount
  const ctx = state.context
  const self = getSlot(state, ctx.source)
  const defender = getSlot(state, target)
  let dmg = amount.base ?? 0
  if (amount.timesHeads != null) dmg += amount.timesHeads * (ctx.heads ?? 0)
  if (amount.perHeads != null) dmg += amount.perHeads * (ctx.heads ?? 0)
  if (amount.perEnergyOnDefender != null && defender) dmg += amount.perEnergyOnDefender * defender.energyAttached.length
  if (amount.perDcOnDefender != null && defender) dmg += amount.perDcOnDefender * ((defender.dc ?? 0) / 10)
  if (amount.perDcOnSelf != null && self) dmg += amount.perDcOnSelf * ((self.dc ?? 0) / 10)
  if (amount.halfDefenderHP && defender) dmg += Math.ceil((defender.hp - (defender.dc ?? 0)) / 2 / 10) * 10
  if (amount.perExtraEnergy && self) {
    const extra = extraEnergy({
      type: amount.perExtraEnergy.type,
      cost: ctx.attackCost ?? {},
      energyAttached: self.energyAttached,
    })
    dmg += amount.perExtraEnergy.each * Math.min(extra, amount.perExtraEnergy.max ?? Infinity)
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
export function knockOut(state, ref) {
  const slot = getSlot(state, ref)
  if (!slot) return state
  if (!slot.doll) state = awardPrizeFor(state, ref.player)
  const cards = []
  if (!slot.isBuzzapEnergy) {
    const { supertype, name, number, image, stage, hp, type, evolvesFrom, weakness, resistance, retreatCost, power, attacks, text, energy, units, doll, uid } = slot
    cards.push({ supertype, name, number, image, stage, hp, type, evolvesFrom, weakness, resistance, retreatCost, power, attacks, text, energy, units, doll, uid })
  }
  cards.push(...(slot.prevStack ?? []))
  cards.push(...slot.energyAttached.filter((e) => !e.isBuzzap).map(({ isBuzzap, ...e }) => e))
  // Buzzap'd Electrode goes to the discard as a pokemon card when discarded
  for (const e of slot.energyAttached.filter((e) => e.isBuzzap)) {
    cards.push(e.originalCard)
  }
  state = setSlot(state, ref, null)
  state = updateZone(state, ref.player, 'discard', (d) => [...d, ...cards])
  return pushLog(state, `${slot.name} was Knocked Out!`)
}

export function checkKO(state, ref, attackerRef = null) {
  const slot = getSlot(state, ref)
  if (!slot || (slot.dc ?? 0) < slot.hp) return state
  const hadDestinyBond = !!slot.markers?.destinyBond
  state = knockOut(state, ref)
  if (hadDestinyBond && attackerRef && getSlot(state, attackerRef)) {
    state = pushLog(state, `Destiny Bond: ${getSlot(state, attackerRef).name} is Knocked Out too!`)
    state = knockOut(state, attackerRef)
  }
  return state
}

// Central damage pipeline. opts:
//   applyWR    - apply weakness/resistance (attack damage vs the defending active)
//   isAttack   - originates from an attack (guards + PlusPower/Defender apply)
//   source     - {player, id} of the attacker (for Strikes Back / Destiny Bond)
export function applyDamage(state, ref, rawAmount, opts = {}) {
  const { applyWR = false, isAttack = false, source = null } = opts
  const slot = getSlot(state, ref)
  if (!slot || rawAmount <= 0) return state

  let amount = rawAmount
  const attacker = source ? getSlot(state, source) : null
  const notes = []

  if (applyWR && attacker) {
    const atkType = attacker.type
    const weakness = slot.weaknessOverride ?? slot.weakness
    const resistance = slot.resistanceOverride ?? slot.resistance
    if (weakness === atkType) {
      amount *= 2
      notes.push('weakness x2')
    }
    if (resistance === atkType) {
      amount = Math.max(0, amount - 30)
      notes.push('resistance -30')
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
  if (isAttack && slot.guard) {
    if (slot.guard.kind === 'damage' || slot.guard.kind === 'all') {
      amount = 0
      notes.push('prevented by guard')
    } else if (slot.guard.kind === 'threshold' && amount <= slot.guard.threshold) {
      amount = 0
      notes.push(`prevented (<= ${slot.guard.threshold})`)
    }
  }

  if (amount <= 0) {
    return pushLog(state, `${slot.name} took no damage${notes.length ? ` (${notes.join(', ')})` : ''}.`)
  }

  state = updateSlot(state, ref, (s) => ({
    ...s,
    dc: (s.dc ?? 0) + amount,
    lastHit: isAttack && source && source.player !== ref.player ? { damage: amount, turnNumber: state.turnNumber } : s.lastHit,
  }))
  state = pushLog(state, `${slot.name} took ${amount} damage${notes.length ? ` (${notes.join(', ')})` : ''}.`)
  state = { ...state, context: { ...state.context, didDamage: state.context?.didDamage || amount > 0 } }

  // Machamp's Strikes Back: opponent's attack damage triggers 10 back.
  if (isAttack && source && source.player !== ref.player && getSlot(state, ref)?.power?.name === 'Strikes Back') {
    const back = getSlot(state, source)
    if (back) {
      state = pushLog(state, `Strikes Back: ${back.name} takes 10 damage.`)
      state = updateSlot(state, source, (s) => ({ ...s, dc: (s.dc ?? 0) + 10 }))
      state = checkKO(state, source)
    }
  }

  return checkKO(state, ref, source)
}

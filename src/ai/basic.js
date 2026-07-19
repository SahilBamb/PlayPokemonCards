// BasicAI: greedy heuristics. Benches spare basics, evolves when legal,
// attaches energy toward affordable attacks, plays a small allowlist of
// trainers, and attacks with the highest expected damage.
import { costMatch, energyUnits } from '../engine/utils.js'

const remainingHp = (slot) => (slot?.hp ?? 0) - (slot?.dc ?? 0)

// "30" -> 30, "30+" -> 35, "10×" -> 20 (assume ~2 heads)
export function estimateDamage(atk) {
  const n = parseInt(atk?.damage ?? '', 10)
  if (Number.isNaN(n)) return 0
  if (`${atk.damage}`.includes('+')) return n + 5
  if (/[×x]/.test(`${atk.damage}`)) return n * 2
  return n
}

const bestAffordable = (slot) => {
  const burn = slot?.power?.name === 'Energy Burn' ? 'fire' : null
  return Math.max(
    0,
    ...(slot?.attacks ?? [])
      .filter((a) => costMatch({ cost: a.cost, energyAttached: slot.energyAttached, burn }))
      .map(estimateDamage)
  )
}

const hasUnaffordableAttack = (slot) => {
  const burn = slot?.power?.name === 'Energy Burn' ? 'fire' : null
  return (slot?.attacks ?? []).some((a) => !costMatch({ cost: a.cost, energyAttached: slot.energyAttached, burn }))
}

function pickBest(actions, score) {
  let best = null
  let bestScore = -Infinity
  for (const a of actions) {
    const s = score(a)
    if (s > bestScore) {
      best = a
      bestScore = s
    }
  }
  return best
}

function answerPending(actions, state, player) {
  const pending = state.pending
  const clicks = actions.filter((a) => a.type === 'click')
  if (clicks.length) {
    return pickBest(clicks, (a) => {
      const slot = state[a.player].mon[a.id]
      if (a.player !== player) return -remainingHp(slot) // finish off the weakest enemy
      if (pending.filter?.damaged || pending.filter?.canTake10) return slot.dc ?? 0 // heal the most hurt
      return remainingHp(slot) + bestAffordable(slot) // promote/switch in the strongest
    })
  }
  const resolves = actions.filter((a) => a.type === 'resolve-choice')
  if (resolves.length) {
    if (pending.what === 'attack') {
      // Metronome-style: copy the defender's hardest attack
      const def = state[player === 'p1' ? 'p2' : 'p1'].mon[0]
      return pickBest(resolves, (a) => {
        const atk = def?.attacks?.find((x) => x.name === a.payload.attackName)
        return estimateDamage(atk)
      })
    }
    return resolves[0]
  }
  return actions[0] // skip-choice or whatever is left
}

function setupMove(actions, state, player) {
  const side = state[player]
  const drops = actions.filter((a) => a.type === 'drop')
  const done = actions.find((a) => a.type === 'setup-done')
  if (!side.mon[0]) {
    const activeDrops = drops.filter((a) => a.dest.id === 0)
    return pickBest(activeDrops, (a) => side.hand.find((c) => c.uid === a.source.uid)?.hp ?? 0) ?? drops[0]
  }
  const benchCount = side.mon.slice(1).filter(Boolean).length
  if (benchCount < 3 && drops.length) {
    return pickBest(drops, (a) => side.hand.find((c) => c.uid === a.source.uid)?.hp ?? 0)
  }
  return done ?? drops[0]
}

const TRAINER_WANTS = {
  'Bill': (state, player) => state[player].deck.length > 2,
  'Potion': (state, player) => (state[player].mon[0]?.dc ?? 0) >= 20,
  'Full Heal': (state, player) => !!state[player].mon[0]?.status,
  'Energy Removal': (state, player) => {
    const opp = player === 'p1' ? 'p2' : 'p1'
    return state[opp].mon.some((s) => s?.energyAttached?.length)
  },
}

function turnMove(actions, state, player) {
  const side = state[player]
  const handCard = (uid) => side.hand.find((c) => c.uid === uid)

  // 1. bench spare basics (up to 3 benched)
  const benchCount = side.mon.slice(1).filter(Boolean).length
  if (benchCount < 3) {
    const basics = actions.filter((a) => {
      if (a.type !== 'drop') return false
      const c = handCard(a.source.uid)
      return c?.supertype === 'pokemon' && c.stage === 'basic' && !state[a.dest.player].mon[a.dest.id]
    })
    if (basics.length) return pickBest(basics, (a) => handCard(a.source.uid)?.hp ?? 0)
  }

  // 2. evolve whenever legal
  const evolves = actions.filter((a) => {
    if (a.type !== 'drop') return false
    const c = handCard(a.source.uid)
    return c?.supertype === 'pokemon' && c.evolvesFrom && state[a.dest.player].mon[a.dest.id]
  })
  if (evolves.length) return evolves[0]

  // 3. allowlisted trainers
  const trainers = actions.filter(
    (a) => a.type === 'play-trainer' && TRAINER_WANTS[handCard(a.uid)?.name]?.(state, player)
  )
  if (trainers.length) return trainers[0]

  // 4. attach energy where it works toward an attack
  const attaches = actions.filter((a) => a.type === 'drop' && handCard(a.source.uid)?.supertype === 'energy')
  if (attaches.length) {
    const pick = pickBest(attaches, (a) => {
      const slot = state[a.dest.player].mon[a.dest.id]
      let score = a.dest.id === 0 ? 5 : 0
      if (hasUnaffordableAttack(slot)) score += 20
      score -= energyUnits(slot?.energyAttached ?? []).length // spread energy around
      return score
    })
    if (pick) return pick
  }

  // 5. retreat a stuck active if the bench can actually fight
  const retreat = actions.find((a) => a.type === 'retreat')
  const attacks = actions.filter((a) => a.type === 'attack')
  if (retreat && !attacks.length && side.mon.slice(1).some((s) => s && bestAffordable(s) > 0)) {
    return retreat
  }

  // 6. attack with the biggest hit
  if (attacks.length) {
    return pickBest(attacks, (a) => {
      const atk = side.mon[0]?.attacks?.find((x) => x.name === a.attackName)
      return estimateDamage(atk)
    })
  }

  return actions.find((a) => a.type === 'end-turn') ?? actions[0]
}

export const BasicAI = {
  id: 'basic',
  name: 'Trainer Blue',
  description: 'A straightforward opponent that benches, evolves, and goes for the biggest hit.',
  pickAction(actions, state, player) {
    if (!actions.length) return null
    if (state.pending) return answerPending(actions, state, player)
    if (state.phase === 'setup') return setupMove(actions, state, player)
    return turnMove(actions, state, player)
  },
}

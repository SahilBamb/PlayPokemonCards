// StallAI: defensive personality. Heals, spreads its board wide, retreats
// hurt actives, and prefers attacks that inflict special conditions.
import { answerPending, setupMove, pickBest, estimateDamage, bestAffordable } from './basic.js'

const remainingHp = (slot) => (slot?.hp ?? 0) - (slot?.dc ?? 0)

const STATUS_WORDS = /asleep|paralyz|poison|confus/i

const TRAINER_WANTS = {
  'Potion': (state, player) => (state[player].mon[0]?.dc ?? 0) >= 20,
  'Super Potion': (state, player) => (state[player].mon[0]?.dc ?? 0) >= 40,
  'Full Heal': (state, player) => !!state[player].mon[0]?.status,
  'Defender': (state, player) => (state[player].mon[0]?.dc ?? 0) > 0,
  'Pokémon Center': (state, player) => {
    const hurt = state[player].mon.filter((s) => (s?.dc ?? 0) >= 30).length
    return hurt >= 2
  },
  'Bill': (state, player) => state[player].deck.length > 2,
  'Switch': (state, player) => {
    const active = state[player].mon[0]
    return !!active && remainingHp(active) <= 20 && state[player].mon.slice(1).some(Boolean)
  },
}

function turnMove(actions, state, player) {
  const side = state[player]
  const handCard = (uid) => side.hand.find((c) => c.uid === uid)

  // 1. defensive trainers first
  const trainers = actions.filter(
    (a) => a.type === 'play-trainer' && TRAINER_WANTS[handCard(a.uid)?.name]?.(state, player)
  )
  if (trainers.length) return trainers[0]

  // 2. fill the whole bench — prize math favors a wide, healthy board
  const benchCount = side.mon.slice(1).filter(Boolean).length
  if (benchCount < 5) {
    const drops = actions.filter((a) => {
      if (a.type !== 'drop' || a.dest.id === 0) return false
      const c = handCard(a.source.uid)
      return c?.supertype === 'pokemon' && c.stage === 'basic' && !side.mon[a.dest.id]
    })
    const drop = pickBest(drops, (a) => handCard(a.source.uid)?.hp ?? 0)
    if (drop) return drop
  }

  // 3. evolve (bigger HP buys time)
  const evolves = actions.filter((a) => {
    if (a.type !== 'drop') return false
    const c = handCard(a.source.uid)
    return c?.supertype === 'pokemon' && c.evolvesFrom && side.mon[a.dest.id]
  })
  if (evolves.length) return evolves[0]

  // 4. retreat a badly hurt active while the bench has a healthy fighter
  const retreat = actions.find((a) => a.type === 'retreat')
  const active = side.mon[0]
  if (retreat && active && remainingHp(active) <= 20) {
    const healthy = side.mon.slice(1).some((s) => s && remainingHp(s) > 30)
    if (healthy) return retreat
  }

  // 5. attach energy, spreading it so several Pokémon stay battle-ready
  const attaches = actions.filter((a) => a.type === 'drop' && handCard(a.source.uid)?.supertype === 'energy')
  if (attaches.length) {
    const pick = pickBest(attaches, (a) => {
      const slot = state[a.dest.player].mon[a.dest.id]
      return -(slot?.energyAttached?.length ?? 0) + (bestAffordable(slot) === 0 ? 3 : 0)
    })
    if (pick) return pick
  }

  // 6. attack, favoring special conditions over raw damage
  const attacks = actions.filter((a) => a.type === 'attack')
  if (attacks.length) {
    return pickBest(attacks, (a) => {
      const atk = side.mon[0]?.attacks?.find((x) => x.name === a.attackName)
      const statusBonus = STATUS_WORDS.test(atk?.text ?? '') ? 30 : 0
      return estimateDamage(atk) + statusBonus
    })
  }

  return actions.find((a) => a.type === 'end-turn') ?? actions[0]
}

export const StallAI = {
  id: 'stall',
  name: 'Wall',
  description: 'Defensive — heals, retreats, and wears you down with special conditions.',
  pickAction(actions, state, player) {
    if (!actions.length) return null
    if (state.pending) return answerPending(actions, state, player)
    if (state.phase === 'setup') return setupMove(actions, state, player)
    return turnMove(actions, state, player)
  },
}

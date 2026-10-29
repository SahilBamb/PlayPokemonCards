// AggroAI: attacks the moment it can, pours energy into the active, and only
// benches a single backup. Used for hot-headed story trainers.
import { answerPending, setupMove, pickBest, estimateDamage, hasUnaffordableAttack } from './basic.js'

function turnMove(actions, state, player) {
  const side = state[player]
  const handCard = (uid) => side.hand.find((c) => c.uid === uid)

  // 1. hit first, ask questions later
  const attacks = actions.filter((a) => a.type === 'attack')
  const bestAttack = pickBest(attacks, (a) => estimateDamage(side.mon[0]?.attacks?.find((x) => x.name === a.attackName)))
  const bestDamage = bestAttack ? estimateDamage(side.mon[0]?.attacks?.find((x) => x.name === bestAttack.attackName)) : 0
  if (bestAttack && bestDamage > 0) return bestAttack

  // 2. power up the active
  const attachActive = actions.filter(
    (a) => a.type === 'drop' && a.dest.id === 0 && handCard(a.source.uid)?.supertype === 'energy'
  )
  if (attachActive.length && hasUnaffordableAttack(side.mon[0])) return attachActive[0]

  // 3. evolve the active for bigger numbers
  const evolveActive = actions.find((a) => {
    if (a.type !== 'drop' || a.dest.id !== 0) return false
    const c = handCard(a.source.uid)
    return c?.supertype === 'pokemon' && c.evolvesFrom && side.mon[0]
  })
  if (evolveActive) return evolveActive

  // 4. keep exactly one backup on the bench
  const benchCount = side.mon.slice(1).filter(Boolean).length
  if (benchCount < 1) {
    const benchDrops = actions.filter((a) => {
      if (a.type !== 'drop' || a.dest.id === 0) return false
      const c = handCard(a.source.uid)
      return c?.supertype === 'pokemon' && c.stage === 'basic' && !side.mon[a.dest.id]
    })
    const drop = pickBest(benchDrops, (a) => handCard(a.source.uid)?.hp ?? 0)
    if (drop) return drop
  }

  // 5. any energy anywhere beats passing
  const attach = actions.find((a) => a.type === 'drop' && handCard(a.source.uid)?.supertype === 'energy')
  if (attach) return attach

  // 6. even a 0-damage attack keeps the pressure on
  if (bestAttack) return bestAttack

  return actions.find((a) => a.type === 'end-turn') ?? actions[0]
}

export const AggroAI = {
  id: 'aggro',
  name: 'Hotshot',
  description: 'All offense. Powers up its active Pokémon and attacks every turn it can.',
  pickAction(actions, state, player) {
    if (!actions.length) return null
    if (state.pending) return answerPending(actions, state, player)
    if (state.phase === 'setup') return setupMove(actions, state, player)
    return turnMove(actions, state, player)
  },
}

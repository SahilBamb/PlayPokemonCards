// RandomAI: picks any legal action. Exists mostly to prove the policy
// interface supports different personalities. Slightly weighted so it doesn't
// end its turn while it still has other options.
export const RandomAI = {
  id: 'random',
  name: 'Wild Missingno',
  description: 'Chaotic — does something legal, not necessarily something smart.',
  pickAction(actions, state, player, rng = Math.random) {
    if (!actions.length) return null
    const nonEnd = actions.filter((a) => a.type !== 'end-turn' && a.type !== 'concede')
    // 20% of the time (or when nothing else is legal) end the turn / skip
    if (!nonEnd.length || (state.phase === 'playing' && !state.pending && rng() < 0.2)) {
      return actions.find((a) => a.type === 'end-turn') ?? actions[Math.floor(rng() * actions.length)]
    }
    return nonEnd[Math.floor(rng() * nonEnd.length)]
  },
}

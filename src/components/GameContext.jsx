import { createContext, useContext } from 'react'

// Context value: { state, view, dispatch, validTargets, mode, humanPlayer }
// - `view` is the masked state (opponent hand/decks/prizes hidden) in match
//   mode; identical to `state` in sandbox. Rendering should prefer `view`.
// - `humanPlayer` is null in sandbox (both sides controllable).
export const GameContext = createContext(null)
export const useGame = () => useContext(GameContext)

// What may the local user do with `player`'s cards right now?
export function usePlayerControl(player) {
  const { state, mode, humanPlayer } = useGame()
  if (mode !== 'match') {
    return { controls: true, myTurn: true, actor: player }
  }
  const controls = humanPlayer === player
  const myTurn =
    controls && state.phase === 'playing' && state.turnPlayer === player && !state.pending && !state.effectsQueue.length
  return { controls, myTurn, actor: humanPlayer }
}

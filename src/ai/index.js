// AI policy registry. A policy is:
//   { id, name, description, pickAction(legalActions, state, player, rng) -> action | null }
// New personalities/difficulties are just new entries here.
import { BasicAI } from './basic.js'
import { RandomAI } from './random.js'

export const AI_POLICIES = {
  [BasicAI.id]: BasicAI,
  [RandomAI.id]: RandomAI,
}

export const DEFAULT_AI = BasicAI.id

// Does `player` (the AI seat) owe the game an input right now?
export function aiNeedsToAct(state, player) {
  if (state.phase === 'gameover') return false
  if (state.pending) return state.pending.chooserPlayer === player
  if (state.effectsQueue.length) return false
  if (state.phase === 'setup') return !state.setupDone[player]
  return state.turnPlayer === player
}

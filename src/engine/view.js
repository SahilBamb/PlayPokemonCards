// maskStateFor(state, player): what `player` is allowed to see. The opponent's
// hand, both decks, and both prize piles are replaced with hidden card stubs
// (uid kept so React keys stay stable). The play mode UI renders from this
// view; a multiplayer server would send it per-client.
import { opposite } from './utils.js'
import { clairvoyanceFor } from './powers.js'

const hide = (cards) => cards.map((c) => ({ hidden: true, uid: c.uid }))

export function maskStateFor(state, player) {
  const opp = opposite[player]
  // Omanyte's Clairvoyance: your opponent plays with their hand face up.
  const seeOppHand = clairvoyanceFor(state, player)
  return {
    ...state,
    // Peeked cards (Mankey's Peek) are only visible to whoever peeked.
    reveal: state.reveal && state.reveal.player === player ? state.reveal : null,
    [player]: {
      ...state[player],
      deck: hide(state[player].deck),
      prizes: hide(state[player].prizes),
    },
    [opp]: {
      ...state[opp],
      hand: seeOppHand ? state[opp].hand : hide(state[opp].hand),
      deck: hide(state[opp].deck),
      prizes: hide(state[opp].prizes),
    },
  }
}

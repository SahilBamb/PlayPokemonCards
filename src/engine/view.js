// maskStateFor(state, player): what `player` is allowed to see. The opponent's
// hand, both decks, and both prize piles are replaced with hidden card stubs
// (uid kept so React keys stay stable). The play mode UI renders from this
// view; a multiplayer server would send it per-client.
import { opposite } from './utils.js'

const hide = (cards) => cards.map((c) => ({ hidden: true, uid: c.uid }))

export function maskStateFor(state, player) {
  const opp = opposite[player]
  return {
    ...state,
    [player]: {
      ...state[player],
      deck: hide(state[player].deck),
      prizes: hide(state[player].prizes),
    },
    [opp]: {
      ...state[opp],
      hand: hide(state[opp].hand),
      deck: hide(state[opp].deck),
      prizes: hide(state[opp].prizes),
    },
  }
}

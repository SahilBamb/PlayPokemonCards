import { useReducer, useMemo, useEffect, useRef, useState } from 'react'
import { GameContext } from './GameContext.jsx'
import { Board, LogPanel, GameOverOverlay } from './Board.jsx'
import { ChoiceModal, ZoneViewer, RevealOverlay } from './Modals.jsx'
import { SettingsButton, useSettings, fxWanted } from './Settings.jsx'
import { FxProvider } from './FxPlayer.jsx'
import { reducer, initialMatchState, pendingClickTargets } from '../engine/reducer.js'
import { enumerateActions } from '../engine/actions.js'
import { maskStateFor } from '../engine/view.js'
import { AI_POLICIES, DEFAULT_AI, aiNeedsToAct } from '../ai/index.js'

// Keep the engine's fxEnabled flag in sync with the user's settings — also
// re-applies after a reset/rematch recreates the state with the default (off).
// Also consumed by the sandbox, outside this view.
// eslint-disable-next-line react-refresh/only-export-components
export function useFxSync(state, dispatch) {
  const { settings } = useSettings()
  const wanted = fxWanted(settings)
  useEffect(() => {
    if (state.fxEnabled !== wanted) dispatch({ type: 'set-fx-enabled', value: wanted })
  }, [state.fxEnabled, wanted, dispatch])
}

const HUMAN = 'p1'
const AI = 'p2'
const AI_DELAY_MS = 600
const AI_MOVE_CAP = 60 // per turn, safety net against pathological loops

// A rule-enforced match vs the AI. Quick Play passes deck ids/lists; Story
// Mode additionally passes `opponent` ({name, image}) for the header portrait
// and `onResult(won)` which fires exactly once when the match ends.
export function MatchScreen({ config, onExit, onRematch, exitLabel }) {
  const [state, dispatch] = useReducer(
    reducer,
    {
      p1DeckId: config.playerDeckId,
      p2DeckId: config.aiDeckId,
      p1DeckList: config.playerDeckList ?? null,
      p1DeckName: config.playerDeckName ?? null,
      p2DeckList: config.aiDeckList ?? null,
      p2DeckName: config.aiDeckName ?? null,
    },
    initialMatchState
  )
  const view = useMemo(() => maskStateFor(state, HUMAN), [state])
  const [handSelection, setHandSelection] = useState(null)
  const visibleSelection = handSelection && state[HUMAN].hand.some((card) => card.uid === handSelection.uid) ? handSelection : null
  const selectHandCard = (card) => setHandSelection((previous) => !card || previous?.uid === card.uid ? null : { from: 'hand', player: HUMAN, uid: card.uid, name: card.name })
  const placeSelectedCard = (dest) => {
    if (!visibleSelection) return
    dispatch({ type: 'drop', source: visibleSelection, dest })
    setHandSelection(null)
  }
  const validTargets = useMemo(() => {
    const pending = state.pending
    if (!pending || pending.chooserPlayer !== HUMAN) return []
    return pendingClickTargets(state)
  }, [state])
  useFxSync(state, dispatch)

  // Report the result upward (story rewards) exactly once per match.
  const reported = useRef(false)
  useEffect(() => {
    if (state.phase === 'gameover' && !reported.current) {
      reported.current = true
      config.onResult?.(state.winner === HUMAN)
    }
  }, [state.phase, state.winner, config])

  // AI driver: whenever the AI owes the game an input (its turn, its setup,
  // or a pending choice assigned to it), pick a legal action after a short
  // delay so moves are watchable.
  const policy = AI_POLICIES[config.aiId] ?? AI_POLICIES[DEFAULT_AI]
  const aiMoves = useRef(0)
  useEffect(() => {
    if (state.turnPlayer !== AI) aiMoves.current = 0
    if (!aiNeedsToAct(state, AI)) return
    const timer = setTimeout(() => {
      const actions = enumerateActions(state, AI)
      if (!actions.length) return
      let action = policy.pickAction(actions, state, AI) ?? actions[0]
      if (++aiMoves.current > AI_MOVE_CAP) {
        action = actions.find((a) => a.type === 'end-turn') ?? action
      }
      dispatch(action)
    }, AI_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state, policy])

  return (
    <GameContext.Provider value={{ state, view, dispatch, validTargets, mode: 'match', humanPlayer: HUMAN, ...(config.storyAtlas ? { handSelection: visibleSelection, selectHandCard, placeSelectedCard } : {}) }}>
      <FxProvider>
        <div className={`w-full h-screen flex gap-2 p-2 ${config.storyAtlas ? 'story-battle' : ''}`}>
          <div className="battle-topbar absolute top-4 left-4 z-30 flex items-center gap-2">
            <button onClick={onExit} className="px-3 py-1 rounded-sm bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-white text-xs font-semibold shadow">
              {config.opponent ? '← Forfeit' : '← Menu'}
            </button>
            <SettingsButton />
            {config.storyAtlas && <span className="battle-location">{config.storyLocation}</span>}
            {config.opponent ? (
              <span className="pl-1 pr-3 py-1 rounded-sm bg-zinc-900/80 border border-zinc-700 text-xs font-semibold text-zinc-200 shadow flex items-center gap-2">
                {config.opponent.image && (
                  <img src={config.opponent.image} alt="" className="w-7 h-7 object-contain object-top" draggable={false} />
                )}
                vs {config.opponent.name}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-sm bg-zinc-900/80 border border-zinc-700 text-xs font-semibold text-zinc-300 shadow">
                vs {policy.name}
              </span>
            )}
          </div>
          <Board />
          <LogPanel />
        </div>
        <ChoiceModal />
        <ZoneViewer />
        <RevealOverlay />
        <GameOverOverlay onExit={onExit} onRematch={onRematch} exitLabel={exitLabel} />
      </FxProvider>
    </GameContext.Provider>
  )
}

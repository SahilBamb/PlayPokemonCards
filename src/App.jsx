import { useReducer, useMemo, useEffect, useRef, useState, useCallback } from 'react'
import './App.css'
import { GameContext } from './components/GameContext.jsx'
import { CardPreviewProvider } from './components/CardPreview.jsx'
import { PokeballBackground } from './components/Background.jsx'
import { MainMenu } from './components/MainMenu.jsx'
import { Board, LogPanel, GameOverOverlay } from './components/Board.jsx'
import { ChoiceModal, ZoneViewer } from './components/Modals.jsx'
import { reducer, initialGameState, initialMatchState, pendingClickTargets } from './engine/reducer.js'
import { enumerateActions } from './engine/actions.js'
import { maskStateFor } from './engine/view.js'
import { makeCard, makeSlot } from './engine/cards.js'
import { AI_POLICIES, DEFAULT_AI, aiNeedsToAct } from './ai/index.js'

function SandboxScreen({ onExit }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialGameState)
  const validTargets = useMemo(() => pendingClickTargets(state), [state])

  // Sandbox console helper: window.__game.spawn('Charizard') puts any card in
  // p1's hand; state/dispatch are exposed for experimenting and testing.
  useEffect(() => {
    window.__game = {
      state,
      dispatch,
      makeCard,
      makeSlot,
      spawn: (name, player = 'p1') => dispatch({ type: 'debug-spawn', player, name }),
    }
    return () => {
      delete window.__game
    }
  }, [state])

  return (
    <GameContext.Provider value={{ state, view: state, dispatch, validTargets, mode: 'sandbox', humanPlayer: null }}>
      <div className="w-full h-screen flex gap-2 p-2">
        <div className="absolute top-4 left-4 z-30">
          <button onClick={onExit} className="px-3 py-1 rounded-sm bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-white text-xs font-semibold shadow">
            ← Menu
          </button>
        </div>
        <Board />
        <LogPanel />
      </div>
      <ChoiceModal />
      <ZoneViewer />
    </GameContext.Provider>
  )
}

const HUMAN = 'p1'
const AI = 'p2'
const AI_DELAY_MS = 600
const AI_MOVE_CAP = 60 // per turn, safety net against pathological loops

function MatchScreen({ config, onExit, onRematch }) {
  const [state, dispatch] = useReducer(
    reducer,
    { p1DeckId: config.playerDeckId, p2DeckId: config.aiDeckId },
    initialMatchState
  )
  const view = useMemo(() => maskStateFor(state, HUMAN), [state])
  const validTargets = useMemo(() => {
    const pending = state.pending
    if (!pending || pending.chooserPlayer !== HUMAN) return []
    return pendingClickTargets(state)
  }, [state])

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
    <GameContext.Provider value={{ state, view, dispatch, validTargets, mode: 'match', humanPlayer: HUMAN }}>
      <div className="w-full h-screen flex gap-2 p-2">
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
          <button onClick={onExit} className="px-3 py-1 rounded-sm bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-white text-xs font-semibold shadow">
            ← Menu
          </button>
          <span className="px-3 py-1 rounded-sm bg-zinc-900/80 border border-zinc-700 text-xs font-semibold text-zinc-300 shadow">
            vs {policy.name}
          </span>
        </div>
        <Board />
        <LogPanel />
      </div>
      <ChoiceModal />
      <ZoneViewer />
      <GameOverOverlay onExit={onExit} onRematch={onRematch} />
    </GameContext.Provider>
  )
}

export default function App() {
  const [screen, setScreen] = useState('menu') // menu | sandbox | game
  const [matchConfig, setMatchConfig] = useState(null)
  const [matchKey, setMatchKey] = useState(0)

  const toMenu = useCallback(() => setScreen('menu'), [])

  let content
  if (screen === 'sandbox') {
    content = <SandboxScreen onExit={toMenu} />
  } else if (screen === 'game' && matchConfig) {
    content = (
      <MatchScreen
        key={matchKey}
        config={matchConfig}
        onExit={toMenu}
        onRematch={() => setMatchKey((k) => k + 1)}
      />
    )
  } else {
    content = (
      <MainMenu
        onSandbox={() => setScreen('sandbox')}
        onPlay={(config) => {
          setMatchConfig(config)
          setMatchKey((k) => k + 1)
          setScreen('game')
        }}
      />
    )
  }
  return (
    <CardPreviewProvider>
      <PokeballBackground />
      {content}
    </CardPreviewProvider>
  )
}

import { useReducer, useMemo, useEffect, useState, useCallback } from 'react'
import './App.css'
import { GameContext } from './components/GameContext.jsx'
import { CardPreviewProvider } from './components/CardPreview.jsx'
import { PokeballBackground } from './components/Background.jsx'
import { MainMenu } from './components/MainMenu.jsx'
import { DeckEditor } from './components/DeckEditor.jsx'
import { Board } from './components/Board.jsx'
import { ChoiceModal, ZoneViewer, RevealOverlay } from './components/Modals.jsx'
import { SandboxSidePanel } from './components/CardCatalog.jsx'
import { SettingsProvider, SettingsButton } from './components/Settings.jsx'
import { FxProvider } from './components/FxPlayer.jsx'
import { MatchScreen, useFxSync } from './components/MatchScreen.jsx'
import { StoryMode } from './components/story/StoryMode.jsx'
import { reducer, initialGameState, pendingClickTargets } from './engine/reducer.js'
import { makeCard, makeSlot } from './engine/cards.js'

function SandboxScreen({ onExit }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialGameState)
  const validTargets = useMemo(() => pendingClickTargets(state), [state])
  const [sidePanel, setSidePanel] = useState('log') // 'log' | 'cards'
  useFxSync(state, dispatch)

  // Right-clicking the right quarter of the screen flips the side panel
  // between the game log and the card catalog. Card previews call
  // preventDefault first, so skip if already handled.
  const onContextMenu = useCallback((e) => {
    if (e.defaultPrevented) return
    if (e.clientX > window.innerWidth * 0.75) {
      e.preventDefault()
      setSidePanel((p) => (p === 'cards' ? 'log' : 'cards'))
    }
  }, [])

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
      <FxProvider>
        <div className="w-full h-screen flex gap-2 p-2" onContextMenu={onContextMenu}>
          <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
            <button onClick={onExit} className="px-3 py-1 rounded-sm bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-white text-xs font-semibold shadow">
              ← Menu
            </button>
            <SettingsButton />
          </div>
          <Board />
          <SandboxSidePanel panel={sidePanel} onSelect={setSidePanel} />
        </div>
        <ChoiceModal />
        <ZoneViewer />
        <RevealOverlay />
      </FxProvider>
    </GameContext.Provider>
  )
}

export default function App() {
  const [screen, setScreen] = useState('menu') // menu | sandbox | game | editor | story
  const [matchConfig, setMatchConfig] = useState(null)
  const [matchKey, setMatchKey] = useState(0)

  const toMenu = useCallback(() => setScreen('menu'), [])

  let content
  if (screen === 'sandbox') {
    content = <SandboxScreen onExit={toMenu} />
  } else if (screen === 'editor') {
    content = <DeckEditor onExit={toMenu} />
  } else if (screen === 'story') {
    content = <StoryMode onExit={toMenu} />
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
        onEditor={() => setScreen('editor')}
        onStory={() => setScreen('story')}
        onPlay={(config) => {
          setMatchConfig(config)
          setMatchKey((k) => k + 1)
          setScreen('game')
        }}
      />
    )
  }
  return (
    <SettingsProvider>
      <CardPreviewProvider>
        <PokeballBackground />
        {content}
      </CardPreviewProvider>
    </SettingsProvider>
  )
}

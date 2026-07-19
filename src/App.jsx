import { useReducer, useMemo, useEffect } from 'react'
import './App.css'
import { GameContext, useGame } from './components/GameContext.jsx'
import { Hand, Row } from './components/Zones.jsx'
import { ChoiceModal, ZoneViewer } from './components/Modals.jsx'
import { reducer, initialGameState, validPokemonRefs } from './engine/reducer.js'
import { makeCard, makeSlot } from './engine/cards.js'

function PromptBar() {
  const { state, dispatch } = useGame()
  const pending = state.pending
  return (
    <div className="flex items-center gap-4">
      <div className="text-sm font-bold px-4 py-1 rounded-full bg-slate-800 text-white">
        {state.turnPlayer}'s turn · #{state.turnNumber}
      </div>
      {pending ? (
        <div className="flex items-center gap-2 bg-yellow-100 border border-yellow-400 px-4 py-1 rounded-full text-sm font-semibold animate-pulse">
          {pending.prompt ?? 'Choose a target'}
          {pending.optional && pending.what === 'pokemon' && (
            <button onClick={() => dispatch({ type: 'skip-choice' })} className="text-xs bg-white border rounded-full px-2 py-0.5 hover:bg-gray-100">
              Skip
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => dispatch({ type: 'end-turn' })}
          className="px-4 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow"
        >
          End Turn
        </button>
      )}
      <button
        onClick={() => dispatch({ type: 'reset' })}
        className="px-3 py-1 rounded-full bg-gray-200 hover:bg-gray-300 text-xs text-gray-600"
      >
        Reset
      </button>
    </div>
  )
}

function LogPanel() {
  const { state } = useGame()
  return (
    <aside className="w-64 shrink-0 h-full bg-slate-900 rounded-l-xl flex flex-col">
      <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest px-3 py-2 border-b border-slate-700">
        Game Log
      </h2>
      <div className="flex-1 text-slate-200 text-xs p-3 flex flex-col-reverse overflow-y-auto">
        <ul className="space-y-1">
          {state.log.map((msg, i) => (
            <li key={i} className={msg.startsWith('---') ? 'text-emerald-400 font-bold pt-1' : msg.startsWith('Coin flip') ? 'text-amber-300' : ''}>
              {msg}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

function Board() {
  const { state } = useGame()
  return (
    <div className="flex-1 min-w-0 flex flex-col justify-between gap-3 p-4 overflow-auto">
      <Hand player="p2" />
      <Row player="p2" mirrored />
      <div className="flex justify-center">
        <PromptBar />
      </div>
      <Row player="p1" />
      <Hand player="p1" />
    </div>
  )
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialGameState)
  const validTargets = useMemo(
    () => (state.pending?.what === 'pokemon' ? validPokemonRefs(state, state.pending) : []),
    [state]
  )

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
  }, [state])

  return (
    <GameContext.Provider value={{ state, dispatch, validTargets }}>
      <div className="w-full h-screen flex bg-gradient-to-br from-emerald-50 to-sky-100">
        <Board />
        <LogPanel />
      </div>
      <ChoiceModal />
      <ZoneViewer />
    </GameContext.Provider>
  )
}

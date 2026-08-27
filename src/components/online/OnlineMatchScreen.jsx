// Networked match UI. The server always addresses this client as "p1"
// (perspective-swapped server-side), so the whole single-player board stack —
// Board, modals, prompts, game-over overlay — renders unchanged from the
// masked view the server streams down.
import { useState, useMemo, useCallback, useSyncExternalStore } from 'react'
import { GameContext } from '../GameContext.jsx'
import { Board, LogPanel, GameOverOverlay } from '../Board.jsx'
import { ChoiceModal, ZoneViewer, RevealOverlay } from '../Modals.jsx'
import { SettingsButton } from '../Settings.jsx'
import { FxProvider } from '../FxPlayer.jsx'

const SEAT = 'p1'

function useSession(session) {
  return useSyncExternalStore(
    useCallback((cb) => session.subscribe(cb), [session]),
    () => session.version
  )
}

export function OnlineMatchScreen({ session, onExit }) {
  useSession(session)
  const [viewZone, setViewZone] = useState(null)
  const payload = session.payload

  // Zone viewing is a purely local concern online (the discard piles are
  // already public in the masked view); everything else goes to the server.
  const dispatch = useCallback(
    (action) => {
      if (action.type === 'view-zone') return setViewZone({ player: action.player, zone: action.zone })
      if (action.type === 'close-view') return setViewZone(null)
      if (action.type === 'fx-done' || action.type === 'set-fx-enabled') return
      session.room.send('action', action)
    },
    [session]
  )

  const state = useMemo(() => (payload ? { ...payload.view, viewZone } : null), [payload, viewZone])
  const validTargets = payload?.targets ?? []
  const opponent = session.start?.opponent
  const ranked = session.start?.ranked
  const lostConnection = session.closed && state?.phase !== 'gameover'

  if (!state) {
    return (
      <div className="w-full h-screen flex items-center justify-center text-white">
        <span className="text-lg font-bold uppercase tracking-wide animate-pulse">Setting up the match…</span>
      </div>
    )
  }

  return (
    <GameContext.Provider value={{ state, view: state, dispatch, validTargets, mode: 'match', humanPlayer: SEAT }}>
      <FxProvider>
        <div className="w-full h-screen flex gap-2 p-2">
          <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
            <button
              onClick={() => {
                if (state.phase !== 'gameover') dispatch({ type: 'concede', player: SEAT })
                else onExit()
              }}
              className="px-3 py-1 rounded-sm bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-white text-xs font-semibold shadow"
            >
              ← Forfeit
            </button>
            <SettingsButton />
            <span className="px-3 py-1 rounded-sm bg-zinc-900/80 border border-zinc-700 text-xs font-semibold text-zinc-300 shadow">
              vs {opponent?.name ?? '???'}
              {ranked && opponent?.elo != null && <span className="text-zinc-500"> · {opponent.elo} Elo</span>}
              {ranked && <span className="ml-1 text-poke-red font-black uppercase">Ranked</span>}
            </span>
            {!session.oppConnected && (
              <span className="px-3 py-1 rounded-sm bg-amber-900/80 border border-amber-600 text-xs font-semibold text-amber-200 shadow animate-pulse">
                Opponent disconnected — waiting…
              </span>
            )}
          </div>
          <Board />
          <LogPanel />
        </div>
        <ChoiceModal />
        <ZoneViewer />
        <RevealOverlay />
        <GameOverOverlay onExit={onExit} exitLabel="Back to Lobby" />
        {state.phase === 'gameover' && session.result?.elo && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] px-5 py-2 rounded-sm bg-zinc-900 border-2 border-zinc-700 shadow-2xl text-sm font-bold text-white">
            {session.result.elo.delta >= 0 ? (
              <span className="text-emerald-400">+{session.result.elo.delta} Elo</span>
            ) : (
              <span className="text-red-400">{session.result.elo.delta} Elo</span>
            )}
            <span className="text-zinc-400"> → {session.result.elo.elo}</span>
          </div>
        )}
        {lostConnection && (
          <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-zinc-900 border-2 border-zinc-700 rounded-sm shadow-2xl p-8 flex flex-col items-center gap-4 max-w-md text-center text-white">
              <h1 className="text-2xl font-black uppercase tracking-wide text-zinc-200">Connection lost</h1>
              <p className="text-zinc-400 text-sm">{session.error ?? 'The match connection was closed.'}</p>
              <button
                onClick={onExit}
                className="px-5 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 border-2 border-zinc-600 font-bold uppercase tracking-wide"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        )}
      </FxProvider>
    </GameContext.Provider>
  )
}

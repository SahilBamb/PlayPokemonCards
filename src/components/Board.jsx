import { useGame } from './GameContext.jsx'
import { Hand, Row } from './Zones.jsx'

function SetupBar() {
  const { state, dispatch, humanPlayer } = useGame()
  const ready = state.setupDone[humanPlayer]
  const hasActive = !!state[humanPlayer].mon[0]
  return (
    <div className="flex items-center gap-3 bg-zinc-800 border-2 border-poke-red px-4 py-1.5 rounded-sm text-sm font-semibold text-white">
      {ready
        ? 'Waiting for the opponent to finish setup...'
        : 'Setup: drag a Basic Pokémon to your Active spot (bench others if you like), then press Ready.'}
      {!ready && (
        <button
          onClick={() => dispatch({ type: 'setup-done', player: humanPlayer })}
          disabled={!hasActive}
          className="px-4 py-0.5 rounded-sm bg-poke-red hover:bg-[#f4460f] border-b-2 border-poke-red-dark text-white font-bold uppercase tracking-wide disabled:opacity-40"
        >
          Ready
        </button>
      )}
    </div>
  )
}

function PromptBar() {
  const { state, dispatch, mode, humanPlayer } = useGame()
  const pending = state.pending
  const isMatch = mode === 'match'
  const myTurn = !isMatch || state.turnPlayer === humanPlayer
  const pendingIsMine = pending && (!isMatch || pending.chooserPlayer === humanPlayer)

  if (isMatch && state.phase === 'setup') return <SetupBar />

  return (
    <div className="flex items-center gap-4">
      <div
        data-testid="turn-banner"
        className={`text-sm font-bold px-4 py-1 rounded-sm text-white border-b-2 ${myTurn ? 'bg-poke-red border-poke-red-dark' : 'bg-zinc-800 border-black'}`}
      >
        {isMatch ? (myTurn ? 'Your turn' : 'Opponent is thinking...') : `${state.turnPlayer}'s turn`} · #{state.turnNumber}
      </div>
      {pending ? (
        <div className="flex items-center gap-2 bg-amber-100 border-2 border-amber-400 dark:bg-amber-950/80 dark:border-amber-500 dark:text-amber-100 px-4 py-1 rounded-sm text-sm font-semibold animate-pulse">
          {pendingIsMine ? (pending.prompt ?? 'Choose a target') : 'Opponent is choosing...'}
          {pendingIsMine && pending.optional && pending.what === 'pokemon' && (
            <button
              onClick={() => dispatch({ type: 'skip-choice', actor: humanPlayer })}
              className="text-xs bg-white border rounded-sm px-2 py-0.5 hover:bg-gray-100 dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Skip
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => dispatch({ type: 'end-turn', actor: isMatch ? humanPlayer : state.turnPlayer })}
          disabled={isMatch && !myTurn}
          className="px-4 py-1 rounded-sm bg-poke-red hover:bg-[#f4460f] border-b-2 border-poke-red-dark text-white text-sm font-bold uppercase tracking-wide shadow disabled:opacity-40"
        >
          End Turn
        </button>
      )}
      {!isMatch && (
        <>
          <button
            data-testid="turn-rules-toggle"
            onClick={() => dispatch({ type: 'toggle-turn-rules' })}
            title="Enforce turn order, one energy per turn, once-per-turn powers, attacks ending the turn, and a draw each turn"
            className={`px-3 py-1 rounded-sm border text-xs font-bold uppercase tracking-wide ${
              state.enforceTurns
                ? 'bg-poke-red hover:bg-[#f4460f] border-poke-red-dark text-white'
                : 'bg-zinc-700 hover:bg-zinc-600 border-zinc-500 text-zinc-200'
            }`}
          >
            {state.enforceTurns ? 'Exit Turn Based' : 'Enter Turn Based'}
          </button>
          <button
            onClick={() => dispatch({ type: 'reset' })}
            className="px-3 py-1 rounded-sm bg-zinc-700 hover:bg-zinc-600 border border-zinc-500 text-xs text-zinc-200"
          >
            Reset
          </button>
        </>
      )}
      {isMatch && state.phase !== 'gameover' && (
        <button
          onClick={() => dispatch({ type: 'concede', player: humanPlayer })}
          className="px-3 py-1 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-xs text-red-400"
        >
          Concede
        </button>
      )}
    </div>
  )
}

export function LogBody() {
  const { state } = useGame()
  return (
    <div className="flex-1 text-zinc-200 text-xs p-3 flex flex-col-reverse overflow-y-auto">
      <ul className="space-y-1">
        {state.log.map((msg, i) => (
          <li key={i} className={msg.startsWith('---') || msg.startsWith('***') ? 'text-poke-red font-bold pt-1' : msg.startsWith('Coin flip') ? 'text-amber-300' : ''}>
            {msg}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LogPanel() {
  return (
    <aside className="ppc-log-surface w-64 shrink-0 h-full bg-zinc-950/85 border border-zinc-800 rounded-sm backdrop-blur-sm flex flex-col">
      <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-widest px-3 py-2 border-b-2 border-poke-red/60 flex items-center gap-2">
        <img src="/pokeball.svg" alt="" className="w-3.5 h-3.5 opacity-70" draggable={false} />
        Game Log
      </h2>
      <LogBody />
    </aside>
  )
}

export function GameOverOverlay({ onExit, onRematch, exitLabel = 'Return to Menu' }) {
  const { state, mode, humanPlayer } = useGame()
  if (state.phase !== 'gameover') return null
  const won = mode !== 'match' || state.winner === humanPlayer
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
      <div data-testid="game-over" className="bg-zinc-900 border-2 border-zinc-700 rounded-sm shadow-2xl p-8 flex flex-col items-center gap-4 max-w-md text-center text-white">
        <img src="/pokeball.svg" alt="" className={`w-14 h-14 ${won ? '' : 'grayscale opacity-60'}`} draggable={false} />
        <h1 className={`text-4xl font-black uppercase tracking-wide ${won ? 'text-poke-red' : 'text-zinc-400'}`}>
          {won ? 'You win!' : 'You lose!'}
        </h1>
        <p className="text-zinc-400">{state.winReason}</p>
        <div className="flex gap-3">
          {onRematch && (
            <button onClick={onRematch} className="px-5 py-2 rounded-sm bg-poke-red hover:bg-[#f4460f] border-b-4 border-poke-red-dark text-white font-bold uppercase tracking-wide">
              Rematch
            </button>
          )}
          <button
            onClick={onExit}
            data-testid="game-over-exit"
            className="px-5 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 border-2 border-zinc-600 text-white font-bold uppercase tracking-wide"
          >
            {exitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Board() {
  return (
    <div className="ppc-board-surface flex-1 min-w-0 flex flex-col justify-between gap-3 p-4 overflow-auto bg-zinc-100/90 border border-zinc-300 dark:bg-zinc-900/80 dark:border-zinc-700 rounded-sm shadow-2xl">
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

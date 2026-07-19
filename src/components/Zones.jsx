import { useGame } from './GameContext.jsx'
import { HandCard, BoardCard, EmptySpot, CardBack } from './Card.jsx'

export function Deck({ player }) {
  const { state, dispatch, mode } = useGame()
  const clickable = mode !== 'match'
  return (
    <div
      onClick={() => clickable && dispatch({ type: 'draw', player })}
      title={clickable ? 'Click to draw' : 'Deck (draws are automatic)'}
      className={`relative w-20 h-28 shrink-0 flex items-center justify-center rounded-sm shadow-md overflow-hidden
        bg-gradient-to-br from-poke-red to-poke-red-dark text-white font-bold border-2 border-zinc-900 border-b-4
        ${clickable ? 'cursor-pointer hover:brightness-110' : ''}`}
    >
      <img src="/pokeball.svg" alt="" className="absolute inset-0 m-auto w-12 h-12 opacity-25" draggable={false} />
      <span className="relative drop-shadow">{state[player].deck.length}</span>
    </div>
  )
}

export function DiscardPile({ player }) {
  const { state, dispatch } = useGame()
  const pile = state[player].discard
  const top = pile[pile.length - 1]
  return (
    <div
      onClick={() => dispatch({ type: 'view-zone', player, zone: 'discard' })}
      title="Click to view discard pile"
      className="w-20 h-28 shrink-0 cursor-pointer rounded-sm border-2 border-dashed border-zinc-400 bg-zinc-200/70
        flex items-center justify-center text-xs text-zinc-500 hover:bg-zinc-300/70 overflow-hidden"
    >
      {top ? (
        top.image ? <img src={top.image} alt={top.name} className="w-full h-full object-cover opacity-80" /> : top.name
      ) : (
        'Discard'
      )}
    </div>
  )
}

// Face-down prize cards (match mode only).
export function Prizes({ player }) {
  const { view, mode } = useGame()
  if (mode !== 'match') return null
  const prizes = view[player].prizes ?? []
  return (
    <div data-testid={`prizes-${player}`} className="flex flex-col items-center gap-1" title={`${prizes.length} prize cards left`}>
      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Prizes</span>
      <div className="grid grid-cols-2 gap-1">
        {prizes.map((c) => (
          <CardBack key={c.uid} className="w-8 h-11" />
        ))}
        {prizes.length === 0 && <span className="text-[10px] text-gray-400 col-span-2">none</span>}
      </div>
    </div>
  )
}

export function Hand({ player }) {
  const { view } = useGame()
  return (
    <div data-testid={`hand-${player}`} className="flex justify-center min-w-0">
      <div className="flex min-w-0 [&>*+*]:-ml-6 hover:[&>*+*]:-ml-2 transition-all">
        {view[player].hand.map((card) => (
          <HandCard key={card.uid} card={card} player={player} />
        ))}
      </div>
    </div>
  )
}

export function Row({ player, mirrored = false }) {
  const { state } = useGame()
  const mon = state[player].mon
  const active = mon[0] ? <BoardCard slot={mon[0]} player={player} id={0} /> : <EmptySpot player={player} id={0} />
  const bench = (
    <div className="flex gap-2">
      {mon.slice(1).map((slot, i) =>
        slot ? <BoardCard key={slot.uid} slot={slot} player={player} id={i + 1} /> : <EmptySpot key={`e${i}`} player={player} id={i + 1} />
      )}
    </div>
  )
  return (
    <div className="flex items-start justify-center gap-6">
      <div className="flex flex-col gap-2">
        <Deck player={player} />
        <DiscardPile player={player} />
      </div>
      <Prizes player={player} />
      {mirrored ? (
        <>
          {bench}
          <div className="border-l-2 border-zinc-300 pl-6">{active}</div>
        </>
      ) : (
        <>
          <div className="border-r-2 border-zinc-300 pr-6">{active}</div>
          {bench}
        </>
      )}
    </div>
  )
}

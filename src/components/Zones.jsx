import { useGame } from './GameContext.jsx'
import { HandCard, BoardCard, EmptySpot } from './Card.jsx'

export function Deck({ player }) {
  const { state, dispatch } = useGame()
  return (
    <div
      onClick={() => dispatch({ type: 'draw', player })}
      title="Click to draw"
      className="w-20 h-28 shrink-0 cursor-pointer flex items-center justify-center rounded-lg shadow-md
        bg-gradient-to-br from-blue-700 to-blue-900 text-white font-bold border-b-4 border-blue-950 hover:brightness-110"
    >
      {state[player].deck.length}
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
      className="w-20 h-28 shrink-0 cursor-pointer rounded-lg border-2 border-dashed border-gray-400 bg-gray-200/70
        flex items-center justify-center text-xs text-gray-500 hover:bg-gray-300/70 overflow-hidden"
    >
      {top ? (
        top.image ? <img src={top.image} alt={top.name} className="w-full h-full object-cover opacity-80" /> : top.name
      ) : (
        'Discard'
      )}
    </div>
  )
}

export function Hand({ player }) {
  const { state } = useGame()
  return (
    <div className="flex justify-center min-w-0">
      <div className="flex min-w-0 [&>*+*]:-ml-6 hover:[&>*+*]:-ml-2 transition-all">
        {state[player].hand.map((card) => (
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
      {mirrored ? (
        <>
          {bench}
          <div className="border-l-2 border-gray-300 pl-6">{active}</div>
        </>
      ) : (
        <>
          <div className="border-r-2 border-gray-300 pr-6">{active}</div>
          {bench}
        </>
      )}
    </div>
  )
}

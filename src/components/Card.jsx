import { useGame, usePlayerControl } from './GameContext.jsx'
import { useCardPreview } from './CardPreview.jsx'
import { TypeIcon, StatusIcon, GuardIcon } from './icons.jsx'
import { costMatch, handleDragOver } from '../engine/utils.js'
import { getPowerEffects } from '../engine/cards.js'

function CardFace({ card, className = '' }) {
  if (card.image) {
    return <img src={card.image} alt={card.name} draggable={false} className={`rounded select-none ${className}`} />
  }
  return (
    <div className={`rounded bg-amber-50 border border-amber-300 flex items-center justify-center text-[10px] text-center p-1 ${className}`}>
      {card.name}
    </div>
  )
}

export function CardBack({ className = '' }) {
  return (
    <div
      data-testid="card-back"
      className={`rounded-sm border-2 border-zinc-900 flex items-center justify-center select-none overflow-hidden
        bg-[linear-gradient(to_bottom,#e3350d_0%,#e3350d_46%,#17181c_46%,#17181c_54%,#f1f5f9_54%,#f1f5f9_100%)] ${className}`}
    >
      <img src="/pokeball.svg" alt="" className="w-1/2 drop-shadow" draggable={false} />
    </div>
  )
}

// A card in the player's hand: drag to play, click to play Trainers.
// Hidden cards (opponent's hand in a match) render as card backs.
export function HandCard({ card, player }) {
  const { dispatch, state } = useGame()
  const { controls } = usePlayerControl(player)
  const preview = useCardPreview()
  if (card.hidden) {
    return (
      <div className="w-20 shrink-0">
        <CardBack className="w-20 h-28" />
      </div>
    )
  }
  const isTrainer = card.supertype === 'trainer' && !card.doll
  const busy = !!state.pending || state.effectsQueue.length > 0

  return (
    <div
      draggable={controls}
      onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ from: 'hand', player, uid: card.uid }))}
      onClick={() => controls && isTrainer && !busy && dispatch({ type: 'play-trainer', player, uid: card.uid })}
      onContextMenu={(e) => {
        e.preventDefault()
        preview(card)
      }}
      title={card.text || card.name}
      className={`w-20 shrink-0 ${controls ? 'cursor-grab' : ''} transition hover:-translate-y-3 hover:z-10 ${isTrainer && controls ? 'hover:ring-2 hover:ring-emerald-400 rounded' : ''}`}
    >
      <CardFace card={card} className="w-20 h-28 object-cover" />
    </div>
  )
}

function AttackRow({ slot, atk, player, id, canAct }) {
  const { state, dispatch } = useGame()
  const burn = slot.power?.name === 'Energy Burn' ? 'fire' : null
  const affordable = costMatch({ cost: atk.cost, energyAttached: slot.energyAttached, burn })
  const locked = slot.attackLock?.name === atk.name
  return (
    <button
      onClick={() => dispatch({ type: 'attack', player, id, attackName: atk.name })}
      disabled={!affordable || locked || !!state.pending || !canAct}
      title={atk.text || atk.name}
      className={`w-full flex items-center justify-between gap-1 px-1 py-0.5 rounded-sm text-[10px] leading-tight border
        ${affordable && !locked ? 'bg-white hover:bg-red-50 border-poke-red/50 cursor-pointer' : 'bg-gray-100 border-gray-200 text-gray-400'}`}
    >
      <span className="flex items-center gap-0.5">
        {Object.entries(atk.cost).flatMap(([t, n]) => Array.from({ length: n }).map((_, i) => <TypeIcon key={t + i} type={t} size={7} />))}
      </span>
      <span className="truncate">{atk.name}</span>
      <span className="font-bold">{atk.damage}</span>
    </button>
  )
}

// A pokemon (or Clefairy Doll) in play.
export function BoardCard({ slot, player, id }) {
  const { state, dispatch, validTargets, mode, humanPlayer } = useGame()
  const { myTurn } = usePlayerControl(player)
  const preview = useCardPreview()
  const canAct = mode !== 'match' ? true : myTurn
  const clickActor = mode === 'match' ? humanPlayer : player
  const ref = { player, id }
  const isValidTarget = validTargets.some((r) => r.player === ref.player && r.id === ref.id)
  const hpLeft = Math.max(0, slot.hp - (slot.dc ?? 0))
  const power = slot.power ? getPowerEffects(slot.power.name) : null
  const busy = !!state.pending || state.effectsQueue.length > 0

  const handleDrop = (e) => {
    e.preventDefault()
    const data = JSON.parse(e.dataTransfer.getData('application/json'))
    dispatch({ type: 'drop', source: data, dest: ref })
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => state.pending && dispatch({ type: 'click', ...ref, actor: clickActor })}
      onContextMenu={(e) => {
        e.preventDefault()
        preview(slot)
      }}
      className={`relative w-28 rounded-sm bg-white border border-zinc-300 shadow-md p-1 flex flex-col gap-1 transition
        ${isValidTarget ? 'ring-4 ring-yellow-400 cursor-pointer animate-pulse' : ''}`}
    >
      <div className="relative">
        <CardFace card={slot} className="w-full object-cover" />
        {slot.dc > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
            -{slot.dc}
          </div>
        )}
        <div className="absolute top-0 left-0 flex flex-col gap-0.5 -translate-x-1/3">
          {slot.status && <StatusIcon status={slot.status} />}
          {slot.poisoned && <StatusIcon status="poisoned" />}
          <GuardIcon guard={slot.guard} />
        </div>
        {slot.energyAttached.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 flex flex-wrap gap-0.5 p-0.5 bg-white/70 rounded-b">
            {slot.energyAttached.map((e) => (
              <span key={e.uid} title={e.name} className="flex">
                {Array.from({ length: e.units ?? 1 }).map((_, i) => (
                  <TypeIcon key={i} type={e.energy} size={8} />
                ))}
              </span>
            ))}
          </div>
        )}
        {Object.keys(slot.markers ?? {}).length > 0 && (
          <div className="absolute top-0 right-0 translate-x-1/3 flex flex-col gap-0.5">
            {Object.keys(slot.markers).map((m) => (
              <span key={m} title={m} className="bg-fuchsia-200 text-fuchsia-800 text-[8px] px-1 rounded-sm shadow">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] px-0.5">
        <span className="font-semibold truncate">{slot.name}</span>
        <span className={hpLeft <= 20 ? 'text-red-600 font-bold' : 'text-gray-600'}>{hpLeft}/{slot.hp}</span>
      </div>

      {(slot.attacks ?? []).map((atk) => (
        <AttackRow key={atk.name} slot={slot} atk={atk} player={player} id={id} canAct={canAct} />
      ))}

      <div className="flex gap-1">
        {power && !power.passive && (
          <button
            onClick={() => dispatch({ type: 'use-power', player, id })}
            disabled={busy || !canAct}
            title={slot.power.text}
            className="flex-1 text-[9px] bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded-sm px-1 py-0.5 disabled:opacity-40"
          >
            {slot.power.name}
          </button>
        )}
        {power?.passive && (
          <span title={slot.power.text} className="flex-1 text-center text-[9px] bg-purple-50 text-purple-500 border border-purple-200 rounded-sm px-1 py-0.5">
            {slot.power.name}
          </span>
        )}
        {id === 0 && !slot.doll && (
          <button
            onClick={() => dispatch({ type: 'retreat', player })}
            disabled={busy || !canAct}
            className="flex-1 text-[9px] bg-sky-100 hover:bg-sky-200 border border-sky-300 rounded-sm px-1 py-0.5 disabled:opacity-40"
          >
            Retreat ({slot.retreatCost ?? 0})
          </button>
        )}
        {slot.doll && (
          <button
            onClick={() => dispatch({ type: 'discard-doll', player, id })}
            disabled={busy || !canAct}
            className="flex-1 text-[9px] bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-sm px-1 py-0.5 disabled:opacity-40"
          >
            Discard
          </button>
        )}
      </div>
    </div>
  )
}

export function EmptySpot({ player, id, label }) {
  const { state, dispatch, mode, humanPlayer } = useGame()
  const clickActor = mode === 'match' ? humanPlayer : player
  const handleDrop = (e) => {
    e.preventDefault()
    const data = JSON.parse(e.dataTransfer.getData('application/json'))
    dispatch({ type: 'drop', source: data, dest: { player, id } })
  }
  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => state.pending && dispatch({ type: 'click', player, id, actor: clickActor })}
      className="w-28 h-40 rounded-sm border-2 border-dashed border-zinc-300 bg-zinc-100/60 flex items-center justify-center text-[10px] text-zinc-400 uppercase tracking-wide font-semibold"
    >
      {label ?? (id === 0 ? 'Active' : 'Bench')}
    </div>
  )
}

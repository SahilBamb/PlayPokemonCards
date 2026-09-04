import { useGame, usePlayerControl } from './GameContext.jsx'
import { useCardPreview } from './CardPreview.jsx'
import { useFx } from './FxPlayer.jsx'
import { TypeIcon, StatusIcon, GuardIcon } from './icons.jsx'
import { costMatch, handleDragOver } from '../engine/utils.js'
import { getPowerEffects } from '../engine/cards.js'
import { powerActive, combatView, retreatCostOf } from '../engine/powers.js'

function CardFace({ card, className = '' }) {
  if (card.image) {
    return <img src={card.image} alt={card.name} draggable={false} className={`rounded select-none ${className}`} />
  }
  return (
    <div className={`rounded bg-amber-50 border border-amber-300 dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-200 flex items-center justify-center text-[10px] text-center p-1 ${className}`}>
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
  const busy = !!state.pending || state.effectsQueue.length > 0 || state.fxQueue.length > 0

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
  const burn = powerActive(state, slot, 'Energy Burn') ? 'fire' : null
  const wild = powerActive(state, slot, 'Transform')
  const affordable = costMatch({ cost: atk.cost, energyAttached: slot.energyAttached, burn, wild })
  const locked = slot.attackLock?.name === atk.name
  return (
    <button
      onClick={() => dispatch({ type: 'attack', player, id, attackName: atk.name })}
      disabled={!affordable || locked || !!state.pending || !canAct}
      title={atk.text || atk.name}
      className={`w-full flex items-center justify-between gap-1 px-1 py-0.5 rounded-sm text-[10px] leading-tight border
        ${affordable && !locked
          ? 'bg-white hover:bg-red-50 border-poke-red/50 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-100 cursor-pointer'
          : 'bg-gray-100 border-gray-200 text-gray-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500'}`}
    >
      <span className="flex items-center gap-0.5">
        {Object.entries(atk.cost).flatMap(([t, n]) => Array.from({ length: n }).map((_, i) => <TypeIcon key={t + i} type={t} size={7} />))}
      </span>
      <span className="truncate">{atk.name}</span>
      <span className="font-bold">{atk.damage}</span>
    </button>
  )
}

// Visual treatment for the fx currently targeting a card.
const STATUS_FX = {
  poisoned: { hue: 'rgba(34,197,94,0.55)', emoji: '☠️' },
  asleep: { hue: 'rgba(59,130,246,0.5)', emoji: '💤' },
  confused: { hue: 'rgba(217,70,239,0.5)', emoji: '🌀' },
  paralyzed: { hue: 'rgba(250,204,21,0.55)', emoji: '⚡' },
}

function cardFx(fx, player, id) {
  if (!fx) return { anim: '', overlay: null }
  const isTarget = fx.target && fx.target.player === player && fx.target.id === id
  const isSource = fx.source && fx.source.player === player && fx.source.id === id

  if (fx.kind === 'attack' && isSource) {
    return { anim: player === 'p1' ? 'animate-[lungeUp_0.48s_ease-in-out]' : 'animate-[lungeDown_0.48s_ease-in-out]', overlay: null }
  }
  if (fx.kind === 'hit' && isTarget) {
    return {
      anim: 'animate-[hitShake_0.5s_ease-in-out]',
      overlay: <div className="absolute inset-0 z-20 rounded-sm pointer-events-none animate-[huePulse_0.5s_ease-out]" style={{ background: 'rgba(239,68,68,0.55)' }} />,
    }
  }
  const status = fx.kind === 'status' ? STATUS_FX[fx.status] : fx.kind === 'poison-tick' ? STATUS_FX.poisoned : null
  if (status && isTarget) {
    return {
      anim: '',
      overlay: (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 rounded-sm animate-[huePulse_0.9s_ease-out]" style={{ background: status.hue }} />
          <span className="relative text-4xl drop-shadow-lg animate-[badgePop_0.9s_ease-out]">{status.emoji}</span>
        </div>
      ),
    }
  }
  if (fx.kind === 'heal' && isTarget) {
    return {
      anim: '',
      overlay: (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 rounded-sm animate-[huePulse_0.75s_ease-out]" style={{ background: 'rgba(134,239,172,0.55)' }} />
          <span className="relative text-3xl drop-shadow-lg animate-[badgePop_0.75s_ease-out]">✨</span>
        </div>
      ),
    }
  }
  return { anim: '', overlay: null }
}

// A pokemon (or Clefairy Doll) in play.
export function BoardCard({ slot, player, id }) {
  const { state, dispatch, validTargets, mode, humanPlayer } = useGame()
  const { myTurn } = usePlayerControl(player)
  const preview = useCardPreview()
  const fx = useFx()
  const canAct = mode !== 'match' ? true : myTurn
  const clickActor = mode === 'match' ? humanPlayer : player
  const ref = { player, id }
  const isValidTarget = validTargets.some((r) => r.player === ref.player && r.id === ref.id)
  const hpLeft = Math.max(0, slot.hp - (slot.dc ?? 0))
  const power = slot.power ? getPowerEffects(slot.power.name) : null
  const busy = !!state.pending || state.effectsQueue.length > 0 || state.fxQueue.length > 0
  const { anim: fxAnim, overlay: fxOverlay } = cardFx(fx, player, id)
  // Transform (Ditto): render the copied attacks / retreat cost while active
  const combat = combatView(state, ref) ?? slot

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
      className={`relative w-28 rounded-sm bg-white border border-zinc-300 text-zinc-900 dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100 shadow-md p-1 flex flex-col gap-1 transition
        ${isValidTarget ? 'ring-4 ring-yellow-400 cursor-pointer animate-pulse' : ''} ${fxAnim}`}
    >
      {fxOverlay}
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
          <div className="absolute bottom-0 left-0 right-0 flex flex-wrap gap-0.5 p-0.5 bg-white/70 dark:bg-zinc-900/70 rounded-b">
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
              <span key={m} title={m} className="bg-fuchsia-200 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200 text-[8px] px-1 rounded-sm shadow">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] px-0.5">
        <span className="font-semibold truncate">{slot.name}</span>
        <span className={hpLeft <= 20 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-600 dark:text-zinc-400'}>{hpLeft}/{slot.hp}</span>
      </div>

      {(combat.attacks ?? []).map((atk) => (
        <AttackRow key={atk.name} slot={slot} atk={atk} player={player} id={id} canAct={canAct} />
      ))}

      <div className="flex gap-1">
        {power && !power.passive && (
          <button
            onClick={() => dispatch({ type: 'use-power', player, id })}
            disabled={busy || !canAct}
            title={slot.power.text}
            className="flex-1 text-[9px] bg-purple-100 hover:bg-purple-200 border border-purple-300 dark:bg-purple-900/60 dark:hover:bg-purple-800/70 dark:border-purple-700 dark:text-purple-200 rounded-sm px-1 py-0.5 disabled:opacity-40"
          >
            {slot.power.name}
          </button>
        )}
        {power?.passive && (
          <span title={slot.power.text} className="flex-1 text-center text-[9px] bg-purple-50 text-purple-500 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800 rounded-sm px-1 py-0.5">
            {slot.power.name}
          </span>
        )}
        {id === 0 && !slot.doll && (
          <button
            onClick={() => dispatch({ type: 'retreat', player })}
            disabled={busy || !canAct}
            className="flex-1 text-[9px] bg-sky-100 hover:bg-sky-200 border border-sky-300 dark:bg-sky-900/60 dark:hover:bg-sky-800/70 dark:border-sky-700 dark:text-sky-200 rounded-sm px-1 py-0.5 disabled:opacity-40"
          >
            Retreat ({retreatCostOf(state, player)})
          </button>
        )}
        {slot.doll && (
          <button
            onClick={() => dispatch({ type: 'discard-doll', player, id })}
            disabled={busy || !canAct}
            className="flex-1 text-[9px] bg-rose-100 hover:bg-rose-200 border border-rose-300 dark:bg-rose-900/60 dark:hover:bg-rose-800/70 dark:border-rose-700 dark:text-rose-200 rounded-sm px-1 py-0.5 disabled:opacity-40"
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
      className="w-28 h-40 rounded-sm border-2 border-dashed border-zinc-300 bg-zinc-100/60 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-500 flex items-center justify-center text-[10px] text-zinc-400 uppercase tracking-wide font-semibold"
    >
      {label ?? (id === 0 ? 'Active' : 'Bench')}
    </div>
  )
}

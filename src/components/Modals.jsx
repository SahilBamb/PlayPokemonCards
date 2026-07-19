import { useState } from 'react'
import { useGame } from './GameContext.jsx'
import { TypeIcon } from './icons.jsx'
import { candidateCards, energyCandidates } from '../engine/reducer.js'
import { opposite } from '../engine/utils.js'

function Overlay({ children }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-2xl p-4 max-w-3xl max-h-[80vh] overflow-auto flex flex-col gap-3">{children}</div>
    </div>
  )
}

function MiniCard({ card, selected, order, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`relative w-24 cursor-pointer rounded transition hover:scale-105 ${selected ? 'ring-4 ring-emerald-400' : 'ring-1 ring-gray-200'}`}
    >
      {card.image ? (
        <img src={card.image} alt={card.name} className="rounded" />
      ) : (
        <div className="w-24 h-32 bg-amber-50 border rounded flex items-center justify-center text-[10px] text-center p-1">{card.name}</div>
      )}
      {order != null && (
        <span className="absolute -top-2 -left-2 bg-emerald-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow">
          {order}
        </span>
      )}
    </div>
  )
}

const TYPES = ['grass', 'fire', 'water', 'lightning', 'psychic', 'fighting', 'colorless']

export function ChoiceModal() {
  const { state, dispatch } = useGame()
  const pending = state.pending
  const [selected, setSelected] = useState([])
  if (!pending || pending.what === 'pokemon') return null

  const toggle = (uid) => setSelected((s) => (s.includes(uid) ? s.filter((u) => u !== uid) : [...s, uid]))
  const done = (payload) => {
    setSelected([])
    dispatch({ type: 'resolve-choice', payload })
  }
  const skip = () => {
    setSelected([])
    dispatch({ type: 'skip-choice' })
  }

  let body = null
  let confirm = null

  if (pending.what === 'cards') {
    const cards = candidateCards(state, pending)
    const need = pending.upTo != null ? null : Math.min(pending.count ?? 1, cards.length)
    const ok = pending.upTo != null ? selected.length <= pending.upTo : selected.length === need
    body = (
      <div className="flex flex-wrap gap-2">
        {cards.map((c) => (
          <MiniCard key={c.uid} card={c} selected={selected.includes(c.uid)} onClick={() => toggle(c.uid)} />
        ))}
      </div>
    )
    confirm = (
      <button
        disabled={!ok}
        onClick={() => done({ uids: selected })}
        className="px-4 py-1 rounded bg-emerald-500 text-white font-semibold disabled:opacity-40"
      >
        Confirm {pending.upTo != null ? `(up to ${pending.upTo})` : `(${selected.length}/${need})`}
      </button>
    )
  } else if (pending.what === 'energy') {
    const cands = energyCandidates(state, pending)
    const units = cands.filter((e) => selected.includes(e.uid)).reduce((n, e) => n + (e.units ?? 1), 0)
    const ok = pending.unitsMode
      ? units >= pending.count
      : pending.upTo != null
        ? selected.length >= 1 && selected.length <= pending.upTo
        : selected.length === Math.min(pending.count ?? 1, cands.length)
    body = (
      <div className="flex flex-wrap gap-2">
        {cands.map((e) => (
          <div
            key={e.uid}
            onClick={() => toggle(e.uid)}
            className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer ${selected.includes(e.uid) ? 'ring-4 ring-emerald-400' : ''}`}
          >
            {Array.from({ length: e.units ?? 1 }).map((_, i) => (
              <TypeIcon key={i} type={e.energy} size={14} />
            ))}
            <span className="text-sm">{e.name}</span>
          </div>
        ))}
      </div>
    )
    confirm = (
      <button disabled={!ok} onClick={() => done({ uids: selected })} className="px-4 py-1 rounded bg-emerald-500 text-white font-semibold disabled:opacity-40">
        Confirm
      </button>
    )
  } else if (pending.what === 'attack') {
    const defender = state[opposite[state.context.player]].mon[0]
    body = (
      <div className="flex flex-col gap-2">
        {(defender?.attacks ?? []).map((a) => (
          <button key={a.name} onClick={() => done({ attackName: a.name })} className="border rounded-lg px-3 py-2 hover:bg-emerald-50 text-left">
            <span className="font-semibold">{a.name}</span> <span className="text-red-600 font-bold">{a.damage}</span>
            <div className="text-xs text-gray-500">{a.text}</div>
          </button>
        ))}
      </div>
    )
  } else if (pending.what === 'type') {
    body = (
      <div className="flex gap-3 flex-wrap">
        {TYPES.map((t) => (
          <button key={t} onClick={() => done({ type: t })} className="flex flex-col items-center gap-1 border rounded-lg px-3 py-2 hover:bg-emerald-50">
            <TypeIcon type={t} size={20} />
            <span className="text-xs capitalize">{t}</span>
          </button>
        ))}
      </div>
    )
  } else if (pending.what === 'order') {
    const top = state[state.context.player].deck.slice(0, pending.count ?? 5)
    const ok = selected.length === top.length
    body = (
      <div className="flex flex-wrap gap-2">
        {top.map((c) => (
          <MiniCard
            key={c.uid}
            card={c}
            selected={selected.includes(c.uid)}
            order={selected.includes(c.uid) ? selected.indexOf(c.uid) + 1 : null}
            onClick={() => toggle(c.uid)}
          />
        ))}
      </div>
    )
    confirm = (
      <button disabled={!ok} onClick={() => done({ uids: selected })} className="px-4 py-1 rounded bg-emerald-500 text-white font-semibold disabled:opacity-40">
        Confirm order (top card first)
      </button>
    )
  }

  return (
    <Overlay>
      <h2 className="font-bold text-lg">{pending.prompt ?? 'Choose'}</h2>
      {body}
      <div className="flex gap-2 justify-end">
        {pending.optional && (
          <button onClick={skip} className="px-4 py-1 rounded bg-gray-200 hover:bg-gray-300">
            Skip
          </button>
        )}
        {confirm}
      </div>
    </Overlay>
  )
}

export function ZoneViewer() {
  const { state, dispatch } = useGame()
  const view = state.viewZone
  if (!view) return null
  const cards = state[view.player][view.zone]
  return (
    <Overlay>
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">
          {view.player} — {view.zone} ({cards.length})
        </h2>
        <button onClick={() => dispatch({ type: 'close-view' })} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300">
          Close
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {cards.length === 0 && <span className="text-gray-400">Empty</span>}
        {cards.map((c) => (
          <MiniCard key={c.uid} card={c} onClick={() => {}} />
        ))}
      </div>
    </Overlay>
  )
}

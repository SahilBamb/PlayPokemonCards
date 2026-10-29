import { useState } from 'react'
import { CARD_DB } from '../engine/cards.js'
import { SETS } from '../data/sets.js'
import { useCardPreview } from './CardPreview.jsx'
import { LogBody } from './Board.jsx'

const FAV_KEY = 'ppc-fav-cards'
const ALL_CARDS = [...CARD_DB].sort(
  (a, b) =>
    (SETS[a.set]?.releaseOrder ?? 9) - (SETS[b.set]?.releaseOrder ?? 9) || (a.number ?? 999) - (b.number ?? 999)
)

function loadFavs() {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY)) ?? []
  } catch {
    return []
  }
}

function CatalogCard({ card, fav, onToggleFav }) {
  const preview = useCardPreview()
  return (
    <div
      className="relative group shrink-0 w-28 cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ from: 'catalog', name: card.name }))}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        preview(card)
      }}
      title={`${card.name}: drag onto the field, deck, discard, or a hand`}
    >
      {card.image ? (
        <img src={card.image} alt={card.name} loading="lazy" draggable={false} className="w-28 rounded-sm pointer-events-none select-none" />
      ) : (
        <div className="w-28 h-[156px] rounded-sm bg-zinc-700 border border-zinc-500 flex items-center justify-center p-1 text-center text-[10px] text-zinc-200 font-semibold">
          {card.name}
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleFav(card.name)
        }}
        className={`absolute top-0.5 right-0.5 w-6 h-6 rounded-sm text-sm leading-none flex items-center justify-center
          border border-zinc-900/60 shadow transition
          ${fav ? 'bg-yellow-400 text-zinc-900' : 'bg-zinc-900/70 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-yellow-300'}`}
        title={fav ? 'Unfavorite' : 'Favorite'}
      >
        ★
      </button>
      <SetBadge set={card.set} />
    </div>
  )
}

const SET_BADGE = {
  base1: { label: 'B', cls: 'bg-zinc-700 text-zinc-200' },
  jungle: { label: 'J', cls: 'bg-emerald-700 text-emerald-100' },
  fossil: { label: 'F', cls: 'bg-amber-700 text-amber-100' },
  promo: { label: 'P', cls: 'bg-indigo-700 text-indigo-100' },
}

export function SetBadge({ set }) {
  const b = SET_BADGE[set]
  if (!b) return null
  return (
    <span
      title={SETS[set]?.name}
      className={`absolute bottom-0.5 left-0.5 w-4 h-4 rounded-sm text-[9px] font-black flex items-center justify-center shadow border border-zinc-900/50 ${b.cls}`}
    >
      {b.label}
    </span>
  )
}

function CatalogBody() {
  const [favs, setFavs] = useState(loadFavs)
  const [query, setQuery] = useState('')
  const [setFilter, setSetFilter] = useState('all')

  const toggleFav = (name) => {
    setFavs((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
      localStorage.setItem(FAV_KEY, JSON.stringify(next))
      return next
    })
  }

  const q = query.trim().toLowerCase()
  const list = ALL_CARDS.filter(
    (c) => (setFilter === 'all' || c.set === setFilter) && (!q || c.name.toLowerCase().includes(q))
  )
  const favCards = favs.map((n) => ALL_CARDS.find((c) => c.name === n)).filter(Boolean)

  return (
    <div data-testid="card-catalog" className="flex-1 min-h-0 flex flex-col" onContextMenu={(e) => e.preventDefault()}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        className="mx-2 my-1.5 px-2 py-1 rounded-sm bg-zinc-800 border border-zinc-600 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-poke-red"
      />
      <div className="flex gap-1 px-2 pb-1.5">
        {['all', ...Object.keys(SETS)].map((id) => (
          <button
            key={id}
            data-testid={`catalog-set-${id}`}
            onClick={() => setSetFilter(id)}
            className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wide border transition
              ${setFilter === id ? 'bg-poke-red border-poke-red text-white' : 'bg-zinc-800 border-zinc-600 text-zinc-400 hover:text-zinc-200'}`}
          >
            {id === 'all' ? 'All' : SETS[id].label}
          </button>
        ))}
      </div>
      {favCards.length > 0 && (
        <div className="border-b-2 border-poke-red/60 px-2 pb-2 max-h-[38%] overflow-y-auto shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 py-1">★ Favorites</div>
          <div className="grid grid-cols-2 gap-1.5 justify-items-center">
            {favCards.map((c) => (
              <CatalogCard key={c.name} card={c} fav onToggleFav={toggleFav} />
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="grid grid-cols-2 gap-1.5 justify-items-center">
          {list.map((c) => (
            <CatalogCard key={c.name} card={c} fav={favs.includes(c.name)} onToggleFav={toggleFav} />
          ))}
        </div>
        {list.length === 0 && <div className="text-center text-xs text-zinc-500 pt-4">No matches</div>}
      </div>
    </div>
  )
}

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition
        ${active ? 'text-white border-poke-red bg-zinc-900/60' : 'text-zinc-500 border-zinc-800 hover:text-zinc-300'}`}
    >
      {children}
    </button>
  )
}

// Sandbox right panel: the Game Log with a second tab holding the full card
// catalog for spawn-testing. Same footprint as the match-mode LogPanel.
export function SandboxSidePanel({ panel, onSelect }) {
  return (
    <aside className="w-64 shrink-0 h-full bg-zinc-950/85 border border-zinc-800 rounded-sm backdrop-blur-sm flex flex-col">
      <div className="flex">
        <Tab active={panel === 'log'} onClick={() => onSelect('log')}>
          Game Log
        </Tab>
        <Tab active={panel === 'cards'} onClick={() => onSelect('cards')}>
          Cards
        </Tab>
      </div>
      {panel === 'cards' ? <CatalogBody /> : <LogBody />}
    </aside>
  )
}

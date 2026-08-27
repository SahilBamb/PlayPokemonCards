import { useMemo, useState } from 'react'
import { CARD_DB, byName } from '../engine/cards.js'
import { SETS, DEFAULT_FORMAT } from '../data/sets.js'
import { useCardPreview } from './CardPreview.jsx'
import { SetBadge } from './CardCatalog.jsx'
import { TypeIcon } from './icons.jsx'
import {
  loadDecks,
  saveDeck,
  deleteDeck,
  newDeckId,
  deckSize,
  validateDeck,
  copyLimit,
  isBasicEnergy,
  DECK_SIZE,
} from '../lib/deckStore.js'

const ALL_CARDS = [...CARD_DB].sort(
  (a, b) =>
    (SETS[a.set]?.releaseOrder ?? 9) - (SETS[b.set]?.releaseOrder ?? 9) || (a.number ?? 999) - (b.number ?? 999)
)
const SUPERTYPES = [
  { id: 'all', label: 'All' },
  { id: 'pokemon', label: 'Pokémon' },
  { id: 'trainer', label: 'Trainers' },
  { id: 'energy', label: 'Energy' },
]
const TYPES = ['grass', 'fire', 'water', 'lightning', 'psychic', 'fighting', 'colorless']

const ENERGY_FOR_TYPE = {
  grass: 'Grass Energy',
  fire: 'Fire Energy',
  water: 'Water Energy',
  lightning: 'Lightning Energy',
  psychic: 'Psychic Energy',
  fighting: 'Fighting Energy',
}

const emptyDeck = (formatId) => ({ id: newDeckId(), name: '', counts: {}, format: formatId })

function Chip({ active, onClick, children, testId }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`px-2.5 py-1 rounded-sm text-xs font-semibold border transition
        ${active ? 'border-poke-red bg-poke-red/15 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
    >
      {children}
    </button>
  )
}

function BrowserCard({ card, count, limit, onAdd }) {
  const preview = useCardPreview()
  const maxed = count >= limit
  return (
    <div
      data-browser-card={card.name}
      onClick={() => !maxed && onAdd(card.name)}
      onContextMenu={(e) => {
        e.preventDefault()
        preview(card)
      }}
      title={maxed ? `${card.name} — copy limit reached` : `${card.name} — click to add`}
      className={`relative w-28 select-none ${maxed ? 'opacity-35' : 'cursor-pointer hover:scale-105 transition'}`}
    >
      {card.image ? (
        <img
          src={card.image}
          alt={card.name}
          loading="lazy"
          draggable={false}
          className="w-28 aspect-[245/342] rounded-sm pointer-events-none bg-zinc-800/60"
        />
      ) : (
        <div className="w-28 h-[156px] rounded-sm bg-zinc-700 border border-zinc-500 flex items-center justify-center p-1 text-center text-[10px] text-zinc-200 font-semibold">
          {card.name}
        </div>
      )}
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1 rounded-full bg-poke-red text-white text-xs font-black flex items-center justify-center border-2 border-zinc-900 shadow">
          {count}
        </span>
      )}
      <SetBadge set={card.set} />
    </div>
  )
}

function DeckRow({ name, count, onAdd, onRemove, limit }) {
  const card = byName[name]
  const preview = useCardPreview()
  return (
    <div
      className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm hover:bg-zinc-800/80"
      onContextMenu={(e) => {
        e.preventDefault()
        preview(card)
      }}
    >
      <TypeIcon type={card.supertype === 'energy' ? card.energy : card.type} size={10} />
      <span className="flex-1 text-xs text-zinc-200 truncate" title={name}>
        {name}
      </span>
      <button
        onClick={() => onRemove(name)}
        aria-label={`Remove ${name}`}
        className="w-5 h-5 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 text-xs font-bold leading-none"
      >
        −
      </button>
      <span className="w-5 text-center text-xs font-bold text-white">{count}</span>
      <button
        onClick={() => onAdd(name)}
        disabled={count >= limit}
        aria-label={`Add ${name}`}
        className="w-5 h-5 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 text-xs font-bold leading-none disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}

// Story Mode passes a real `collection` (name -> owned count) plus the
// story's `format` (era); null means every card is freely available and every
// deck is visible (Quick Play deck building). `title` relabels the header.
export function DeckEditor({ onExit, collection = null, format = null, title = 'Deck Editor' }) {
  const formatId = format?.id ?? DEFAULT_FORMAT.id
  const deckVisible = (d) => !format || (d.format ?? DEFAULT_FORMAT.id) === format.id
  const loadVisible = () => loadDecks().filter(deckVisible)

  const [decks, setDecks] = useState(loadVisible)
  const [deck, setDeck] = useState(() => decks[0] ?? emptyDeck(formatId))
  const [query, setQuery] = useState('')
  const [superFilter, setSuperFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState(null)
  const [setFilter, setSetFilter] = useState('all')
  // Story Mode defaults to showing only cards you own (toggleable).
  const [ownedOnly, setOwnedOnly] = useState(!!collection)
  const [savedFlash, setSavedFlash] = useState(false)

  const counts = deck.counts
  const size = deckSize(counts)
  const problems = useMemo(
    () => validateDeck(counts, collection, format ?? DEFAULT_FORMAT),
    [counts, collection, format]
  )

  const setCount = (name, n) => {
    setDeck((d) => {
      const next = { ...d.counts }
      if (n <= 0) delete next[name]
      else next[name] = n
      return { ...d, counts: next }
    })
  }
  const add = (name) => {
    const cur = counts[name] ?? 0
    if (cur < copyLimit(name, collection, counts)) setCount(name, cur + 1)
  }
  const remove = (name) => setCount(name, (counts[name] ?? 0) - 1)

  // Unnamed decks get a generic unique name ("Deck 3") the user can rename.
  const save = () => {
    let name = deck.name.trim()
    if (!name) {
      const taken = new Set(decks.filter((d) => d.id !== deck.id).map((d) => d.name))
      let n = 1
      while (taken.has(`Deck ${n}`)) n++
      name = `Deck ${n}`
    }
    const stamped = saveDeck({ ...deck, name, format: deck.format ?? formatId })
    setDeck(stamped)
    setDecks(loadVisible())
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1200)
  }
  const remove_deck = () => {
    deleteDeck(deck.id)
    const rest = loadVisible()
    setDecks(rest)
    setDeck(rest[0] ?? emptyDeck(formatId))
  }
  const duplicate = () => {
    setDeck((d) => ({ ...d, id: newDeckId(), name: d.name ? `${d.name} (copy)` : '' }))
  }

  // Top the deck up to 60 with basic energy matching the Pokémon types,
  // proportional to how many Pokémon of each type the deck runs.
  const autoFillEnergy = () => {
    const room = DECK_SIZE - size
    if (room <= 0) return
    const typeWeights = {}
    for (const [name, n] of Object.entries(counts)) {
      const card = byName[name]
      if (card?.supertype !== 'pokemon') continue
      const energyName = ENERGY_FOR_TYPE[card.type]
      if (energyName) typeWeights[energyName] = (typeWeights[energyName] ?? 0) + n
    }
    const entries = Object.entries(typeWeights)
    if (!entries.length) entries.push(['Fighting Energy', 1]) // colorless-only decks accept anything
    const totalWeight = entries.reduce((a, [, w]) => a + w, 0)
    setDeck((d) => {
      const next = { ...d.counts }
      let left = room
      entries.forEach(([energyName, w], i) => {
        const share = i === entries.length - 1 ? left : Math.round((room * w) / totalWeight)
        const give = Math.min(share, left)
        if (give > 0) next[energyName] = (next[energyName] ?? 0) + give
        left -= give
      })
      return { ...d, counts: next }
    })
  }

  const q = query.trim().toLowerCase()
  const browserCards = ALL_CARDS.filter((c) => {
    if (format && !format.sets.includes(c.set)) return false
    // basic energy is always free, so the Owned filter never hides it
    if (collection && ownedOnly && !isBasicEnergy(c.name) && !(collection[c.name] > 0)) return false
    if (q && !c.name.toLowerCase().includes(q)) return false
    if (superFilter !== 'all' && c.supertype !== superFilter) return false
    if (setFilter !== 'all' && c.set !== setFilter) return false
    if (typeFilter) {
      const t = c.supertype === 'energy' ? (c.energy === 'doublecolorless' ? 'colorless' : c.energy) : c.type
      if (t !== typeFilter) return false
    }
    return true
  })

  const groups = { pokemon: [], trainer: [], energy: [] }
  for (const name of Object.keys(counts).sort()) {
    const card = byName[name]
    if (card) groups[card.supertype]?.push(name)
  }

  return (
    <div className="w-full h-screen flex gap-2 p-2 text-white">
      {/* card browser */}
      <div className="flex-1 min-w-0 flex flex-col bg-zinc-950/85 border border-zinc-800 rounded-sm backdrop-blur-sm">
        <div className="flex items-center gap-3 px-3 py-2 border-b-2 border-poke-red/60">
          <button
            onClick={onExit}
            className="px-3 py-1 rounded-sm bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-xs font-semibold"
          >
            ← Menu
          </button>
          <h1 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <img src="/pokeball.svg" alt="" className="w-4 h-4" draggable={false} />
            {title}
          </h1>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards…"
            className="ml-auto w-48 px-2 py-1 rounded-sm bg-zinc-800 border border-zinc-600 text-xs placeholder-zinc-500 outline-none focus:border-poke-red"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-zinc-800">
          {SUPERTYPES.map((s) => (
            <Chip key={s.id} active={superFilter === s.id} onClick={() => setSuperFilter(s.id)}>
              {s.label}
            </Chip>
          ))}
          <span className="w-px h-4 bg-zinc-700 mx-1" />
          {['all', ...(format ? format.sets : Object.keys(SETS))].map((id) => (
            <Chip key={id} active={setFilter === id} onClick={() => setSetFilter(id)} testId={`editor-set-${id}`}>
              {id === 'all' ? 'All Sets' : SETS[id].label}
            </Chip>
          ))}
          {collection && (
            <>
              <span className="w-px h-4 bg-zinc-700 mx-1" />
              <Chip active={ownedOnly} onClick={() => setOwnedOnly((v) => !v)} testId="editor-owned">
                Owned
              </Chip>
            </>
          )}
          <span className="w-px h-4 bg-zinc-700 mx-1" />
          {TYPES.map((t) => (
            <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(typeFilter === t ? null : t)}>
              <span className="inline-flex items-center gap-1 capitalize">
                <TypeIcon type={t} size={9} />
                {t}
              </span>
            </Chip>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex flex-wrap gap-2.5">
            {browserCards.map((c) => (
              <BrowserCard key={c.name} card={c} count={counts[c.name] ?? 0} limit={copyLimit(c.name, collection, counts)} onAdd={add} />
            ))}
            {browserCards.length === 0 && <span className="text-xs text-zinc-500">No matches</span>}
          </div>
        </div>
      </div>

      {/* deck panel */}
      <aside className="w-80 shrink-0 h-full flex flex-col bg-zinc-950/85 border border-zinc-800 rounded-sm backdrop-blur-sm">
        <div className="px-3 py-2 border-b-2 border-poke-red/60 flex items-center gap-2">
          <select
            value={decks.some((d) => d.id === deck.id) ? deck.id : ''}
            onChange={(e) => {
              const found = decks.find((d) => d.id === e.target.value)
              setDeck(found ? { ...found, counts: { ...found.counts } } : emptyDeck(formatId))
            }}
            className="flex-1 px-2 py-1 rounded-sm bg-zinc-800 border border-zinc-600 text-xs outline-none"
          >
            <option value="">— unsaved deck —</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name || '(unnamed)'}
              </option>
            ))}
          </select>
          <span data-testid="deck-count" className={`text-sm font-black ${size === DECK_SIZE ? 'text-green-400' : 'text-zinc-300'}`}>
            {size}/{DECK_SIZE}
          </span>
        </div>

        <div className="px-3 py-2 flex flex-col gap-2 border-b border-zinc-800">
          <input
            value={deck.name}
            onChange={(e) => setDeck((d) => ({ ...d, name: e.target.value }))}
            placeholder="Deck name…"
            className="px-2 py-1.5 rounded-sm bg-zinc-800 border border-zinc-600 text-sm font-semibold placeholder-zinc-500 outline-none focus:border-poke-red"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={save}
              className="px-3 py-1 rounded-sm bg-poke-red hover:bg-[#f4460f] border-b-2 border-poke-red-dark text-xs font-bold uppercase tracking-wide"
            >
              {savedFlash ? 'Saved ✓' : 'Save'}
            </button>
            <button onClick={() => setDeck(emptyDeck(formatId))} className="px-2.5 py-1 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-xs font-semibold">
              New
            </button>
            <button onClick={duplicate} className="px-2.5 py-1 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-xs font-semibold">
              Duplicate
            </button>
            {decks.some((d) => d.id === deck.id) && (
              <button onClick={remove_deck} className="px-2.5 py-1 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-xs font-semibold text-red-400">
                Delete
              </button>
            )}
            <button
              onClick={autoFillEnergy}
              disabled={size >= DECK_SIZE}
              title="Fill the remaining slots with basic energy matching your Pokémon types"
              className="px-2.5 py-1 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-xs font-semibold disabled:opacity-30"
            >
              Auto-fill Energy
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-1.5 py-2">
          {[
            ['pokemon', 'Pokémon'],
            ['trainer', 'Trainers'],
            ['energy', 'Energy'],
          ].map(([key, label]) => {
            const names = groups[key]
            if (!names.length) return null
            const groupTotal = names.reduce((a, n) => a + counts[n], 0)
            return (
              <div key={key} className="mb-2">
                <div className="px-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {label} · {groupTotal}
                </div>
                {names.map((name) => (
                  <DeckRow key={name} name={name} count={counts[name]} limit={copyLimit(name, collection, counts)} onAdd={add} onRemove={remove} />
                ))}
              </div>
            )
          })}
          {size === 0 && <div className="text-xs text-zinc-500 px-2 pt-4 text-center">Click cards on the left to add them.</div>}
        </div>

        <div data-testid="deck-validation" className="px-3 py-2 border-t border-zinc-800 text-xs">
          {problems.length === 0 ? (
            <span className="text-green-400 font-semibold">
              ✓ Match legal — {collection ? 'ready to battle.' : 'selectable in Quick Play.'}
            </span>
          ) : (
            <ul className="text-amber-400 space-y-0.5 list-disc list-inside">
              {problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}

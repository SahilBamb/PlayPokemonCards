import { useState } from 'react'
import {
  FaStar,
  FaSkull,
  FaGamepad,
  FaRocket,
  FaMedal,
  FaBalanceScale,
  FaScroll,
  FaBoxOpen,
} from 'react-icons/fa'
import { DECKS, byName } from '../engine/cards.js'
import { DECK_GROUPS } from '../data/presetDecks.js'
import { AI_POLICIES, DEFAULT_AI } from '../ai/index.js'
import { SettingsButton } from './Settings.jsx'
import { loadDecks, deckToList, deckSize, validateDeck } from '../lib/deckStore.js'

const GROUP_ICONS = {
  starter: FaStar,
  basefossil: FaSkull,
  gameboy: FaGamepad,
  baserocket: FaRocket,
  basegym: FaMedal,
  prop153: FaBalanceScale,
  originalrules: FaScroll,
  custom: FaBoxOpen,
}

const PICKER_GROUPS = [
  ...Object.entries(DECK_GROUPS).map(([id, label]) => ({ id, label })),
  { id: 'custom', label: 'Use Own Deck' },
]

function DeckOption({ deck, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      title={deck.note}
      className={`flex flex-col items-center gap-2 rounded-sm border-2 p-3 w-44 transition text-left
        ${selected ? 'border-poke-red bg-zinc-800 shadow-[0_0_0_1px_#e3350d] scale-105' : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'}`}
    >
      <div className="flex -space-x-6">
        {deck.coverCards.map((name) => {
          const card = byName[name]
          return card?.image ? (
            <img key={name} src={card.image} alt={name} loading="lazy" className="w-16 rounded-sm shadow" draggable={false} />
          ) : (
            <span key={name}>{name}</span>
          )
        })}
      </div>
      <span className="font-bold text-sm text-white">{deck.name}</span>
      <span className="text-xs text-zinc-400 text-center">{deck.description}</span>
    </button>
  )
}

// Tile for a saved custom deck: cover = the deck's most numerous Pokémon,
// disabled (with the reason) when the deck isn't match-legal.
function CustomDeckOption({ deck, selected, onClick }) {
  const problems = validateDeck(deck.counts)
  const invalid = problems.length > 0
  const covers = Object.entries(deck.counts)
    .filter(([name]) => byName[name]?.supertype === 'pokemon')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name)
  return (
    <button
      onClick={onClick}
      disabled={invalid}
      title={invalid ? problems.join(' ') : deck.name}
      className={`flex flex-col items-center gap-2 rounded-sm border-2 p-3 w-44 transition text-left
        ${invalid ? 'border-zinc-800 bg-zinc-900/60 opacity-50 cursor-not-allowed' : ''}
        ${!invalid && selected ? 'border-poke-red bg-zinc-800 shadow-[0_0_0_1px_#e3350d] scale-105' : ''}
        ${!invalid && !selected ? 'border-zinc-700 bg-zinc-900 hover:border-zinc-500' : ''}`}
    >
      <div className="flex -space-x-6 min-h-[5.5rem] items-center">
        {covers.length ? (
          covers.map((name) => {
            const card = byName[name]
            return card?.image ? (
              <img key={name} src={card.image} alt={name} className="w-16 rounded-sm shadow" draggable={false} />
            ) : (
              <span key={name}>{name}</span>
            )
          })
        ) : (
          <img src="/pokeball.svg" alt="" className="w-12 h-12 opacity-40" draggable={false} />
        )}
      </div>
      <span className="font-bold text-sm text-white">{deck.name || '(unnamed)'}</span>
      <span className="text-xs text-zinc-400 text-center">
        {invalid ? 'Not playable — finish it in the Deck Editor' : `${deckSize(deck.counts)} cards`}
      </span>
    </button>
  )
}

export function MainMenu({ onSandbox, onPlay, onEditor, onStory, onOpener }) {
  const [picking, setPicking] = useState(false)
  const [group, setGroup] = useState('starter')
  const [sel, setSel] = useState({ kind: 'preset', id: 'blazeSurf' })
  const [aiId, setAiId] = useState(DEFAULT_AI)
  const [customDecks] = useState(loadDecks)

  const selectGroup = (gid) => {
    setGroup(gid)
    if (gid === 'custom') {
      if (sel.kind === 'custom') return
      const first = customDecks.find((d) => validateDeck(d.counts).length === 0)
      setSel(first ? { kind: 'custom', id: first.id } : { kind: 'custom', id: null })
      return
    }
    if (sel.kind === 'preset' && DECKS[sel.id]?.group === gid) return
    const first = Object.values(DECKS).find((d) => d.group === gid)
    if (first) setSel({ kind: 'preset', id: first.id })
  }

  const start = () => {
    const presetIds = Object.keys(DECKS)
    if (sel.kind === 'custom') {
      const deck = customDecks.find((d) => d.id === sel.id)
      if (!deck || validateDeck(deck.counts).length) return
      const aiDeckId = presetIds[Math.floor(Math.random() * presetIds.length)]
      onPlay({ playerDeckList: deckToList(deck), playerDeckName: deck.name, aiDeckId, aiId })
    } else if (sel.id) {
      const others = presetIds.filter((id) => id !== sel.id)
      const aiDeckId = others[Math.floor(Math.random() * others.length)]
      onPlay({ playerDeckId: sel.id, aiDeckId, aiId })
    }
  }

  const canStart = sel.kind === 'preset' ? !!sel.id : !!customDecks.find((d) => d.id === sel.id && !validateDeck(d.counts).length)
  const groupLabel = PICKER_GROUPS.find((g) => g.id === group)?.label
  const presetDecks = Object.values(DECKS).filter((d) => d.group === group)

  return (
    <div className={`w-full flex flex-col items-center text-white ${picking ? 'h-screen justify-start pt-6 gap-4' : 'min-h-screen justify-center gap-10 pt-20 pb-6'}`}>
      {!picking && (
        <a
          className="absolute top-4 left-4 z-10 block w-[min(240px,calc(100vw-6rem))] rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          href="https://honest-anti-ai-pledge.pages.dev/?domain=playpokemoncards.pages.dev#art"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Read this project's Art pledge"
          data-testid="landing-pledge-badge"
        >
          <img
            src="https://honest-anti-ai-pledge.pages.dev/badge/art.svg?domain=playpokemoncards.pages.dev&theme=light"
            alt="Honest Anti AI Art Pledge for playpokemoncards.pages.dev"
            width="400"
            height="88"
            className="block w-full h-auto"
          />
        </a>
      )}
      <div className="absolute top-4 right-4">
        <SettingsButton />
      </div>
      <div className={`flex items-center ${picking ? 'gap-3' : 'flex-col gap-4'}`}>
        <img src="/pokeball.svg" alt="" className={`${picking ? 'w-10 h-10' : 'w-20 h-20'} drop-shadow-[0_0_24px_rgba(227,53,13,0.45)]`} draggable={false} />
        <div className="flex flex-col items-center">
          <h1 className={`${picking ? 'text-2xl' : 'text-5xl'} font-black tracking-tight drop-shadow-lg`}>
            Play<span className="text-poke-red">Pokemon</span>Cards
          </h1>
          {!picking && <p className="text-zinc-400 font-medium">Base Set through Gym Challenge, all 530 cards playable.</p>}
        </div>
      </div>

      {!picking ? (
        <div className="flex flex-col gap-4 w-72">
          <button
            onClick={() => setPicking(true)}
            className="px-6 py-4 rounded-sm bg-poke-red hover:bg-[#f4460f] text-white text-xl font-black tracking-wide uppercase
              border-b-4 border-poke-red-dark shadow-xl transition hover:scale-105"
          >
            Quick Play
          </button>
          <button
            onClick={onStory}
            data-testid="menu-story"
            className="px-6 py-4 rounded-sm bg-zinc-100 hover:bg-white text-poke-red text-xl font-black tracking-wide uppercase
              border-b-4 border-zinc-400 shadow-xl transition hover:scale-105"
          >
            Story Mode
          </button>
          <button
            onClick={onSandbox}
            className="px-6 py-3 rounded-sm bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-700 hover:border-zinc-500
              text-lg font-bold tracking-wide uppercase transition"
          >
            Sandbox
          </button>
          <button
            onClick={onOpener}
            className="px-6 py-3 rounded-sm bg-zinc-900 hover:bg-zinc-800 border-2 border-amber-600/70 hover:border-amber-400 text-amber-200 text-lg font-bold tracking-wide uppercase transition flex items-center justify-center gap-3"
          >
            <FaBoxOpen /> Card Opener
          </button>
          <button
            onClick={onEditor}
            className="px-6 py-3 rounded-sm bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-700 hover:border-zinc-500
              text-lg font-bold tracking-wide uppercase transition"
          >
            Deck Editor
          </button>
        </div>
      ) : (
        <div className="w-[min(72rem,96vw)] h-[min(70vh,44rem)] flex bg-zinc-900/90 border-2 border-zinc-700 rounded-sm shadow-2xl backdrop-blur-sm overflow-hidden">
          <nav className="w-52 shrink-0 border-r-2 border-zinc-700 overflow-y-auto py-2 bg-zinc-950/50">
            {PICKER_GROUPS.map(({ id, label }) => {
              const Icon = GROUP_ICONS[id]
              const active = group === id
              return (
                <button
                  key={id}
                  type="button"
                  title={label}
                  data-testid={`qp-group-${id}`}
                  onClick={() => selectGroup(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition border-l-4
                    ${active ? 'border-poke-red bg-poke-red/15 text-white' : 'border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
                >
                  <Icon className={`shrink-0 text-lg ${active ? 'text-poke-red' : 'text-zinc-500'}`} />
                  <span className="text-xs font-bold uppercase tracking-wide leading-tight">{label}</span>
                </button>
              )
            })}
          </nav>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-5 pt-4 pb-2 shrink-0">
              <h2 className="text-lg font-bold uppercase tracking-wide">{groupLabel}</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              {group === 'custom' ? (
                <div className="flex flex-wrap gap-4">
                  {customDecks.map((deck) => (
                    <CustomDeckOption
                      key={deck.id}
                      deck={deck}
                      selected={sel.kind === 'custom' && sel.id === deck.id}
                      onClick={() => setSel({ kind: 'custom', id: deck.id })}
                    />
                  ))}
                  {customDecks.length === 0 && (
                    <span className="text-xs text-zinc-500 self-center">No saved decks yet — build one in the Deck Editor.</span>
                  )}
                  <button
                    onClick={onEditor}
                    className="flex flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-zinc-700 hover:border-zinc-500
                      p-3 w-44 min-h-[8rem] text-zinc-400 hover:text-white transition"
                  >
                    <span className="text-3xl font-black leading-none">+</span>
                    <span className="font-bold text-sm uppercase tracking-wide">Deck Editor</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {presetDecks.map((deck) => (
                    <DeckOption
                      key={deck.id}
                      deck={deck}
                      selected={sel.kind === 'preset' && sel.id === deck.id}
                      onClick={() => setSel({ kind: 'preset', id: deck.id })}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 border-t-2 border-zinc-700 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-zinc-300">Opponent:</span>
                {Object.values(AI_POLICIES).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setAiId(p.id)}
                    title={p.description}
                    className={`px-3 py-1.5 rounded-sm text-sm font-semibold border-2 transition
                      ${aiId === p.id ? 'border-poke-red bg-poke-red/15 text-white' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPicking(false)} className="px-5 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 font-semibold">
                  Back
                </button>
                <button
                  onClick={start}
                  disabled={!canStart}
                  className="px-6 py-2 rounded-sm bg-poke-red hover:bg-[#f4460f] disabled:opacity-40 disabled:hover:bg-poke-red text-white font-bold uppercase tracking-wide border-b-4 border-poke-red-dark shadow"
                >
                  Start Match
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

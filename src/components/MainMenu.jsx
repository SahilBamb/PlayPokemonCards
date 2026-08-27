import { useState } from 'react'
import { DECKS, byName } from '../engine/cards.js'
import { DECK_GROUPS } from '../data/presetDecks.js'
import { AI_POLICIES, DEFAULT_AI } from '../ai/index.js'
import { SettingsButton } from './Settings.jsx'
import { loadDecks, deckToList, deckSize, validateDeck } from '../lib/deckStore.js'

function SectionDivider({ children }) {
  return (
    <div className="w-full flex items-center gap-3">
      <span className="flex-1 h-px bg-zinc-700" />
      <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{children}</span>
      <span className="flex-1 h-px bg-zinc-700" />
    </div>
  )
}

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

export function MainMenu({ onSandbox, onPlay, onEditor, onStory }) {
  const [picking, setPicking] = useState(false)
  const [sel, setSel] = useState({ kind: 'preset', id: 'blazeSurf' })
  const [aiId, setAiId] = useState(DEFAULT_AI)
  const [customDecks] = useState(loadDecks)

  const start = () => {
    const presetIds = Object.keys(DECKS)
    if (sel.kind === 'custom') {
      const deck = customDecks.find((d) => d.id === sel.id)
      if (!deck) return
      const aiDeckId = presetIds[Math.floor(Math.random() * presetIds.length)]
      onPlay({ playerDeckList: deckToList(deck), playerDeckName: deck.name, aiDeckId, aiId })
    } else {
      const others = presetIds.filter((id) => id !== sel.id)
      const aiDeckId = others[Math.floor(Math.random() * others.length)]
      onPlay({ playerDeckId: sel.id, aiDeckId, aiId })
    }
  }

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center gap-10 text-white">
      <div className="absolute top-4 right-4">
        <SettingsButton />
      </div>
      <div className="flex flex-col items-center gap-4">
        <img src="/pokeball.svg" alt="" className="w-20 h-20 drop-shadow-[0_0_24px_rgba(227,53,13,0.45)]" draggable={false} />
        <h1 className="text-5xl font-black tracking-tight drop-shadow-lg">
          Play<span className="text-poke-red">Pokemon</span>Cards
        </h1>
        <p className="text-zinc-400 font-medium">Base Set through Gym Challenge — all 530 cards playable.</p>
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
            onClick={onEditor}
            className="px-6 py-3 rounded-sm bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-700 hover:border-zinc-500
              text-lg font-bold tracking-wide uppercase transition"
          >
            Deck Editor
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5 bg-zinc-900/90 border-2 border-zinc-700 rounded-sm p-6 shadow-2xl backdrop-blur-sm max-h-[72vh] max-w-4xl overflow-y-auto">
          <h2 className="text-lg font-bold uppercase tracking-wide">Choose your deck</h2>
          {Object.entries(DECK_GROUPS).map(([gid, label]) => (
            <div key={gid} className="w-full flex flex-col items-center gap-3">
              <SectionDivider>{label}</SectionDivider>
              <div className="flex flex-wrap justify-center gap-4">
                {Object.values(DECKS)
                  .filter((d) => d.group === gid)
                  .map((deck) => (
                    <DeckOption
                      key={deck.id}
                      deck={deck}
                      selected={sel.kind === 'preset' && sel.id === deck.id}
                      onClick={() => setSel({ kind: 'preset', id: deck.id })}
                    />
                  ))}
              </div>
            </div>
          ))}
          <SectionDivider>Use Own Deck</SectionDivider>
          <div className="flex flex-wrap justify-center gap-4 max-w-2xl">
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
          <div className="flex items-center gap-3">
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
              className="px-6 py-2 rounded-sm bg-poke-red hover:bg-[#f4460f] text-white font-bold uppercase tracking-wide border-b-4 border-poke-red-dark shadow"
            >
              Start Match
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

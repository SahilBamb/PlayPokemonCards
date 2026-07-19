import { useState } from 'react'
import { DECKS, byName } from '../engine/cards.js'
import { AI_POLICIES, DEFAULT_AI } from '../ai/index.js'

function DeckOption({ deck, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-sm border-2 p-3 w-44 transition text-left
        ${selected ? 'border-poke-red bg-zinc-800 shadow-[0_0_0_1px_#e3350d] scale-105' : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'}`}
    >
      <div className="flex -space-x-6">
        {deck.coverCards.map((name) => {
          const card = byName[name]
          return card?.image ? (
            <img key={name} src={card.image} alt={name} className="w-16 rounded-sm shadow" draggable={false} />
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

export function MainMenu({ onSandbox, onPlay }) {
  const [picking, setPicking] = useState(false)
  const [deckId, setDeckId] = useState('blazeSurf')
  const [aiId, setAiId] = useState(DEFAULT_AI)

  const start = () => {
    const others = Object.keys(DECKS).filter((id) => id !== deckId)
    const aiDeckId = others[Math.floor(Math.random() * others.length)]
    onPlay({ playerDeckId: deckId, aiDeckId, aiId })
  }

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center gap-10 text-white">
      <div className="flex flex-col items-center gap-4">
        <img src="/pokeball.svg" alt="" className="w-20 h-20 drop-shadow-[0_0_24px_rgba(227,53,13,0.45)]" draggable={false} />
        <h1 className="text-5xl font-black tracking-tight drop-shadow-lg">
          Play<span className="text-poke-red">Pokemon</span>Cards
        </h1>
        <p className="text-zinc-400 font-medium">The Base Set card game — all 102 cards playable.</p>
      </div>

      {!picking ? (
        <div className="flex flex-col gap-4 w-72">
          <button
            onClick={() => setPicking(true)}
            className="px-6 py-4 rounded-sm bg-poke-red hover:bg-[#f4460f] text-white text-xl font-black tracking-wide uppercase
              border-b-4 border-poke-red-dark shadow-xl transition hover:scale-105"
          >
            Play Game
          </button>
          <button
            onClick={onSandbox}
            className="px-6 py-3 rounded-sm bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-700 hover:border-zinc-500
              text-lg font-bold tracking-wide uppercase transition"
          >
            Sandbox
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5 bg-zinc-900/90 border-2 border-zinc-700 rounded-sm p-6 shadow-2xl backdrop-blur-sm">
          <h2 className="text-lg font-bold uppercase tracking-wide">Choose your deck</h2>
          <div className="flex gap-4">
            {Object.values(DECKS).map((deck) => (
              <DeckOption key={deck.id} deck={deck} selected={deckId === deck.id} onClick={() => setDeckId(deck.id)} />
            ))}
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

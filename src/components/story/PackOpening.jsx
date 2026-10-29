import { useState } from 'react'
import { byName } from '../../engine/cards.js'
import { useCardPreview } from '../CardPreview.jsx'

const RARITY_GLOW = {
  'Rare Holo': 'shadow-[0_0_24px_rgba(250,204,21,0.55)]',
  Promo: 'shadow-[0_0_24px_rgba(227,53,13,0.6)]',
  Rare: 'shadow-[0_0_16px_rgba(96,165,250,0.45)]',
}

function PackCard({ name, flipped, refunded, onFlip }) {
  const card = byName[name]
  const preview = useCardPreview()
  return (
    <div
      data-testid="pack-card"
      data-flipped={flipped ? '1' : '0'}
      onClick={onFlip}
      onContextMenu={(e) => {
        if (!flipped) return
        e.preventDefault()
        preview(card)
      }}
      className={`relative w-28 aspect-[245/342] cursor-pointer select-none transition-transform duration-300 ${flipped ? '' : 'hover:scale-105'}`}
      style={{ perspective: '600px' }}
    >
      {flipped ? (
        <div className={`w-full h-full rounded-sm animate-[zoomIn_0.3s_ease-out] ${RARITY_GLOW[card?.rarity] ?? ''}`}>
          {card?.image ? (
            <img src={card.image} alt={name} className="w-full h-full rounded-sm" draggable={false} />
          ) : (
            <div className="w-full h-full rounded-sm bg-zinc-700 border border-zinc-500 flex items-center justify-center p-1 text-center text-[10px] text-zinc-200 font-semibold">
              {name}
            </div>
          )}
          {refunded > 0 && (
            <span className="absolute bottom-1 inset-x-1 text-center text-[10px] font-bold bg-black/80 text-amber-300 rounded-sm py-0.5">
              extra copy → coins
            </span>
          )}
        </div>
      ) : (
        <div className="w-full h-full rounded-sm overflow-hidden border-2 border-[#294c7c] flex items-center justify-center hover:border-poke-red transition">
          <img src="/card-opener/card-back.jpg" alt="Face down card" className="w-full h-full object-cover" draggable={false} />
        </div>
      )}
    </div>
  )
}

// Full-screen reveal after opening a booster: cards start face-down, click to
// flip (or flip all). `result` = { names, refunded, refund } from
// openOwnedPack. Right-click a revealed card to zoom it.
export function PackOpening({ packName, result, onDone }) {
  const [flipped, setFlipped] = useState(() => result.names.map(() => false))
  const allFlipped = flipped.every(Boolean)
  // mark which duplicates got refunded (assign refunds to the last copies pulled)
  const refundLeft = { ...result.refunded }
  const refundFlags = [...result.names]
    .reverse()
    .map((name) => {
      if (refundLeft[name] > 0) {
        refundLeft[name]--
        return true
      }
      return false
    })
    .reverse()

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center" data-testid="pack-opening">
      <div className="flex flex-col items-center gap-5 max-w-3xl p-6">
        <h2 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
          <img src="/pokeball.svg" alt="" className="w-7 h-7" draggable={false} />
          {packName}
        </h2>
        <p className="text-sm text-zinc-400 -mt-3">Click the cards to reveal them.</p>
        <div className="flex flex-wrap justify-center gap-3">
          {result.names.map((name, i) => (
            <PackCard
              key={i}
              name={name}
              flipped={flipped[i]}
              refunded={refundFlags[i] ? 1 : 0}
              onFlip={() => setFlipped((f) => f.map((v, j) => (j === i ? true : v)))}
            />
          ))}
        </div>
        {result.refund > 0 && allFlipped && (
          <p className="text-amber-300 text-sm font-semibold" data-testid="pack-refund">
            Extra copies beyond 4 were redeemed for {result.refund} coins.
          </p>
        )}
        <div className="flex gap-3">
          {!allFlipped && (
            <button
              onClick={() => setFlipped(flipped.map(() => true))}
              data-testid="pack-flip-all"
              className="px-4 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 border-2 border-zinc-600 text-white text-sm font-bold uppercase tracking-wide"
            >
              Flip All
            </button>
          )}
          <button
            onClick={onDone}
            disabled={!allFlipped}
            data-testid="pack-done"
            className="px-5 py-2 rounded-sm bg-poke-red hover:bg-[#f4460f] border-b-4 border-poke-red-dark text-white text-sm font-bold uppercase tracking-wide disabled:opacity-40"
          >
            Add to Collection
          </button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { byName } from '../../engine/cards.js'
import { BOOSTER_PACKS, SUB_PACKS, packPool, PACK_SLOTS, HOLO_CHANCE } from '../../data/boosters.js'
import TRAINER_CLASSES from '../../data/trainerClasses.js'
import { useCardPreview } from '../CardPreview.jsx'
import { rollPromoOffer, rollSubOffer, buyPack, openOwnedPack } from '../../lib/profileStore.js'
import { PackOpening } from './PackOpening.jsx'

// Stories can bring their own shopkeeper (name/image/greeting); this is the fallback.
const DEFAULT_SHOPKEEPER = {
  name: 'Shopkeeper',
  image: TRAINER_CLASSES.find((t) => t.id === 'oras-poke-fan-f')?.image,
}

const RARITY_ORDER = ['Rare Holo', 'Rare', 'Uncommon', 'Common', 'Promo']
const RARITY_COLOR = {
  'Rare Holo': 'text-amber-300',
  Rare: 'text-blue-300',
  Uncommon: 'text-zinc-200',
  Common: 'text-zinc-400',
  Promo: 'text-poke-red',
}

export const CoinPill = ({ coins }) => (
  <span data-testid="coins" className="px-3 py-1 rounded-sm bg-zinc-900/90 border border-amber-400/60 text-amber-300 text-sm font-black shadow flex items-center gap-1.5">
    <span className="w-4 h-4 rounded-full bg-amber-400 text-zinc-900 text-[10px] font-black flex items-center justify-center">P</span>
    {coins}
  </span>
)

// Modal: every card the pack can contain, grouped by rarity with pull odds.
function PackPreview({ pack, onClose }) {
  const preview = useCardPreview()
  const pool = useMemo(() => packPool(pack.setId, pack.filter), [pack])
  const oddsFor = (rarity) => {
    if (pack.promo) return '1 guaranteed'
    if (PACK_SLOTS[rarity]) return `${PACK_SLOTS[rarity]} per pack`
    if (rarity === 'Rare Holo') return `rare slot, ${Math.round(HOLO_CHANCE * 100)}% holo`
    if (rarity === 'Rare') return `rare slot, ${Math.round((1 - HOLO_CHANCE) * 100)}%`
    return ''
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div
        data-testid="pack-preview"
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-950/95 border-2 border-zinc-700 rounded-sm shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center gap-3 px-4 py-2.5 border-b-2 border-poke-red/60">
          <h2 className="text-white text-sm font-black uppercase tracking-widest">{pack.name} — possible pulls</h2>
          <button
            onClick={onClose}
            className="ml-auto w-7 h-7 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white font-bold"
            aria-label="Close preview"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {RARITY_ORDER.filter((r) => pool[r]?.length).map((rarity) => (
            <div key={rarity} className="mb-4">
              <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${RARITY_COLOR[rarity]}`}>
                {rarity} · {pool[rarity].length} cards · {oddsFor(rarity)}
              </div>
              <div className="flex flex-wrap gap-2">
                {pool[rarity].map((name) => {
                  const card = byName[name]
                  return card?.image ? (
                    <img
                      key={name}
                      src={card.image}
                      alt={name}
                      loading="lazy"
                      draggable={false}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        preview(card)
                      }}
                      className="w-20 aspect-[245/342] rounded-sm bg-zinc-800/60"
                      title={name}
                    />
                  ) : (
                    <div key={name} className="w-20 h-28 rounded-sm bg-zinc-700 border border-zinc-500 flex items-center justify-center p-1 text-center text-[9px] text-zinc-200 font-semibold">
                      {name}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const TILE_VARIANTS = {
  promo: {
    frame: 'border-poke-red shadow-[0_0_18px_rgba(227,53,13,0.35)]',
    art: 'bg-gradient-to-br from-zinc-800 to-poke-red/30 border-poke-red/60',
    tag: <span className="text-[10px] font-black uppercase tracking-widest text-poke-red -mb-1">★ Rare find! ★</span>,
  },
  sub: {
    frame: 'border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.3)]',
    art: 'bg-gradient-to-br from-zinc-800 to-amber-500/25 border-amber-400/60',
    tag: <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 -mb-1">★ Limited stock! ★</span>,
  },
}

function PackTile({ pack, owned, coins, onBuy, onPreview, onOpen, variant, soldOut = false }) {
  const v = TILE_VARIANTS[variant]
  return (
    <div
      data-testid={`pack-${pack.id}`}
      className={`flex flex-col items-center gap-2 rounded-sm border-2 p-4 w-52 bg-zinc-900 ${v?.frame ?? 'border-zinc-700'}`}
    >
      {v?.tag}
      <div className={`w-24 h-32 rounded-sm border-2 flex flex-col items-center justify-center gap-2
        ${v?.art ?? 'bg-gradient-to-br from-zinc-800 to-zinc-950 border-zinc-600'}`}>
        <img src="/pokeball.svg" alt="" className="w-10 h-10" draggable={false} />
        <span className="text-[10px] font-bold text-zinc-300 text-center px-1 leading-tight">{pack.name}</span>
      </div>
      <span className="text-amber-300 text-sm font-black">{soldOut ? 'Sold out' : `${pack.price} coins`}</span>
      <div className="flex gap-1.5">
        {!soldOut && (
          <button
            onClick={onBuy}
            disabled={coins < pack.price}
            data-testid={`buy-${pack.id}`}
            className="px-3 py-1 rounded-sm bg-poke-red hover:bg-[#f4460f] border-b-2 border-poke-red-dark text-white text-xs font-bold uppercase disabled:opacity-40"
          >
            Buy
          </button>
        )}
        <button
          onClick={onPreview}
          data-testid={`preview-${pack.id}`}
          className="px-3 py-1 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs font-semibold"
        >
          Preview
        </button>
      </div>
      {owned > 0 && (
        <button
          onClick={onOpen}
          data-testid={`open-${pack.id}`}
          className="px-3 py-1.5 rounded-sm bg-amber-500 hover:bg-amber-400 border-b-2 border-amber-700 text-zinc-900 text-xs font-black uppercase tracking-wide"
        >
          Open ({owned})
        </button>
      )}
    </div>
  )
}

// The story shop: buy boosters, open them, and occasionally catch the rare
// promo pack restock. `profile`/`setProfile` come from StoryMode.
export function ShopScreen({ story, profile, setProfile, onBack }) {
  const [previewPack, setPreviewPack] = useState(null)
  const [opening, setOpening] = useState(null) // { pack, result }

  // Roll the limited-stock events once per shop visit (they stick until bought).
  useEffect(() => {
    setProfile((p) => rollSubOffer(rollPromoOffer(p, story), story))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const packs = (story.packs ?? []).map((id) => BOOSTER_PACKS[id]).filter(Boolean)
  const promoPack = profile.promoOffer ? BOOSTER_PACKS[profile.promoOffer.packId] : null
  const promoOwned = BOOSTER_PACKS.promoPack && (profile.packs[BOOSTER_PACKS.promoPack.id] ?? 0) > 0
  const subOfferPack = profile.subOffer ? SUB_PACKS[profile.subOffer.packId] : null
  // owned-but-sold-out sub-packs still need an Open tile
  const ownedSubPacks = Object.values(SUB_PACKS).filter(
    (p) => (profile.packs[p.id] ?? 0) > 0 && p.id !== subOfferPack?.id
  )

  const buy = (pack) => setProfile((p) => buyPack(p, pack) ?? p)
  const open = (pack) => {
    const res = openOwnedPack(profile, pack)
    if (!res) return
    setProfile(res.profile)
    setOpening({ pack, result: res })
  }

  const keeper = story.shopkeeper ?? DEFAULT_SHOPKEEPER
  const greeting = promoPack
    ? 'Psst… a collector traded in something special today. A Black Star Promo pack — one random promo card, while it lasts!'
    : subOfferPack
      ? `Lucky you! A themed ${subOfferPack.name} pack just came in — a narrower pull, so it's easier to hit the cards you're hunting. Grab it before it's gone!`
      : keeper.greeting ??
        'Welcome! Booster packs are 5 cards each — 3 commons, an uncommon, and a rare that might just be a holofoil. Extra copies past 4 are refunded as coins.'

  return (
    <div className="w-full h-screen flex flex-col text-white p-4">
      <div className="w-full max-w-5xl mx-auto flex items-center gap-3 mb-4 shrink-0">
        <button onClick={onBack} className="px-3 py-1 rounded-sm bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-xs font-semibold">
          ← Back
        </button>
        <h1 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
          <img src="/pokeball.svg" alt="" className="w-5 h-5" draggable={false} />
          Poké Mart
        </h1>
        <div className="ml-auto">
          <CoinPill coins={profile.coins} />
        </div>
      </div>

      {/* The shelves: packs fill the space above the shopkeeper's dialogue */}
      <div className="flex-1 min-h-0 w-full max-w-5xl mx-auto overflow-y-auto flex items-center justify-center">
        <div className="flex flex-wrap justify-center gap-4 py-4">
          {packs.map((pack) => (
            <PackTile
              key={pack.id}
              pack={pack}
              owned={profile.packs[pack.id] ?? 0}
              coins={profile.coins}
              onBuy={() => buy(pack)}
              onPreview={() => setPreviewPack(pack)}
              onOpen={() => open(pack)}
            />
          ))}
          {subOfferPack && (
            <PackTile
              pack={subOfferPack}
              owned={profile.packs[subOfferPack.id] ?? 0}
              coins={profile.coins}
              onBuy={() => buy(subOfferPack)}
              onPreview={() => setPreviewPack(subOfferPack)}
              onOpen={() => open(subOfferPack)}
              variant="sub"
            />
          )}
          {ownedSubPacks.map((pack) => (
            <PackTile
              key={pack.id}
              pack={pack}
              owned={profile.packs[pack.id] ?? 0}
              coins={profile.coins}
              onPreview={() => setPreviewPack(pack)}
              onOpen={() => open(pack)}
              variant="sub"
              soldOut
            />
          ))}
          {(promoPack || promoOwned) && (
            <PackTile
              pack={BOOSTER_PACKS.promoPack}
              owned={profile.packs[BOOSTER_PACKS.promoPack.id] ?? 0}
              coins={profile.coins}
              onBuy={() => promoPack && buy(promoPack)}
              onPreview={() => setPreviewPack(BOOSTER_PACKS.promoPack)}
              onOpen={() => open(BOOSTER_PACKS.promoPack)}
              variant="promo"
            />
          )}
        </div>
      </div>

      {/* Shopkeeper dialogue, styled like the trainer-challenge DialogueBox:
          big bottom-center box with the portrait overlapping its right edge. */}
      <div className="relative w-full max-w-5xl mx-auto shrink-0 mb-2 md:mb-6 mt-4">
        {keeper.image && (
          <img
            src={keeper.image}
            alt={keeper.name}
            draggable={false}
            className="absolute right-4 md:right-8 bottom-0 z-10 h-64 md:h-[22rem] w-auto max-w-[40%] object-contain object-bottom
              drop-shadow-[0_0_24px_rgba(0,0,0,0.9)] pointer-events-none select-none"
          />
        )}
        <div className="bg-zinc-950/95 border-2 border-zinc-600 rounded-sm shadow-2xl relative">
          <div className="absolute -top-5 left-6 px-4 py-1 bg-poke-red border-b-2 border-poke-red-dark rounded-sm text-white text-base font-black uppercase tracking-wide shadow">
            {keeper.name}
          </div>
          <p className={`px-6 md:px-8 pt-9 pb-6 text-white text-lg md:text-xl font-semibold leading-relaxed min-h-[7rem]
            ${keeper.image ? 'pr-40 md:pr-72' : ''}`}>
            {greeting}
          </p>
        </div>
      </div>

      {previewPack && <PackPreview pack={previewPack} onClose={() => setPreviewPack(null)} />}
      {opening && (
        <PackOpening packName={opening.pack.name} result={opening.result} onDone={() => setOpening(null)} />
      )}
    </div>
  )
}

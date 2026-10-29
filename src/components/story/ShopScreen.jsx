import { useEffect, useMemo, useState } from "react";
import { byName } from "../../engine/cards.js";
import {
  BOOSTER_PACKS,
  SUB_PACKS,
  packPool,
  PACK_SLOTS,
  HOLO_CHANCE,
} from "../../data/boosters.js";
import TRAINER_CLASSES from "../../data/trainerClasses.js";
import { useCardPreview } from "../CardPreview.jsx";
import {
  rollPromoOffer,
  rollSubOffer,
  buyPack,
  openOwnedPack,
} from "../../lib/profileStore.js";
import { PackOpening } from "./PackOpening.jsx";
import { AtlasPortrait, StoryCoins, StoryHeader } from "./StoryAtlas.jsx";

// Stories can bring their own shopkeeper (name/image/greeting); this is the fallback.
const DEFAULT_SHOPKEEPER = {
  name: "Shopkeeper",
  image: TRAINER_CLASSES.find((t) => t.id === "oras-poke-fan-f")?.image,
};

const RARITY_ORDER = ["Rare Holo", "Rare", "Uncommon", "Common", "Promo"];
const RARITY_COLOR = {
  "Rare Holo": "text-amber-300",
  Rare: "text-blue-300",
  Uncommon: "text-zinc-200",
  Common: "text-zinc-400",
  Promo: "text-poke-red",
};

export const CoinPill = StoryCoins;

// Modal: every card the pack can contain, grouped by rarity with pull odds.
function PackPreview({ pack, onClose }) {
  const preview = useCardPreview();
  const pool = useMemo(() => packPool(pack.setId, pack.filter), [pack]);
  const oddsFor = (rarity) => {
    if (pack.promo) return "1 guaranteed";
    if (PACK_SLOTS[rarity]) return `${PACK_SLOTS[rarity]} per pack`;
    if (rarity === "Rare Holo")
      return `rare slot, ${Math.round(HOLO_CHANCE * 100)}% holo`;
    if (rarity === "Rare")
      return `rare slot, ${Math.round((1 - HOLO_CHANCE) * 100)}%`;
    return "";
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        data-testid="pack-preview"
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-950/95 border-2 border-zinc-700 rounded-sm shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center gap-3 px-4 py-2.5 border-b-2 border-poke-red/60">
          <h2 className="text-white text-sm font-black uppercase tracking-widest">
            {pack.name} — possible pulls
          </h2>
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
              <div
                className={`text-xs font-bold uppercase tracking-wider mb-2 ${RARITY_COLOR[rarity]}`}
              >
                {rarity} · {pool[rarity].length} cards · {oddsFor(rarity)}
              </div>
              <div className="flex flex-wrap gap-2">
                {pool[rarity].map((name) => {
                  const card = byName[name];
                  return card?.image ? (
                    <img
                      key={name}
                      src={card.image}
                      alt={name}
                      loading="lazy"
                      draggable={false}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        preview(card);
                      }}
                      className="w-20 aspect-[245/342] rounded-sm bg-zinc-800/60"
                      title={name}
                    />
                  ) : (
                    <div
                      key={name}
                      className="w-20 h-28 rounded-sm bg-zinc-700 border border-zinc-500 flex items-center justify-center p-1 text-center text-[9px] text-zinc-200 font-semibold"
                    >
                      {name}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PackTile({
  pack,
  owned,
  coins,
  onBuy,
  onPreview,
  onOpen,
  variant,
  soldOut = false,
}) {
  const hasArt = [
    "base1",
    "jungle",
    "fossil",
    "rocket",
    "gym1",
    "gym2",
  ].includes(pack.setId);
  return (
    <div data-testid={`pack-${pack.id}`} className="atlas-pack-tile">
      {variant && (
        <span className="atlas-pack-tag">
          {variant === "promo" ? "A rare find" : "Limited stock"}
        </span>
      )}
      <div className="atlas-pack-art">
        <img
          src={hasArt ? `/boosterpacks/${pack.setId}.jpg` : "/pokeball.svg"}
          alt={`${pack.name} pack`}
          draggable={false}
        />
      </div>
      <strong>{pack.name}</strong>
      <span className="atlas-pack-price">
        {soldOut ? "Sold out" : `${pack.price} coins`}
      </span>
      <div className="atlas-pack-actions">
        {!soldOut && (
          <button
            onClick={onBuy}
            disabled={coins < pack.price}
            data-testid={`buy-${pack.id}`}
            className="atlas-button primary"
          >
            Buy
          </button>
        )}
        <button
          onClick={onPreview}
          data-testid={`preview-${pack.id}`}
          className="atlas-button secondary"
        >
          Preview
        </button>
      </div>
      {owned > 0 && (
        <button
          onClick={onOpen}
          data-testid={`open-${pack.id}`}
          className="atlas-button primary"
        >
          Open ({owned})
        </button>
      )}
    </div>
  );
}

export function ShopScreen({ story, profile, setProfile, onBack, onEditor }) {
  const [previewPack, setPreviewPack] = useState(null);
  const [opening, setOpening] = useState(null);
  useEffect(() => {
    setProfile((p) => rollSubOffer(rollPromoOffer(p, story), story));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const packs = (story.packs ?? [])
    .map((id) => BOOSTER_PACKS[id])
    .filter(Boolean);
  const promoPack = profile.promoOffer
    ? BOOSTER_PACKS[profile.promoOffer.packId]
    : null;
  const promoOwned =
    BOOSTER_PACKS.promoPack &&
    (profile.packs[BOOSTER_PACKS.promoPack.id] ?? 0) > 0;
  const subOfferPack = profile.subOffer
    ? SUB_PACKS[profile.subOffer.packId]
    : null;
  const ownedSubPacks = Object.values(SUB_PACKS).filter(
    (p) => (profile.packs[p.id] ?? 0) > 0 && p.id !== subOfferPack?.id,
  );
  const buy = (pack) => setProfile((p) => buyPack(p, pack) ?? p);
  const open = (pack) => {
    const res = openOwnedPack(profile, pack);
    if (!res) return;
    setProfile(res.profile);
    setOpening({ pack, result: res });
  };
  const keeper = story.shopkeeper ?? DEFAULT_SHOPKEEPER;
  const greeting = promoPack
    ? "A collector traded in something special today. A Black Star Promo pack, while it lasts!"
    : subOfferPack
      ? `A themed ${subOfferPack.name} pack just came in. A narrower pull makes it easier to find the cards you are hunting.`
      : (keeper.greeting ??
        "Welcome! Five cards in every pack: three commons, an uncommon, and a rare that might be a holofoil. Extra copies past four are refunded as coins.");
  const tile = (pack, variant, soldOut = false) => (
    <PackTile
      key={pack.id}
      pack={pack}
      owned={profile.packs[pack.id] ?? 0}
      coins={profile.coins}
      onBuy={() => buy(pack)}
      onPreview={() => setPreviewPack(pack)}
      onOpen={() => open(pack)}
      variant={variant}
      soldOut={soldOut}
    />
  );
  return (
    <div className="atlas-shop-page">
      <StoryHeader
        coins={profile.coins}
        onBack={onBack}
        onJourney={onBack}
        onEditor={onEditor}
        onShop={() => {}}
        active="shop"
        backLabel="Journey"
      />
      <div className="atlas-shop-inner">
        <section className="atlas-shop-heading">
          <span className="atlas-eyebrow">A LITTLE SOMETHING FOR THE ROAD</span>
          <h1>Poké Mart</h1>
          <p>
            Grow your collection, discover a new favorite, and make your next
            deck your best one yet.
          </p>
        </section>
        <div className="atlas-shop-shelf">
          {packs.map((p) => tile(p))}
          {subOfferPack && tile(subOfferPack, "sub")}
          {ownedSubPacks.map((p) => tile(p, "sub", true))}
          {(promoPack || promoOwned) &&
            tile(BOOSTER_PACKS.promoPack, "promo", !promoPack)}
        </div>
        <div className="atlas-shopkeeper">
          <div className="atlas-shopkeeper-message">
            <strong>{keeper.name}</strong>
            <p>{greeting}</p>
          </div>
          {keeper.image && (
            <AtlasPortrait {...keeper} className="atlas-shopkeeper-portrait" />
          )}
        </div>
      </div>
      {previewPack && (
        <PackPreview pack={previewPack} onClose={() => setPreviewPack(null)} />
      )}
      {opening && (
        <PackOpening
          packName={opening.pack.name}
          result={opening.result}
          onDone={() => setOpening(null)}
        />
      )}
    </div>
  );
}

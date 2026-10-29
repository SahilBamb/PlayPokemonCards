import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowRight,
  FaCheck,
  FaCoins,
  FaGripHorizontal,
  FaLayerGroup,
  FaSearch,
  FaStar,
} from "react-icons/fa";
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
import { useSettings } from "../Settings.jsx";
import {
  loadProfile,
  rollPromoOffer,
  rollSubOffer,
  buyPack,
  openOwnedPack,
} from "../../lib/profileStore.js";
import { playSfx } from "../../lib/sfx.js";
import { PackOpening } from "./PackOpening.jsx";
import { AtlasPortrait, StoryCoins, StoryHeader } from "./StoryAtlas.jsx";
import { StoryModal } from "./StoryModal.jsx";
import { storyPackArt } from "./storyShopArt.js";
import "./story-shop.css";

const DEFAULT_SHOPKEEPER = {
  name: "Shopkeeper",
  image: TRAINER_CLASSES.find((t) => t.id === "oras-poke-fan-f")?.image,
};
const RARITY_ORDER = ["Rare Holo", "Rare", "Uncommon", "Common", "Promo"];
export const CoinPill = StoryCoins;

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
    <StoryModal
      label={`${pack.name} possible pulls`}
      onClose={onClose}
      closeLabel="Close preview"
      className="story-pack-preview"
      testId="pack-preview"
    >
      <header>
        <span className="atlas-eyebrow">A LOOK INSIDE</span>
        <h2>{pack.name}</h2>
      </header>
      <div className="story-pack-pool">
        {RARITY_ORDER.filter((rarity) => pool[rarity]?.length).map((rarity) => (
          <section key={rarity}>
            <h3>
              {rarity}{" "}
              <span>
                {pool[rarity].length} cards · {oddsFor(rarity)}
              </span>
            </h3>
            <div>
              {pool[rarity].map((name) => (
                <button
                  key={name}
                  onClick={() => preview(byName[name])}
                  aria-label={`Inspect ${name}`}
                  title={name}
                >
                  {byName[name]?.image ? (
                    <img
                      src={byName[name].image}
                      alt={name}
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <span>{name}</span>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </StoryModal>
  );
}

function PackTile({
  pack,
  owned,
  coins,
  onChoose,
  onPreview,
  onOpen,
  variant,
  soldOut,
  pending,
  taking,
  busy,
}) {
  const affordable = coins >= pack.price;
  return (
    <div
      data-testid={`pack-${pack.id}`}
      className={`story-shop-product ${taking ? "taking" : ""}`}
    >
      {variant && (
        <span className="story-stock-label">
          {variant === "promo" ? (
            <>
              <FaStar /> Rare find
            </>
          ) : (
            "Themed pack"
          )}
        </span>
      )}
      <button
        className={`story-shop-buy ${pack.promo ? "promo" : ""}`}
        data-testid={`buy-${pack.id}`}
        onClick={onChoose}
        disabled={soldOut || !affordable || busy}
        aria-label={
          soldOut
            ? `${pack.name} is sold out`
            : pending
              ? `Confirm ${pack.name} for ${pack.price} coins`
              : `Choose ${pack.name} for ${pack.price} coins`
        }
      >
        <span className="story-shop-product-image">
          <img
            src={storyPackArt(pack)}
            alt={`${pack.name} pack`}
            draggable={false}
          />
        </span>
        <span className={`story-shop-price ${pending ? "confirming" : ""}`}>
          {taking || pending ? <FaCheck /> : <FaCoins />}
          {soldOut
            ? "Sold out"
            : taking
              ? "Ready!"
              : pending
                ? "Confirm?"
                : pack.price}
        </span>
      </button>
      <div className="story-product-label">
        <strong>{pack.name.replace(/ Booster$/, "")}</strong>
        <button
          onClick={onPreview}
          data-testid={`preview-${pack.id}`}
          aria-label={`Preview ${pack.name}`}
          title="Possible pulls"
        >
          <FaSearch />
        </button>
      </div>
      {owned > 0 && (
        <button
          className="story-owned-pack"
          data-testid={`open-${pack.id}`}
          onClick={onOpen}
          disabled={busy}
        >
          Open owned ({owned}) <FaArrowRight />
        </button>
      )}
      {!affordable && !soldOut && (
        <small className="story-pack-shortfall">
          {pack.price - coins} more coins needed
        </small>
      )}
    </div>
  );
}

export function ShopScreen({ story, profile, setProfile, onBack, onEditor }) {
  const { settings } = useSettings();
  const [previewPack, setPreviewPack] = useState(null);
  const [opening, setOpening] = useState(null);
  const [pending, setPending] = useState(null);
  const [taking, setTaking] = useState(null);
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem("ppc-story-reveal-mode") === "row"
        ? "row"
        : "stack";
    } catch {
      return "stack";
    }
  });
  const timer = useRef(null);
  const purchasing = useRef(false);
  useEffect(() => {
    setProfile((p) => rollSubOffer(rollPromoOffer(p, story), story));
    return () => clearTimeout(timer.current);
    // The restock event occurs once per visit, as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("ppc-story-reveal-mode", mode);
    } catch {
      /* preferences are optional */
    }
  }, [mode]);
  useEffect(() => {
    const cancel = (event) => {
      if (event.key === "Escape") setPending(null);
    };
    document.addEventListener("keydown", cancel);
    return () => document.removeEventListener("keydown", cancel);
  }, []);
  const regular = (story.packs ?? [])
    .map((id) => ({ pack: BOOSTER_PACKS[id] }))
    .filter((entry) => entry.pack);
  const promo = profile.promoOffer
    ? BOOSTER_PACKS[profile.promoOffer.packId]
    : null;
  const themed = profile.subOffer ? SUB_PACKS[profile.subOffer.packId] : null;
  const ownedThemed = Object.values(SUB_PACKS).filter(
    (pack) => (profile.packs[pack.id] ?? 0) > 0 && pack.id !== themed?.id,
  );
  const products = [
    ...regular,
    ...(themed ? [{ pack: themed, variant: "sub" }] : []),
    ...ownedThemed.map((pack) => ({ pack, variant: "sub", soldOut: true })),
    ...(promo || profile.packs.promoPack > 0
      ? [{ pack: BOOSTER_PACKS.promoPack, variant: "promo", soldOut: !promo }]
      : []),
  ];
  const shelves = Array.from(
    { length: Math.ceil(products.length / 3) },
    (_, index) => products.slice(index * 3, index * 3 + 3),
  );
  const keeper = story.shopkeeper ?? DEFAULT_SHOPKEEPER;
  const greeting =
    keeper.greeting ??
    "Welcome! Pick a booster for the road. Five cards in every pack, and something new for your next deck. Extra copies past four come back as coins.";
  const startOpening = (pack) => {
    setPending(null);
    setOpening(pack);
  };
  const choose = (pack) => {
    if (purchasing.current) return;
    if (pending !== pack.id) {
      setPending(pack.id);
      return;
    }
    const next = buyPack(loadProfile(), pack);
    if (!next) {
      setPending(null);
      setNotice(
        "Earn a few more coins in your next battle, then come back for this pack.",
      );
      return;
    }
    purchasing.current = true;
    setPending(null);
    setTaking(pack.id);
    setProfile(next);
    playSfx("coin");
    timer.current = setTimeout(
      () => {
        purchasing.current = false;
        setTaking(null);
        setNotice(
          "Your pack is ready. It stays unopened until you rip the foil.",
        );
        startOpening(pack);
      },
      settings.animations ? 650 : 0,
    );
  };
  const unseal = () => {
    const result = openOwnedPack(loadProfile(), opening);
    if (!result) {
      setOpening(null);
      setNotice("That pack has already been opened.");
      return null;
    }
    setProfile(result.profile);
    return result;
  };
  const modalOpen = !!(previewPack || opening);
  return (
    <div className="story-shop" data-shop-story={story.id}>
      <div inert={modalOpen} className="story-shop-surface">
        <StoryHeader
          coins={profile.coins}
          onBack={onBack}
          onJourney={onBack}
          onEditor={onEditor}
          onShop={() => {}}
          active="shop"
          backLabel="Journey"
        />
        <div className="story-shop-stage">
          <section
            className="story-shop-host"
            aria-label={`${keeper.name}'s shop`}
          >
            <div className="story-shop-sign">
              <span className="atlas-eyebrow">KANTO · {story.name}</span>
              <h1>Poké Mart</h1>
              <p>A new pack. A new possibility.</p>
            </div>
            <AtlasPortrait {...keeper} className="story-shop-portrait" />
            <div className="story-shop-speech">
              <strong data-testid="shopkeeper-name">{keeper.name}</strong>
              <p>{greeting}</p>
            </div>
          </section>
          <section
            className="story-cabinet"
            aria-labelledby="story-cabinet-heading"
          >
            <header className="story-cabinet-header">
              <div>
                <span>STORY BOOSTERS</span>
                <h2 id="story-cabinet-heading">Choose a pack</h2>
              </div>
              <div
                className="story-shop-mode"
                role="group"
                aria-label="Card reveal style"
              >
                <button
                  aria-pressed={mode === "row"}
                  onClick={() => setMode("row")}
                >
                  <FaGripHorizontal />
                  Row
                </button>
                <button
                  aria-pressed={mode === "stack"}
                  onClick={() => setMode("stack")}
                >
                  <FaLayerGroup />
                  Stack
                </button>
              </div>
            </header>
            <div className="story-cabinet-shelves">
              {shelves.map((shelf, index) => (
                <div className="story-cabinet-shelf" key={index}>
                  {shelf.map(({ pack, variant, soldOut }) => (
                    <PackTile
                      key={pack.id}
                      pack={pack}
                      variant={variant}
                      soldOut={soldOut}
                      owned={profile.packs[pack.id] ?? 0}
                      coins={profile.coins}
                      pending={pending === pack.id}
                      taking={taking === pack.id}
                      busy={!!taking}
                      onChoose={() => choose(pack)}
                      onPreview={() => {
                        setPending(null);
                        setPreviewPack(pack);
                      }}
                      onOpen={() => startOpening(pack)}
                    />
                  ))}
                </div>
              ))}
            </div>
            <footer className="story-cabinet-footer">
              <p>
                Story coins ·{" "}
                {BOOSTER_PACKS.promoPack &&
                  "Five cards per booster · One per promo"}
              </p>
              {themed && (
                <p className="story-fresh-stock">
                  <FaStar />
                  Fresh stock: {themed.name}
                </p>
              )}
              <p className="story-shop-notice" role="status">
                {notice ||
                  "Your pulls join your story collection. Extra copies return coins."}
              </p>
            </footer>
          </section>
        </div>
        <div className="story-shop-counter" aria-hidden="true" />
      </div>
      {previewPack && (
        <PackPreview pack={previewPack} onClose={() => setPreviewPack(null)} />
      )}
      {opening && (
        <PackOpening
          key={opening.id}
          pack={opening}
          mode={mode}
          onUnseal={unseal}
          onDone={() => setOpening(null)}
        />
      )}
    </div>
  );
}

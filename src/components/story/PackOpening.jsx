import { useEffect, useRef, useState } from "react";
import { FaArrowRight, FaCheck, FaCoins } from "react-icons/fa";
import { byName } from "../../engine/cards.js";
import { DUPE_REFUND } from "../../data/boosters.js";
import { useCardPreview } from "../CardPreview.jsx";
import { useSettings } from "../Settings.jsx";
import { HoloCard } from "../HoloCard.jsx";
import { PackTear } from "../opener/PackTear.jsx";
import { playSfx } from "../../lib/sfx.js";
import { StoryModal } from "./StoryModal.jsx";
import { storyPackArt } from "./storyShopArt.js";

const shiny = (card) => /Holo|Secret|Promo/.test(card?.rarity ?? "");

function PullCard({
  name,
  index,
  flipped,
  refund,
  onClick,
  finished = false,
  stacked = false,
}) {
  const card = byName[name];
  const inspect = useCardPreview();
  return (
    <div
      className={`story-pull ${flipped ? "revealed" : ""} ${flipped && shiny(card) ? "shiny" : ""} ${stacked ? "stacked" : ""}`}
      data-testid="pack-card"
      data-flipped={flipped ? "1" : "0"}
    >
      <button
        className="story-pull-card"
        onClick={onClick}
        aria-label={
          !flipped
            ? `Reveal card ${index + 1}`
            : finished
              ? `Inspect ${name}`
              : `Next card after ${name}`
        }
        onContextMenu={(event) => {
          if (flipped) {
            event.preventDefault();
            inspect(card);
          }
        }}
      >
        {flipped ? (
          <HoloCard card={card}>
            {card?.image ? (
              <img src={card.image} alt={name} draggable={false} />
            ) : (
              <span className="story-card-fallback">{name}</span>
            )}
            {shiny(card) && (
              <span className="story-foil-sweep" aria-hidden="true" />
            )}
          </HoloCard>
        ) : (
          <img
            src="/card-opener/card-back.jpg"
            alt="Face down card"
            draggable={false}
          />
        )}
        {flipped && shiny(card) && (
          <span className="story-pull-sparkles" aria-hidden="true">
            ✦<i>✦</i>
            <b>✧</b>
          </span>
        )}
        {flipped && refund > 0 && (
          <span className="story-refund-badge">
            <FaCoins /> +{refund}
          </span>
        )}
      </button>
      <div className="story-pull-caption" aria-hidden={!flipped}>
        {flipped && (
          <>
            <strong>{name}</strong>
            <small>
              {refund
                ? "Extra copy converted to coins"
                : (card?.rarity ?? "Added to collection")}
            </small>
          </>
        )}
      </div>
    </div>
  );
}

// A bought pack stays unopened until the tear completes. Cards and duplicate
// refunds are persisted by onUnseal, so leaving a reveal can never lose a pull.
export function PackOpening({ pack, mode, onUnseal, onDone }) {
  const { settings } = useSettings();
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const instant = reduced || !settings.animations;
  const [stage, setStage] = useState("sealed");
  const [result, setResult] = useState(null);
  const [flipped, setFlipped] = useState([]);
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState(false);
  const unsealed = useRef(false);
  const openingRoot = useRef(null);
  const inspect = useCardPreview();
  useEffect(() => {
    if (stage === "reveal")
      openingRoot.current
        ?.querySelector(".story-pull-card")
        ?.focus({ preventScroll: true });
  }, [stage, index, summary]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReduced(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    if (!["tearing", "dealing"].includes(stage)) return;
    const timer = setTimeout(
      () => setStage(stage === "tearing" ? "dealing" : "reveal"),
      instant ? 0 : stage === "tearing" ? 1050 : 1450,
    );
    return () => clearTimeout(timer);
  }, [stage, instant]);
  useEffect(() => {
    for (const name of result?.names ?? []) {
      const image = new Image();
      image.src = byName[name]?.image ?? "";
    }
  }, [result]);
  const tear = () => {
    if (unsealed.current) return;
    unsealed.current = true;
    const next = onUnseal();
    if (!next) {
      unsealed.current = false;
      return;
    }
    setResult(next);
    setFlipped(next.names.map(() => false));
    setStage("tearing");
    playSfx("packTear");
  };
  const allFlipped = flipped.length > 0 && flipped.every(Boolean);
  const done = allFlipped && (mode === "row" || summary);
  const refundLeft = { ...result?.refunded };
  const refundFlags = [...(result?.names ?? [])]
    .reverse()
    .map((name) => {
      if (!(refundLeft[name] > 0)) return false;
      refundLeft[name] -= 1;
      return true;
    })
    .reverse();
  const flip = (i) => {
    if (flipped[i]) {
      if (mode === "stack" && !done) {
        if (i < flipped.length - 1) setIndex(i + 1);
        else setSummary(true);
        playSfx("cardSlide");
      } else inspect(byName[result.names[i]]);
      return;
    }
    playSfx(shiny(byName[result.names[i]]) ? "cardRare" : "cardFlip");
    setFlipped((prev) => prev.map((value, j) => j === i || value));
  };
  const revealAll = () => {
    setFlipped(flipped.map(() => true));
    setIndex(flipped.length - 1);
    setSummary(true);
  };
  const set = { name: pack.name, image: storyPackArt(pack) };
  return (
    <StoryModal
      label={`Open ${pack.name}`}
      onClose={onDone}
      closeLabel="Back to shop"
      className="story-pack-modal"
      testId="pack-opening"
    >
      <div
        className="story-opening"
        ref={openingRoot}
        data-stage={stage}
        data-mode={mode}
        data-motion={instant ? "reduced" : "full"}
      >
        <header className="story-opening-header">
          <span className="atlas-eyebrow">YOUR STORY COLLECTION</span>
          <h2>{pack.name}</h2>
        </header>
        <div className={`story-opening-stage ${stage}`}>
          {["sealed", "tearing"].includes(stage) && (
            <div className="story-sealed-pack">
              <PackTear
                set={set}
                tearing={stage === "tearing"}
                onOpen={tear}
                disabled={stage !== "sealed"}
              />
            </div>
          )}
          {stage === "dealing" && (
            <div
              className="story-pack-deal"
              aria-label="Cards coming out of the pack"
            >
              <img className="story-empty-wrapper" src={set.image} alt="" />
              {result.names.map((_, i) => (
                <img
                  key={i}
                  className="story-emerging-card"
                  src="/card-opener/card-back.jpg"
                  alt=""
                  style={{
                    "--story-card-index": i,
                    "--story-card-middle": (result.names.length - 1) / 2,
                  }}
                />
              ))}
            </div>
          )}
          {stage === "reveal" && (
            <>
              {mode === "stack" && !done ? (
                <div className="story-stack-table">
                  {flipped.length - index > 1 && (
                    <span className="story-card-underlay" />
                  )}
                  <PullCard
                    key={index}
                    name={result.names[index]}
                    index={index}
                    stacked
                    flipped={flipped[index]}
                    onClick={() => flip(index)}
                    refund={
                      refundFlags[index]
                        ? (DUPE_REFUND[byName[result.names[index]]?.rarity] ??
                          5)
                        : 0
                    }
                  />
                </div>
              ) : (
                <div className={`story-pull-row ${done ? "complete" : ""}`}>
                  {result.names.map((name, i) => (
                    <PullCard
                      key={i}
                      name={name}
                      index={i}
                      flipped={flipped[i]}
                      onClick={() => flip(i)}
                      finished={done}
                      refund={
                        refundFlags[i]
                          ? (DUPE_REFUND[byName[name]?.rarity] ?? 5)
                          : 0
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <footer className="story-opening-footer" aria-live="polite">
          {stage === "sealed" ? (
            <p>Drag across the dotted line, or focus it and press Enter.</p>
          ) : stage === "tearing" ? (
            <p>Opening your pack...</p>
          ) : stage === "dealing" ? (
            <p>
              {result.names.length}{" "}
              {result.names.length === 1 ? "card" : "cards"} for your next
              adventure.
            </p>
          ) : (
            <>
              <div className="story-opening-progress">
                <span>
                  {done ? (
                    <>
                      <FaCheck /> {result.names.length}{" "}
                      {result.names.length === 1 ? "card" : "cards"} opened
                    </>
                  ) : (
                    `${flipped.filter(Boolean).length} / ${result.names.length} revealed`
                  )}
                </span>
                {!allFlipped && (
                  <button data-testid="pack-flip-all" onClick={revealAll}>
                    Reveal all <FaArrowRight />
                  </button>
                )}
              </div>
              {allFlipped && (
                <p className="story-opening-saved">
                  <FaCheck /> Saved to your collection
                  {result.refund > 0 && (
                    <span data-testid="pack-refund">
                      <FaCoins /> {result.refund} coins from extra copies
                    </span>
                  )}
                </p>
              )}
              <button
                data-testid="pack-done"
                className="atlas-button primary"
                disabled={!allFlipped}
                style={{ visibility: allFlipped ? "visible" : "hidden" }}
                onClick={onDone}
              >
                Back to shop <FaArrowRight />
              </button>
            </>
          )}
        </footer>
      </div>
    </StoryModal>
  );
}

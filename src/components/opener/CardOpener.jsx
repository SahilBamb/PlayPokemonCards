import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaBoxOpen,
  FaCheck,
  FaChevronDown,
  FaCoins,
  FaExpandAlt,
  FaGripHorizontal,
  FaLayerGroup,
  FaSearch,
  FaStar,
} from "react-icons/fa";
import { useCardPreview } from "../CardPreview.jsx";
import { SettingsButton, useSettings } from "../Settings.jsx";
import { playSfx } from "../../lib/sfx.js";
import {
  OPENER_BY_ID,
  OPENER_MARKET,
  OPENER_SETS,
  formatValue,
  isShinyPull,
  openedValue,
  openerSet,
  quoteFor,
  rollOpenerPack,
} from "../../lib/cardOpener.js";
import "./card-opener.css";

function CardArt({ card, large = false }) {
  const [failed, setFailed] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const exhausted = failed > (large && card.largeImage !== card.image ? 1 : 0);
  return (
    <span className="co-art">
      {!loaded && (
        <span
          className="co-art-fallback"
          role={exhausted ? undefined : "status"}
        >
          <FaStar />
          <strong>{card.name}</strong>
          <span>{card.rarity}</span>
          <small>
            {exhausted
              ? "Card art is unavailable right now."
              : "Loading card art…"}
          </small>
        </span>
      )}
      {!exhausted && (
        <img
          className="co-card-art"
          src={large && !failed ? card.largeImage : card.image}
          alt={card.name}
          draggable={false}
          style={loaded ? undefined : { visibility: "hidden" }}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setFailed((value) => value + 1);
          }}
        />
      )}
    </span>
  );
}

function CardBack() {
  return (
    <img
      className="co-card-back"
      src="/card-opener/card-back.jpg"
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

function CardValue({ card, large = false }) {
  const quote = quoteFor(card.id);
  return (
    <span
      className={`co-value ${large ? "large" : ""}`}
      data-testid="opener-card-value"
      title={
        quote
          ? `${quote.variant} · TCGplayer market estimate in USD`
          : "No matching market price is available"
      }
    >
      {quote ? (
        <>
          <small>EST.</small> {formatValue(quote.usd)}
        </>
      ) : (
        <span className="co-price-unavailable">Price unavailable</span>
      )}
    </span>
  );
}

function FlipCard({
  card,
  revealed,
  onClick,
  index,
  disabled,
  stack = false,
  finished = false,
}) {
  return (
    <button
      type="button"
      className={`co-flip-card ${revealed ? "revealed" : ""} ${isShinyPull(card) && revealed ? "shiny" : ""} ${stack ? "in-stack" : ""}`}
      onClick={onClick}
      disabled={disabled}
      data-testid="opener-card"
      data-revealed={revealed ? "true" : "false"}
      aria-label={
        !revealed
          ? `Reveal card ${index + 1}`
          : stack && !finished
            ? `Continue after ${card.name}`
            : `Inspect ${card.name}`
      }
    >
      <span className="co-flip-inner">
        <span className="co-card-face back">
          <CardBack />
        </span>
        <span className="co-card-face front" aria-hidden={!revealed}>
          {revealed && <CardArt card={card} large={stack} />}
          {revealed && isShinyPull(card) && (
            <span className="co-reveal-shine" />
          )}
        </span>
      </span>
    </button>
  );
}

function Pack({ set, tearing, onOpen, disabled }) {
  const imageStyle = { backgroundImage: `url("${set.image}")` };
  return (
    <button
      className={`co-pack ${tearing ? "tearing" : ""}`}
      onClick={onOpen}
      disabled={disabled}
      aria-label={`Open ${set.name} booster pack`}
      data-testid="opener-pack"
    >
      <span className="co-pack-glow" />
      <span className="co-pack-body">
        <img
          src={set.image}
          alt={`${set.name} booster pack`}
          draggable={false}
        />
      </span>
      <span className="co-pack-strip" style={imageStyle} />
      <span className="co-tear-line" />
      <span className="co-tear-spark" />
      {!tearing && (
        <span className="co-pack-hover">
          <FaBoxOpen /> CLICK TO OPEN
        </span>
      )}
    </button>
  );
}

function ClearDialog({ onCancel, onClear }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      className="co-clear-dialog"
      ref={ref}
      onClose={onCancel}
      aria-label="Clear opened cards"
    >
      <span className="co-eyebrow">A FRESH START</span>
      <h2>Clear this session?</h2>
      <p>
        Your Cards Opened gallery and pack count will be cleared for this tab.
      </p>
      <div>
        <button onClick={onCancel}>Keep my cards</button>
        <button className="co-primary" onClick={onClear}>
          Clear session
        </button>
      </div>
    </dialog>
  );
}

function Gallery({ state, onClear }) {
  const preview = useCardPreview();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [limit, setLimit] = useState(30);
  const entries = useMemo(() => {
    const result = [...state.history].reverse().filter((entry) => {
      const card = OPENER_BY_ID[entry.cardId];
      return (
        (filter === "all" || card.set === filter) &&
        `${card.name} ${card.rarity}`
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    });
    if (sort === "value")
      result.sort(
        (a, b) =>
          (quoteFor(b.cardId)?.usd ?? -1) - (quoteFor(a.cardId)?.usd ?? -1),
      );
    if (sort === "name")
      result.sort((a, b) =>
        OPENER_BY_ID[a.cardId].name.localeCompare(OPENER_BY_ID[b.cardId].name),
      );
    return result;
  }, [state.history, query, filter, sort]);
  return (
    <section className="co-gallery" aria-labelledby="opened-heading">
      <div className="co-gallery-heading">
        <div>
          <span className="co-eyebrow">THE MOMENTS WORTH KEEPING</span>
          <h2 id="opened-heading">
            Cards Opened <span>{state.history.length}</span>
          </h2>
          <p>Your pulls, kept together for this browser tab.</p>
        </div>
        {state.history.length > 0 && (
          <button className="co-text-button" onClick={onClear}>
            Clear session
          </button>
        )}
      </div>
      {state.history.length > 0 ? (
        <>
          <div className="co-gallery-tools">
            <label className="co-search">
              <FaSearch />
              <input
                aria-label="Search opened cards"
                placeholder="Find a card…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLimit(30);
                }}
              />
            </label>
            <select
              aria-label="Filter opened cards by set"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setLimit(30);
              }}
            >
              <option value="all">All sets</option>
              {OPENER_SETS.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort opened cards"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="recent">Latest pulls</option>
              <option value="name">Card name</option>
              <option value="value">Highest value</option>
            </select>
          </div>
          {entries.length ? (
            <div className="co-gallery-grid">
              {entries.slice(0, limit).map((entry) => {
                const card = OPENER_BY_ID[entry.cardId];
                return (
                  <article
                    className={`co-gallery-card ${isShinyPull(card) ? "shiny" : ""}`}
                    key={entry.key}
                    data-testid="opened-card"
                  >
                    <button
                      onClick={() => preview(card)}
                      aria-label={`Inspect opened ${card.name}`}
                    >
                      <CardArt card={card} />
                      <span className="co-inspect-hover">
                        <FaExpandAlt /> Inspect card
                      </span>
                    </button>
                    <div className="co-gallery-card-info">
                      <h3>{card.name}</h3>
                      <span>
                        {openerSet(card.set).name} · {card.number}
                      </span>
                      <div>
                        <small
                          className={isShinyPull(card) ? "co-holo-label" : ""}
                        >
                          {isShinyPull(card) && <FaStar />}
                          {card.rarity}
                        </small>
                        {state.showPrices && <CardValue card={card} />}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="co-no-results">
              <FaSearch />
              <p>No cards match this search.</p>
              <button
                className="co-text-button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Show all opened cards
              </button>
            </div>
          )}
          {entries.length > limit && (
            <button
              className="co-show-more"
              onClick={() => setLimit((value) => value + 30)}
            >
              Show more cards <FaChevronDown />
            </button>
          )}
        </>
      ) : (
        <div className="co-gallery-empty">
          <FaBoxOpen />
          <h3>Your next favorite card is in there.</h3>
          <p>Open a pack and every card you reveal will appear here.</p>
        </div>
      )}
    </section>
  );
}

export function CardOpener({ state, dispatch, onExit }) {
  const { settings } = useSettings();
  const preview = useCardPreview();
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const stageRef = useRef(null);
  const selectedSet = openerSet(state.setId);
  const packSet = state.pack ? openerSet(state.pack.setId) : selectedSet;
  const pack = state.pack;
  const busy = state.stage === "tearing" || state.stage === "dealing";
  const instant = reducedMotion || !settings.animations;
  const revealedCount = pack?.flipped.filter(Boolean).length || 0;
  const sessionValue = openedValue(state.history);
  const packValue = openedValue(
    state.history.filter((entry) => entry.packNumber === pack?.number),
  );
  const currentCard = pack ? OPENER_BY_ID[pack.ids[pack.index]] : null;
  const currentRevealed = pack?.flipped[pack.index] || false;
  const sourceDate = new Date(OPENER_MARKET.updatedAt).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = (event) => setReducedMotion(event.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);

  useEffect(() => {
    if (!["tearing", "dealing"].includes(state.stage)) return;
    const timer = setTimeout(
      () => dispatch({ type: "advance", from: state.stage }),
      instant ? 0 : state.stage === "tearing" ? 1150 : 1100,
    );
    return () => clearTimeout(timer);
  }, [state.stage, pack?.number, instant, dispatch]);

  useEffect(() => {
    for (const id of pack?.ids || []) {
      const image = new Image();
      image.src = OPENER_BY_ID[id].image;
    }
  }, [pack?.ids]);

  const open = () => {
    if (!["sealed", "complete"].includes(state.stage)) return;
    playSfx("packTear");
    dispatch({ type: "open", ids: rollOpenerPack(state.setId), instant });
    if (window.innerWidth < 620)
      requestAnimationFrame(() =>
        stageRef.current?.scrollIntoView({
          behavior: instant ? "auto" : "smooth",
          block: "start",
        }),
      );
  };
  const reveal = (index) => {
    if (busy || !pack || pack.flipped[index]) return;
    playSfx(
      isShinyPull(OPENER_BY_ID[pack.ids[index]]) ? "cardRare" : "cardFlip",
    );
    dispatch({ type: "reveal", index });
  };
  const next = () => {
    playSfx("cardSlide");
    dispatch({ type: "next" });
  };

  return (
    <main
      className="card-opener"
      data-theme={settings.theme}
      data-motion={instant ? "reduced" : "full"}
      style={{ "--co-accent": packSet.accent }}
    >
      <div className="co-shell">
        <header className="co-header">
          <div className="co-heading">
            <button
              className="co-back-button"
              onClick={onExit}
              aria-label="Return to main menu"
            >
              <FaArrowLeft />
            </button>
            <img src="/pokeball.svg" alt="" />
            <div>
              <span className="co-eyebrow">PLAYPOKEMONCARDS</span>
              <h1>
                Card Opener<span>.</span>
              </h1>
            </div>
          </div>
          <div className="co-header-right">
            <span className="co-simulation">
              <i /> SIMULATION ONLY
            </span>
            <SettingsButton />
          </div>
        </header>
        <div className="co-introduction">
          <div>
            <h2>
              A little nostalgia.
              <br className="co-mobile-break" /> One card at a time.
            </h2>
            <p>Pick a pack. Feel the rip. Enjoy the reveal.</p>
          </div>
          <div className="co-stats">
            <div>
              <strong>{state.packsOpened}</strong>
              <span>PACKS OPENED</span>
            </div>
            <div>
              <strong>{state.history.length}</strong>
              <span>CARDS REVEALED</span>
            </div>
            {state.showPrices && (
              <div>
                <strong>{formatValue(sessionValue.amount)}</strong>
                <span>
                  {sessionValue.priced < sessionValue.total
                    ? "KNOWN SESSION VALUE"
                    : "EST. SESSION VALUE"}
                </span>
              </div>
            )}
          </div>
        </div>

        <section
          className="co-opening-room"
          aria-label="Pack opening simulator"
          data-testid="card-opener"
        >
          <div className="co-toolbar">
            <label className="co-set-picker">
              <span className="co-control-label">CHOOSE YOUR SET</span>
              <select
                aria-label="Booster set"
                value={state.setId}
                disabled={busy}
                onChange={(event) =>
                  dispatch({ type: "set", id: event.target.value })
                }
              >
                {OPENER_SETS.map((set) => (
                  <option value={set.id} key={set.id}>
                    {set.name} · {set.year}
                  </option>
                ))}
              </select>
            </label>
            <div className="co-mode-picker">
              <span className="co-control-label">REVEAL STYLE</span>
              <div role="group" aria-label="Card reveal style">
                <button
                  disabled={busy}
                  aria-pressed={state.mode === "row"}
                  onClick={() => dispatch({ type: "mode", mode: "row" })}
                >
                  <FaGripHorizontal /> Row
                </button>
                <button
                  disabled={busy}
                  aria-pressed={state.mode === "stack"}
                  onClick={() => dispatch({ type: "mode", mode: "stack" })}
                >
                  <FaLayerGroup /> Stack
                </button>
              </div>
            </div>
            <button
              className="co-price-toggle"
              role="switch"
              aria-checked={state.showPrices}
              aria-label="Show card values"
              onClick={() => dispatch({ type: "prices" })}
            >
              <FaCoins />
              <span>Card values</span>
              <i>
                <b />
              </i>
            </button>
          </div>

          <div
            ref={stageRef}
            className={`co-stage ${state.stage} ${state.mode}`}
            data-testid="opener-stage"
            data-stage={state.stage}
          >
            <div className="co-stage-caption">
              <span>
                <i /> {packSet.name.toUpperCase()}
              </span>
              <span>
                {state.stage === "sealed"
                  ? `${selectedSet.count} CARDS TO DISCOVER`
                  : `${revealedCount} / ${pack?.ids.length || 11} REVEALED`}
              </span>
            </div>
            {["sealed", "tearing"].includes(state.stage) ? (
              <div className="co-sealed-stage">
                <div className="co-table-light" />
                <Pack
                  set={state.stage === "sealed" ? selectedSet : packSet}
                  tearing={state.stage === "tearing"}
                  onOpen={open}
                  disabled={busy}
                />
                <div className="co-pack-instructions">
                  <span className="co-eyebrow">
                    {state.stage === "tearing"
                      ? "A LITTLE ANTICIPATION…"
                      : "YOUR NEXT PACK IS WAITING"}
                  </span>
                  <h3>
                    {state.stage === "tearing"
                      ? "Here we go."
                      : selectedSet.name}
                  </h3>
                  <p>
                    {state.stage === "tearing"
                      ? "Unwrapping a little bit of the past."
                      : "11 cards. One rare slot. A fresh surprise."}
                  </p>
                  {state.stage === "sealed" && (
                    <button className="co-primary" onClick={open}>
                      Open pack <FaArrowRight />
                    </button>
                  )}
                </div>
              </div>
            ) : state.mode === "row" ? (
              <div className="co-row-area">
                <div className="co-row-guide">
                  <span>
                    {state.stage === "dealing"
                      ? "A fresh row of possibilities."
                      : state.stage === "complete"
                        ? "A whole pack of memories."
                        : "Your reveal. Your order."}
                  </span>
                  <small>
                    {state.stage === "complete"
                      ? "Click any card for a closer look."
                      : "Click each card to turn it over."}
                  </small>
                </div>
                <div className="co-card-row" aria-label="Cards from this pack">
                  {pack.ids.map((id, index) => {
                    const card = OPENER_BY_ID[id];
                    return (
                      <div
                        className="co-row-slot"
                        key={`${pack.number}:${index}`}
                        style={{
                          "--co-i": index,
                          "--co-deal-x": `${(5 - index) * 105}px`,
                        }}
                      >
                        <div className="co-deal-motion">
                          <FlipCard
                            card={card}
                            index={index}
                            revealed={pack.flipped[index]}
                            disabled={busy}
                            onClick={() =>
                              pack.flipped[index]
                                ? preview(card)
                                : reveal(index)
                            }
                          />
                        </div>
                        <div className="co-row-card-caption">
                          <span className="co-card-position">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {pack.flipped[index] && (
                            <>
                              <strong>{card.name}</strong>
                              {state.showPrices && <CardValue card={card} />}
                              {isShinyPull(card) && (
                                <small className="co-holo-label">
                                  <FaStar /> {card.rarity}
                                </small>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="co-swipe-note">
                  Scroll across to see the whole pack <FaArrowRight />
                </div>
              </div>
            ) : (
              <div className="co-stack-area">
                <div className="co-stack-scene">
                  <div className="co-stack-shadow" />
                  {Array.from(
                    { length: Math.min(3, pack.ids.length - pack.index - 1) },
                    (_, index) => (
                      <div
                        className="co-stack-under"
                        style={{ "--co-depth": index + 1 }}
                        key={index}
                      >
                        <CardBack />
                      </div>
                    ),
                  )}
                  <div
                    className="co-stack-top co-deal-motion"
                    key={`${pack.number}:${pack.index}`}
                  >
                    <FlipCard
                      card={currentCard}
                      index={pack.index}
                      revealed={currentRevealed}
                      disabled={busy}
                      stack
                      finished={state.stage === "complete"}
                      onClick={() =>
                        currentRevealed
                          ? state.stage === "complete"
                            ? preview(currentCard)
                            : next()
                          : reveal(pack.index)
                      }
                    />
                  </div>
                  {currentRevealed && state.showPrices && (
                    <div
                      className={`co-stack-value ${isShinyPull(currentCard) ? "rare" : ""}`}
                      key={`value:${pack.number}:${pack.index}`}
                    >
                      <CardValue card={currentCard} large />
                    </div>
                  )}
                </div>
                <div className="co-stack-info">
                  <span className="co-eyebrow">
                    CARD {String(pack.index + 1).padStart(2, "0")} OF{" "}
                    {pack.ids.length}
                  </span>
                  {currentRevealed ? (
                    <>
                      <span
                        className={`co-rarity-badge ${isShinyPull(currentCard) ? "rare" : ""}`}
                      >
                        {isShinyPull(currentCard) && <FaStar />}
                        {currentCard.rarity}
                      </span>
                      <h3>{currentCard.name}</h3>
                      <p>
                        {packSet.name} · No. {currentCard.number}
                      </p>
                      <div className="co-stack-actions">
                        {state.stage !== "complete" && (
                          <button className="co-primary" onClick={next}>
                            Next card <FaArrowRight />
                          </button>
                        )}
                        <button
                          className="co-inspect-button"
                          onClick={() => preview(currentCard)}
                        >
                          <FaExpandAlt /> Inspect card
                        </button>
                      </div>
                      <small>
                        {state.stage === "complete"
                          ? "Your final card. Take a moment."
                          : "Take your time. Click the card again when you are ready."}
                      </small>
                    </>
                  ) : (
                    <>
                      <h3>A little mystery.</h3>
                      <p>Click the card to see what is waiting.</p>
                      <button
                        className="co-primary"
                        disabled={busy}
                        onClick={() => reveal(pack.index)}
                      >
                        Reveal card <FaArrowRight />
                      </button>
                      <small>Every card is a moment worth enjoying.</small>
                    </>
                  )}
                </div>
              </div>
            )}
            {state.stage === "dealing" && (
              <span className="co-dealing-label" role="status">
                Your cards are coming out…
              </span>
            )}
          </div>

          <div className="co-stage-footer">
            <div
              className="co-pack-progress"
              aria-label={`${revealedCount} of 11 cards revealed`}
            >
              {pack ? (
                <>
                  <div>
                    {pack.flipped.map((value, index) => (
                      <i className={value ? "revealed" : ""} key={index} />
                    ))}
                  </div>
                  <span>
                    {state.stage === "complete" ? (
                      <>
                        <FaCheck /> Pack complete
                      </>
                    ) : state.stage === "sealed" ? (
                      "Ready when you are"
                    ) : (
                      `${revealedCount} of 11 revealed`
                    )}
                  </span>
                </>
              ) : (
                <span>
                  <FaBoxOpen /> No rush. Enjoy every card.
                </span>
              )}
            </div>
            <div className="co-footer-actions">
              {pack && state.showPrices && revealedCount > 0 && (
                <span className="co-pack-total">
                  {packValue.priced < packValue.total
                    ? "Known pack value"
                    : "Estimated pack value"}{" "}
                  <strong>{formatValue(packValue.amount)}</strong>
                </span>
              )}
              {state.stage === "complete" && (
                <button className="co-primary" onClick={open}>
                  Open another pack <FaBoxOpen />
                </button>
              )}
            </div>
          </div>
          {state.setId !== pack?.setId && pack && (
            <div className="co-next-set-note">
              Your next pack will be {selectedSet.name}.
            </div>
          )}
        </section>

        <div className="co-below-stage">
          <p>
            <FaBoxOpen /> Free simulation. Your reveals stay in this session.
          </p>
          {state.showPrices && (
            <p className="co-market-note">
              USD market estimates · {sourceDate} ·{" "}
              <a
                href={OPENER_MARKET.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                TCGplayer via TCGCSV ↗
              </a>
            </p>
          )}
        </div>
        <Gallery state={state} onClear={() => setConfirmClear(true)} />
        <details className="co-about">
          <summary>
            About these simulated packs <FaChevronDown />
          </summary>
          <p>
            Each pack has 11 cards with a common, uncommon, and rare mix. Base
            Set and the Gym sets include Energy cards. The rare slot uses a
            simulated one in three chance of a holo. These are approximate
            opening odds. Story Mode collections and coins are separate from
            this simulator.
          </p>
          <p>
            Displayed values are cached TCGplayer market estimates in USD for
            standard or unlimited printings, supplied by TCGCSV. Actual card
            condition and edition affect value. A missing price is shown as
            unavailable. Your gallery lasts for this browser tab, including page
            refreshes.
          </p>
        </details>
      </div>
      {confirmClear && (
        <ClearDialog
          onCancel={() => setConfirmClear(false)}
          onClear={() => {
            dispatch({ type: "clear" });
            setConfirmClear(false);
          }}
        />
      )}
      <span className="co-live-announcement" aria-live="polite">
        {state.stage === "tearing"
          ? "Opening the pack from left to right."
          : state.stage === "dealing"
            ? "Dealing eleven cards."
            : state.stage === "complete"
              ? "Pack complete. All cards are in Cards Opened."
              : `${revealedCount} cards revealed in this pack.`}
      </span>
    </main>
  );
}

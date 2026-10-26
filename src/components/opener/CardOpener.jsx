import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowRight,
  FaBoxOpen,
  FaCheck,
  FaChevronDown,
  FaExpandAlt,
  FaSearch,
  FaStar,
  FaTimes,
  FaHandPointer,
} from "react-icons/fa";
import { useCardPreview } from "../CardPreview.jsx";
import { useSettings } from "../Settings.jsx";
import { playSfx } from "../../lib/sfx.js";
import {
  OPENER_BY_ID,
  OPENER_MARKET,
  OPENER_SETS,
  formatValue,
  isShinyPull,
  isBigHit,
  openedValue,
  openerSet,
  quoteFor,
  rollOpenerPack,
  saleValueCents,
} from "../../lib/cardOpener.js";
import { Shopfront } from "./Shopfront.jsx";
import "./card-opener.css";
import "./card-shop.css";

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

function HitEffects() {
  const stars = [
    [7, 12],
    [89, 17],
    [16, 47],
    [83, 55],
    [10, 83],
    [92, 90],
    [43, 8],
    [57, 33],
    [33, 73],
    [70, 78],
    [51, 94],
    [73, 9],
  ];
  return (
    <span className="co-hit-effects" aria-hidden="true">
      <span className="co-hit-rainbow" />
      <span className="co-hit-sweep" />
      {stars.map(([x, y], index) => (
        <i
          className="co-hit-star"
          key={index}
          style={{
            left: `${x}%`,
            top: `${y}%`,
            "--star-i": index,
            "--star-size": `${8 + (index % 4) * 2}px`,
            "--star-large": `${12 + (index % 4) * 3}px`,
          }}
        >
          ✦
        </i>
      ))}
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
      className={`co-flip-card ${revealed ? "revealed" : ""} ${isShinyPull(card) && revealed ? "shiny" : ""} ${stack ? "in-stack" : ""} ${revealed && isBigHit(card) ? "big-hit" : ""}`}
      onClick={onClick}
      disabled={disabled}
      data-testid="opener-card"
      data-revealed={revealed ? "true" : "false"}
      data-big-hit={revealed && isBigHit(card) ? "true" : "false"}
      aria-label={
        !revealed
          ? `Reveal card ${index + 1}`
          : stack && !finished
            ? `Continue after ${card.name}`
            : `Inspect ${card.name}`
      }
    >
      {revealed && isBigHit(card) && (
        <>
          <span className="co-hit-aura" aria-hidden="true" />
          <span className="co-hit-rays" aria-hidden="true" />
          <span className="co-hit-badge">
            <FaStar /> BIG HIT
          </span>
        </>
      )}
      <span className="co-flip-inner">
        <span className="co-card-face back">
          <CardBack />
        </span>
        <span className="co-card-face front" aria-hidden={!revealed}>
          {revealed && <CardArt card={card} large={stack} />}
          {revealed && isBigHit(card) ? (
            <HitEffects />
          ) : revealed && isShinyPull(card) ? (
            <span className="co-reveal-shine" />
          ) : null}
        </span>
      </span>
    </button>
  );
}

function Pack({ set, tearing, onOpen, disabled }) {
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [started, setStarted] = useState(false);
  const drag = useRef(null);
  const imageStyle = { backgroundImage: `url("${set.image}")` };
  const updateDrag = (event) => {
    if (!drag.current || event.pointerId !== drag.current.pointerId) return;
    const amount = Math.max(
      drag.current.progress,
      Math.min(1, (event.clientX - drag.current.left) / drag.current.width),
    );
    drag.current.progress = amount;
    setProgress(amount);
    if (amount >= 0.96) {
      drag.current = null;
      setDragging(false);
      onOpen();
    }
  };
  const stopDrag = () => {
    drag.current = null;
    setDragging(false);
    // An interrupted gesture can be resumed from the torn edge.
  };
  return (
    <div
      className={`co-pack ${tearing ? "tearing" : ""} ${dragging ? "dragging" : ""} ${progress > 0 ? "partly-torn" : ""} ${started ? "tear-started" : ""}`}
      style={{ "--co-tear-progress": progress }}
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
        <>
          {!started && (
            <div className="co-tear-guide" aria-hidden="true">
              <span className="co-tear-dots" />
              <span className="co-tear-direction">
                <FaHandPointer />
                <FaArrowRight />
              </span>
            </div>
          )}
          <div
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label={`Tear open ${set.name} pack from left to right`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-valuetext={`${Math.round(progress * 100)} percent torn. Drag right or press the right arrow. Press Enter to open.`}
            aria-disabled={disabled}
            className="co-tear-target"
            data-testid="opener-tear"
            onPointerDown={(event) => {
              if (
                disabled ||
                (event.pointerType === "mouse" && event.button !== 0)
              )
                return;
              const rect = event.currentTarget.getBoundingClientRect();
              const start = (event.clientX - rect.left) / rect.width;
              if (start > progress + 0.22) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                pointerId: event.pointerId,
                left: rect.left,
                width: rect.width,
                progress,
              };
              setStarted(true);
              setDragging(true);
            }}
            onPointerMove={updateDrag}
            onPointerUp={(event) => {
              updateDrag(event);
              stopDrag();
            }}
            onPointerCancel={stopDrag}
            onLostPointerCapture={stopDrag}
            onKeyDown={(event) => {
              if (disabled) return;
              if (["Enter", " "].includes(event.key)) {
                event.preventDefault();
                setStarted(true);
                onOpen();
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                setStarted(true);
                const amount = Math.min(1, progress + 0.2);
                setProgress(amount);
                if (amount >= 0.96) onOpen();
              }
            }}
          />
          {!started && (
            <span className="co-pack-drag-label">
              Drag across the top <FaArrowRight />
            </span>
          )}
        </>
      )}
    </div>
  );
}

function PackEmergence({ set, count, mode }) {
  return (
    <div
      className={`co-pack-emergence ${mode}`}
      aria-label="Cards emerging from the pack"
      data-testid="pack-emergence"
    >
      <div className="co-empty-wrapper">
        <img src={set.image} alt="" />
      </div>
      {Array.from({ length: count }, (_, index) => (
        <div
          className="co-eject-card"
          style={{ "--co-i": index }}
          key={index}
          data-testid="emerging-card"
        >
          <CardBack />
        </div>
      ))}
      <span className="co-sr-only" role="status">
        All {count} cards are coming out of your pack.
      </span>
    </div>
  );
}

function OpeningPopup({ children, onClose, title, kind = "opening" }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const onKey = (event) => {
      if (
        document.querySelector(
          '[data-testid="card-preview"], [data-testid="settings-modal"], .co-clear-dialog[open]',
        )
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const controls = [
          ...ref.current.querySelectorAll(
            'button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex="0"], a[href]',
          ),
        ].filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (!controls.length) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);
  return (
    <div
      className="co-popup-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`co-popup ${kind === "inventory" ? "co-inventory-popup" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${kind}-popup-heading`}
        ref={ref}
        tabIndex={-1}
        data-testid={kind === "inventory" ? "inventory-modal" : "opener-modal"}
      >
        <header className="co-popup-header">
          <h2
            className={kind === "inventory" ? "" : "co-sr-only"}
            id={`${kind}-popup-heading`}
          >
            {title}
          </h2>
          <button
            className="co-popup-close"
            onClick={onClose}
            aria-label="Back to card shop"
          >
            <FaTimes />
          </button>
        </header>
        {children}
      </section>
    </div>
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
        Your balance and any unopened pack will be kept.
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

function Gallery({ state, dispatch, onClear }) {
  const preview = useCardPreview();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");
  const [limit, setLimit] = useState(30);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const entries = useMemo(() => {
    const result = [...state.history].reverse().filter((entry) => {
      const card = OPENER_BY_ID[entry.cardId];
      const sold = entry.soldForCents !== undefined;
      return (
        (filter === "all" || card.set === filter) &&
        (status === "all" || (status === "sold" ? sold : !sold)) &&
        `${card.name} ${card.rarity}`
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    });
    if (sort === "value")
      result.sort(
        (a, b) =>
          (saleValueCents(b.cardId) ?? -1) - (saleValueCents(a.cardId) ?? -1),
      );
    if (sort === "name")
      result.sort((a, b) =>
        OPENER_BY_ID[a.cardId].name.localeCompare(OPENER_BY_ID[b.cardId].name),
      );
    return result;
  }, [state.history, query, filter, status, sort]);
  const sellable = entries.filter(
    (entry) =>
      entry.soldForCents === undefined && saleValueCents(entry.cardId) !== null,
  );
  const total = sellable.reduce(
    (sum, entry) => sum + saleValueCents(entry.cardId),
    0,
  );
  const available = state.history.filter(
    (entry) => entry.soldForCents === undefined,
  ).length;
  const sourceDate = new Date(OPENER_MARKET.updatedAt).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
  );
  const changed = () => {
    setLimit(30);
    setConfirmBulk(false);
  };
  return (
    <section
      className="co-gallery"
      aria-label="Opened cards for viewing and sale"
    >
      <div className="co-inventory-summary">
        <span>
          {available} available · {state.history.length} opened
        </span>
        <div>
          <span>Balance</span>
          <strong data-testid="inventory-balance">
            {formatValue(state.balanceCents / 100)}
          </strong>
        </div>
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
                  changed();
                }}
              />
            </label>
            <select
              aria-label="Filter opened cards by set"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                changed();
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
              aria-label="Filter cards by sale status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                changed();
              }}
            >
              <option value="all">All cards</option>
              <option value="available">Available</option>
              <option value="sold">Sold</option>
            </select>
            <select
              aria-label="Sort opened cards"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setConfirmBulk(false);
              }}
            >
              <option value="recent">Latest pulls</option>
              <option value="name">Card name</option>
              <option value="value">Highest value</option>
            </select>
          </div>
          <div className="co-inventory-actions">
            <span>
              {entries.length} {entries.length === 1 ? "card" : "cards"}
            </span>
            <button
              className={`co-sell-all ${confirmBulk ? "confirming" : ""}`}
              data-testid="sell-all"
              disabled={!sellable.length}
              onClick={() => {
                if (!confirmBulk) {
                  setConfirmBulk(true);
                  return;
                }
                dispatch({
                  type: "sell_all",
                  keys: sellable.map((entry) => entry.key),
                });
                playSfx("coin");
                setConfirmBulk(false);
              }}
            >
              {confirmBulk
                ? "Confirm sale"
                : `${query.trim() || filter !== "all" || status !== "all" ? "Sell matching" : "Sell all"} (${sellable.length})`}{" "}
              · {formatValue(total / 100)}
            </button>
          </div>
          {entries.length ? (
            <div className="co-gallery-grid">
              {entries.slice(0, limit).map((entry) => {
                const card = OPENER_BY_ID[entry.cardId];
                const sold = entry.soldForCents !== undefined;
                const value = saleValueCents(entry.cardId);
                return (
                  <article
                    className={`co-gallery-card ${isShinyPull(card) ? "shiny" : ""} ${sold ? "sold" : ""}`}
                    key={entry.key}
                    data-testid="opened-card"
                    data-entry-key={entry.key}
                    data-sold={sold ? "true" : "false"}
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
                      </div>
                    </div>
                    <button
                      className="co-sell-card"
                      disabled={sold || value === null}
                      data-testid="sell-card"
                      aria-label={
                        sold
                          ? `${card.name} sold`
                          : `Sell ${card.name} for ${value === null ? "unavailable price" : formatValue(value / 100)}`
                      }
                      onClick={() => {
                        dispatch({ type: "sell", key: entry.key });
                        playSfx("coin");
                      }}
                    >
                      {sold ? (
                        <>
                          <FaCheck /> Sold ·{" "}
                          {formatValue(entry.soldForCents / 100)}
                        </>
                      ) : value === null ? (
                        "Price unavailable"
                      ) : (
                        <>
                          Sell <strong>{formatValue(value / 100)}</strong>
                        </>
                      )}
                    </button>
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
                  setStatus("all");
                  changed();
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
          <h3>Your next favorite is waiting.</h3>
          <p>The cards you reveal will be here to view or sell.</p>
        </div>
      )}
      <footer className="co-inventory-footer">
        <span>Simulated USD · Market estimates · {sourceDate}</span>
        {state.history.length > 0 && (
          <button className="co-text-button" onClick={onClear}>
            Clear history
          </button>
        )}
      </footer>
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
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const closeInventory = useCallback(() => setInventoryOpen(false), []);
  const [popupOpen, setPopupOpen] = useState(() =>
    Boolean(state.purchase || (state.pack && state.stage !== "complete")),
  );
  const openInventory = useCallback(() => {
    setPopupOpen(false);
    setInventoryOpen(true);
  }, []);
  const [packNotice, setPackNotice] = useState("");
  const closePopup = useCallback(() => setPopupOpen(false), []);
  const selectedSet = openerSet(state.setId);
  const packSet = state.pack ? openerSet(state.pack.setId) : selectedSet;
  const pack = state.pack;
  const busy = state.stage === "tearing" || state.stage === "dealing";
  const instant = reducedMotion || !settings.animations;
  const revealedCount = pack?.flipped.filter(Boolean).length || 0;
  const packValue = openedValue(
    state.history.filter((entry) => entry.packNumber === pack?.number),
  );
  const currentCard = pack ? OPENER_BY_ID[pack.ids[pack.index]] : null;
  const currentRevealed = pack?.flipped[pack.index] || false;

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
      instant ? 0 : state.stage === "tearing" ? 1150 : 2250,
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
  };
  const reveal = (index) => {
    if (busy || !pack || pack.flipped[index]) return;
    playSfx(isBigHit(OPENER_BY_ID[pack.ids[index]]) ? "cardRare" : "cardFlip");
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
      <div
        className="co-shop-shell"
        inert={popupOpen || inventoryOpen ? true : undefined}
      >
        <Shopfront
          state={state}
          instant={instant}
          dispatch={dispatch}
          busy={busy}
          onExit={onExit}
          onPurchase={(id) => {
            if (
              state.purchase ||
              (state.pack && !["sealed", "complete"].includes(state.stage))
            ) {
              setPackNotice(
                id !== packSet.id
                  ? `Your ${packSet.name} pack is still on the table. Finish revealing it before choosing another pack.`
                  : "",
              );
              setPopupOpen(true);
              return false;
            }
            setPackNotice("");
            dispatch({ type: "purchase", id });
            return true;
          }}
          onOpen={() => setPopupOpen(true)}
          onResume={() => {
            setPackNotice("");
            setPopupOpen(true);
          }}
          onGallery={openInventory}
        />
      </div>
      {inventoryOpen && (
        <OpeningPopup
          title="View/Sell cards"
          kind="inventory"
          onClose={closeInventory}
        >
          <Gallery
            state={state}
            dispatch={dispatch}
            onClear={() => setConfirmClear(true)}
          />
        </OpeningPopup>
      )}

      {popupOpen && (
        <OpeningPopup
          title={`Open ${state.stage === "sealed" ? selectedSet.name : packSet.name} pack`}
          onClose={closePopup}
        >
          {packNotice && state.stage !== "complete" && (
            <p className="co-popup-notice" role="status">
              {packNotice}
            </p>
          )}
          <section
            className="co-opening-room"
            aria-label="Pack opening simulator"
            data-testid="card-opener"
          >
            <div
              className={`co-stage ${state.stage} ${state.mode}`}
              data-testid="opener-stage"
              data-stage={state.stage}
            >
              {["sealed", "tearing"].includes(state.stage) ? (
                <div className="co-sealed-stage">
                  <div className="co-table-light" />
                  <Pack
                    key={selectedSet.id}
                    set={state.stage === "sealed" ? selectedSet : packSet}
                    tearing={state.stage === "tearing"}
                    onOpen={open}
                    disabled={busy}
                  />
                </div>
              ) : state.stage === "dealing" ? (
                <PackEmergence
                  set={packSet}
                  count={pack.ids.length}
                  mode={state.mode}
                />
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
                  <div
                    className="co-card-row"
                    aria-label="Cards from this pack"
                  >
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
                        className={`co-stack-value ${isBigHit(currentCard) ? "rare" : ""}`}
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
            </div>

            {["revealing", "complete"].includes(state.stage) && (
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
                    <button className="co-text-button" onClick={openInventory}>
                      View/Sell cards
                    </button>
                  )}
                  {state.stage === "complete" && (
                    <button className="co-primary" onClick={closePopup}>
                      Choose another pack <FaBoxOpen />
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        </OpeningPopup>
      )}

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

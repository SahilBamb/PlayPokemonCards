import { useEffect, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaCoins,
  FaGripHorizontal,
  FaLayerGroup,
  FaRegClone,
} from "react-icons/fa";
import { SettingsButton } from "../Settings.jsx";
import { playSfx } from "../../lib/sfx.js";
import {
  OPENER_MARKET,
  OPENER_SETS,
  formatValue,
} from "../../lib/cardOpener.js";

export function Shopfront({
  state,
  onPurchase,
  onOpen,
  onResume,
  onGallery,
  onExit,
  instant,
  dispatch,
  busy,
}) {
  const [pending, setPending] = useState(null);
  const [taking, setTaking] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const cancel = (event) => {
      if (event.key === "Escape") setPending(null);
    };
    document.addEventListener("keydown", cancel);
    return () => document.removeEventListener("keydown", cancel);
  }, []);
  const inProgress = Boolean(
    state.purchase || (state.pack && state.stage !== "complete"),
  );
  const activeSet = state.purchase?.setId || state.pack?.setId;
  const available = state.history.filter(
    (entry) => entry.soldForCents === undefined,
  ).length;
  const sourceDate = new Date(OPENER_MARKET.updatedAt).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
  );
  const resume = () => {
    clearTimeout(timer.current);
    setPending(null);
    setTaking(null);
    onResume();
  };
  const select = (id) => {
    if (taking || busy) return;
    if (inProgress && activeSet === id) {
      resume();
      return;
    }
    if (pending !== id) {
      setPending(id);
      return;
    }
    setPending(null);
    if (!onPurchase(id)) return;
    setTaking(id);
    playSfx("coin");
    timer.current = setTimeout(
      () => {
        setTaking(null);
        onOpen();
      },
      instant ? 0 : 650,
    );
  };
  return (
    <section
      className="co-shop-scene"
      aria-label="Pokémon card shop"
      data-testid="card-shop"
    >
      <img
        className="co-shop-background"
        src="/card-opener/shop/interior.webp"
        alt=""
      />
      <div className="co-shop-shade" />
      <img
        className="co-shopkeeper"
        src="/card-opener/shop/shopkeeper.webp"
        alt="A friendly card shopkeeper welcomes you to the counter"
      />

      <header className="co-store-header">
        <a
          className="co-pledge-badge"
          href="https://honest-anti-ai-pledge.pages.dev/?domain=playpokemoncards.pages.dev#art"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Read this project's Art pledge"
        >
          <img
            src="https://honest-anti-ai-pledge.pages.dev/badge/art.svg?domain=playpokemoncards.pages.dev&theme=light"
            alt="Honest Anti AI Art Pledge for playpokemoncards.pages.dev"
            width="400"
            height="88"
          />
        </a>
        <div className="co-store-brand">
          <button
            className="co-store-back"
            onClick={onExit}
            aria-label="Return to main menu"
          >
            <FaArrowLeft />
          </button>
          <img src="/pokeball.svg" alt="" />
          <h1>
            <b>Pokémon</b> Card Shop
          </h1>
        </div>
        <nav aria-label="Card shop controls">
          <div
            className={`co-balance-pill ${state.balanceCents < 0 ? "negative" : ""}`}
            title="Simulated USD. New players start with $10,000 and can spend below zero."
          >
            <FaCoins />
            <span>Balance</span>
            <strong
              data-testid="opener-balance"
              data-cents={state.balanceCents}
              role="status"
              aria-label={`Simulated balance ${formatValue(state.balanceCents / 100)}`}
            >
              {formatValue(state.balanceCents / 100)}
            </strong>
          </div>
          <button
            className="co-view-sell"
            onClick={onGallery}
            aria-label="View/Sell cards"
          >
            <FaRegClone />
            <span>View/Sell</span>
            {available > 0 && <i data-testid="inventory-count">{available}</i>}
          </button>
          <SettingsButton />
        </nav>
      </header>

      <div className="co-shop-aisle">
        <section
          className="co-pack-cabinet"
          id="shop-packs"
          aria-labelledby="shop-packs-heading"
        >
          <header className="co-cabinet-heading">
            <span>THE ORIGINAL SERIES</span>
            <h2 id="shop-packs-heading">Choose a pack</h2>
          </header>
          <div className="co-cabinet-shelves">
            {[0, 1].map((shelf) => (
              <div className="co-cabinet-shelf" key={shelf}>
                <div className="co-shop-product-grid">
                  {OPENER_SETS.slice(shelf * 3, shelf * 3 + 3).map((item) => {
                    const confirmed = pending === item.id;
                    const purchased = taking === item.id;
                    const continuing = inProgress && activeSet === item.id;
                    return (
                      <article
                        className={`co-shop-product ${purchased ? "taking" : ""} ${continuing ? "reserved" : ""}`}
                        key={item.id}
                      >
                        <div className="co-pack-frame" title={item.name}>
                          <img
                            src={item.image}
                            alt={`${item.name} booster pack`}
                            draggable={false}
                          />
                        </div>
                        <button
                          className={`co-pack-price ${confirmed ? "confirming" : ""} ${purchased ? "purchased" : ""} ${continuing ? "continuing" : ""}`}
                          onClick={() => select(item.id)}
                          disabled={Boolean(taking) || busy}
                          aria-label={
                            continuing
                              ? `Continue ${item.name} pack`
                              : confirmed
                                ? `Confirm ${item.name} pack`
                                : `Choose ${item.name} pack`
                          }
                          data-testid={`shelf-price-${item.id}`}
                          aria-describedby="shop-price-description"
                          title={
                            continuing
                              ? "Your pack is waiting at the opening table"
                              : `${OPENER_MARKET.packs[item.id].name} · TCGplayer market estimate in USD`
                          }
                        >
                          {continuing ? (
                            <FaArrowRight />
                          ) : purchased || confirmed ? (
                            <FaCheck />
                          ) : (
                            <FaCoins />
                          )}
                          <span>
                            {continuing && !purchased
                              ? "Continue"
                              : purchased
                                ? "Ready!"
                                : confirmed
                                  ? "Confirm?"
                                  : formatValue(item.priceCents / 100)}
                          </span>
                        </button>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <footer className="co-cabinet-footer">
            <div
              className="co-cabinet-preferences"
              aria-label="Opening preferences"
            >
              <div className="co-mode-picker">
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
                <span>Card values</span>
                <i>
                  <b />
                </i>
              </button>
            </div>
            <p className="co-shop-simulation" id="shop-price-description">
              Simulated USD · Market estimates · {sourceDate}{" "}
              <a
                href={OPENER_MARKET.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                TCGplayer ↗
              </a>
            </p>
          </footer>
        </section>
      </div>
      <div className="co-shop-counter" aria-hidden="true" />
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaBoxOpen,
  FaChevronLeft,
  FaChevronRight,
  FaCoins,
  FaCheck,
  FaGripHorizontal,
  FaLayerGroup,
  FaQuestionCircle,
  FaRegClone,
  FaStar,
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
  sessionValue,
  onPurchase,
  onOpen,
  onResume,
  onGallery,
  onExit,
  instant,
  dispatch,
  busy,
}) {
  const [featured, setFeatured] = useState(0);
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
  const select = (id, origin) => {
    if (taking || busy) return;
    if (pending?.id !== id || pending?.origin !== origin) {
      setPending({ id, origin });
      return;
    }
    setPending(null);
    if (!onPurchase(id)) return;
    setTaking({ id, origin });
    playSfx("coin");
    timer.current = setTimeout(
      () => {
        setTaking(null);
        onOpen();
      },
      instant ? 0 : 650,
    );
  };
  const resume = () => {
    clearTimeout(timer.current);
    setPending(null);
    setTaking(null);
    onResume();
  };
  const priceBadge = (item, origin) => {
    const confirmed = pending?.id === item.id && pending.origin === origin;
    const purchased = taking?.id === item.id && taking.origin === origin;
    return (
      <button
        className={`co-pack-price ${confirmed ? "confirming" : ""} ${purchased ? "purchased" : ""}`}
        onClick={() => select(item.id, origin)}
        disabled={Boolean(taking) || busy}
        aria-label={
          confirmed ? `Confirm ${item.name} pack` : `Choose ${item.name} pack`
        }
        data-testid={`${origin}-price-${item.id}`}
        aria-describedby="shop-price-description"
        title={`${OPENER_MARKET.packs[item.id].name} · TCGplayer market estimate in USD`}
      >
        {purchased || confirmed ? <FaCheck /> : <FaCoins />}
        <span>
          {purchased
            ? "Ready!"
            : confirmed
              ? "Confirm?"
              : formatValue(item.priceCents / 100)}
        </span>
      </button>
    );
  };

  const set = OPENER_SETS[featured];
  const inProgress = Boolean(
    state.purchase || (state.pack && state.stage !== "complete"),
  );
  const sourceDate = new Date(OPENER_MARKET.updatedAt).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
  );
  const behavior = instant ? "auto" : "smooth";
  const browse = () =>
    document
      .getElementById("shop-packs")
      ?.scrollIntoView({ behavior, block: "nearest" });
  return (
    <>
      <header className="co-store-header">
        <div className="co-store-brand">
          <button
            className="co-store-back"
            onClick={onExit}
            aria-label="Return to main menu"
          >
            <FaArrowLeft />
          </button>
          <img src="/pokeball.svg" alt="" />
          <div>
            <span>PLAYPOKEMONCARDS · CARD OPENER</span>
            <h1>
              <b>Pokémon</b> Card Shop
            </h1>
          </div>
        </div>
        <nav aria-label="Card shop navigation">
          <button onClick={onGallery} aria-label="View cards opened">
            <FaRegClone />
            <span>Cards opened</span>
            <i>{state.history.length}</i>
          </button>
          <button onClick={browse}>
            <FaLayerGroup />
            <span>Packs</span>
          </button>
          <SettingsButton />
        </nav>
      </header>

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

        <aside className="co-shop-sidebar">
          <div className="co-shop-glass co-shop-categories">
            <button className="active" onClick={browse}>
              <img src="/pokeball.svg" alt="" />
              <span>Booster Packs</span>
              <FaChevronRight />
            </button>
            <button onClick={onGallery}>
              <FaRegClone />
              <span>Cards Opened</span>
              <FaChevronRight />
            </button>
            <button
              onClick={() => {
                const details = document.getElementById("shop-how-it-works");
                if (details) {
                  details.open = true;
                  details.scrollIntoView({
                    behavior,
                    block: "center",
                  });
                }
              }}
            >
              <FaQuestionCircle />
              <span>How it works</span>
              <FaChevronRight />
            </button>
          </div>
          <div className="co-shop-glass co-shop-session">
            <span className="co-shop-label">YOUR VISIT</span>
            <p>
              <span>Packs opened</span>
              <strong>{state.packsOpened}</strong>
            </p>
            <p>
              <span>Cards revealed</span>
              <strong>{state.history.length}</strong>
            </p>
            {state.showPrices && (
              <p>
                <span>
                  {sessionValue.priced < sessionValue.total
                    ? "Known value"
                    : "Estimated value"}
                </span>
                <strong>{formatValue(sessionValue.amount)}</strong>
              </p>
            )}
            <small>Cards are kept for this browser tab.</small>
          </div>
          {(state.pack || state.purchase) && (
            <button className="co-shop-resume" onClick={resume}>
              <FaBoxOpen />
              {inProgress ? "Continue your pack" : "View your last pack"}
              <FaArrowRight />
            </button>
          )}
        </aside>

        <div className="co-shop-welcome">
          <span className="co-shop-label">WELCOME TO THE CARD SHOP</span>
          <h2>
            A little nostalgia.
            <br /> A fresh surprise.
          </h2>
          <p>
            Pick a pack. Make it a moment.
            <br /> Your next favorite might be inside.
          </p>
          {inProgress && (
            <button onClick={resume}>
              Your pack is waiting <FaArrowRight />
            </button>
          )}
        </div>

        <div className="co-shop-aisle">
          <section
            className="co-shop-glass co-featured"
            aria-labelledby="shop-featured-heading"
          >
            <div className="co-shop-panel-title">
              <h2 id="shop-featured-heading">
                <FaStar /> Featured Pack
              </h2>
              <span>THE CLASSICS</span>
            </div>
            <div
              className={`co-featured-poster ${taking?.origin === "featured" ? "taking" : ""}`}
              style={{ "--pack-accent": set.accent }}
            >
              <div className="co-featured-sparkles" aria-hidden="true">
                ✦ <i>✧</i> ✦
              </div>
              <div className="co-featured-copy">
                <span>
                  {set.year} · {set.count} CARDS
                </span>
                <h3>{set.name}</h3>
                <p>One pack. Eleven possibilities.</p>
                {priceBadge(set, "featured")}
              </div>
              <img
                className="co-featured-pack behind"
                src={OPENER_SETS[(featured + 1) % OPENER_SETS.length].image}
                alt=""
              />
              <img
                className="co-featured-pack main"
                src={set.image}
                alt={`${set.name} featured booster pack`}
              />
              <button
                className="co-featured-arrow prev"
                aria-label="Previous featured pack"
                disabled={Boolean(taking)}
                onClick={() =>
                  setFeatured(
                    (featured + OPENER_SETS.length - 1) % OPENER_SETS.length,
                  )
                }
              >
                <FaChevronLeft />
              </button>
              <button
                className="co-featured-arrow next"
                aria-label="Next featured pack"
                disabled={Boolean(taking)}
                onClick={() => setFeatured((featured + 1) % OPENER_SETS.length)}
              >
                <FaChevronRight />
              </button>
            </div>
            <div
              className="co-featured-dots"
              aria-label="Featured pack selection"
            >
              {OPENER_SETS.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => setFeatured(index)}
                  aria-label={`Feature ${item.name}`}
                  disabled={Boolean(taking)}
                  aria-pressed={index === featured}
                />
              ))}
            </div>
          </section>

          <section
            className="co-shop-glass co-shop-preferences"
            aria-label="Opening preferences"
          >
            <div
              className={`co-shop-wallet ${state.balanceCents < 0 ? "negative" : ""}`}
            >
              <div>
                <span>SIMULATED BALANCE</span>
                <small>$1,000 to start. Going below zero is okay.</small>
              </div>
              <strong
                data-testid="opener-balance"
                data-cents={state.balanceCents}
                role="status"
                aria-label={`Simulated balance ${formatValue(state.balanceCents / 100)}`}
              >
                {formatValue(state.balanceCents / 100)}
              </strong>
            </div>
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
          </section>

          <section
            className="co-shop-glass co-shop-packs"
            id="shop-packs"
            aria-labelledby="shop-packs-heading"
          >
            <div className="co-shop-panel-title">
              <h2 id="shop-packs-heading">
                <FaBoxOpen /> Booster Packs
              </h2>
              <span>6 CLASSIC SETS</span>
            </div>
            <div className="co-shop-product-grid">
              {OPENER_SETS.map((item) => (
                <article
                  className={`co-shop-product ${taking?.id === item.id && taking.origin === "shelf" ? "taking" : ""}`}
                  key={item.id}
                  style={{ "--pack-accent": item.accent }}
                >
                  <div className="co-pack-frame" title={item.name}>
                    <img
                      src={item.image}
                      alt={`${item.name} booster pack`}
                      draggable={false}
                    />
                  </div>
                  {priceBadge(item, "shelf")}
                </article>
              ))}
            </div>
            <p className="co-shop-simulation" id="shop-price-description">
              <span />
              Unlimited packs · USD estimates · {sourceDate} ·{" "}
              <a
                href={OPENER_MARKET.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                TCGplayer via TCGCSV ↗
              </a>
            </p>
          </section>
        </div>
        <div className="co-shop-counter">
          <span>YOUR NEIGHBORHOOD CARD SHOP</span>
          <span>Stay a while. Find a favorite.</span>
        </div>
      </section>
    </>
  );
}

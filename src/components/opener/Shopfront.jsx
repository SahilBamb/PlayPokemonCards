import { useState } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaBoxOpen,
  FaChevronLeft,
  FaChevronRight,
  FaCoins,
  FaLayerGroup,
  FaQuestionCircle,
  FaRegClone,
  FaStar,
} from "react-icons/fa";
import { SettingsButton } from "../Settings.jsx";
import { OPENER_SETS, formatValue } from "../../lib/cardOpener.js";

export function Shopfront({
  state,
  sessionValue,
  onChoose,
  onResume,
  onGallery,
  onExit,
  instant,
}) {
  const [featured, setFeatured] = useState(0);
  const set = OPENER_SETS[featured];
  const inProgress = state.pack && state.stage !== "complete";
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
          {state.pack && (
            <button className="co-shop-resume" onClick={onResume}>
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
            Take your time. Pick a pack.
            <br /> This one’s on the house.
          </p>
          {inProgress && (
            <button onClick={onResume}>
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
              className="co-featured-poster"
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
                <button onClick={() => onChoose(set.id)}>
                  Take a pack <FaArrowRight />
                </button>
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
                  aria-pressed={index === featured}
                />
              ))}
            </div>
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
                <button
                  className="co-shop-product"
                  key={item.id}
                  onClick={() => onChoose(item.id)}
                  aria-label={`Choose ${item.name} pack`}
                  style={{ "--pack-accent": item.accent }}
                >
                  <div className="co-product-art">
                    <span>{item.year}</span>
                    <img src={item.image} alt={`${item.name} booster pack`} />
                  </div>
                  <div className="co-product-description">
                    <h3>{item.name}</h3>
                    <span>
                      <FaCoins /> On the house
                    </span>
                    <small>{item.count} cards to discover</small>
                  </div>
                  <span className="co-product-action">
                    Take a pack <FaArrowRight />
                  </span>
                </button>
              ))}
            </div>
            <p className="co-shop-simulation">
              <span />
              Free pack simulation. Just for the joy of the reveal.
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

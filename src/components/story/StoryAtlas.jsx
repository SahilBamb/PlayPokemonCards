import { createElement, useState } from "react";
import {
  FaArrowLeft,
  FaCheck,
  FaCoins,
  FaLayerGroup,
  FaMapMarkedAlt,
  FaStore,
  FaTrophy,
  FaUserAlt,
} from "react-icons/fa";
import { SettingsButton } from "../Settings.jsx";

/* Pure atlas helpers share this file with its view components. */
/* eslint-disable react-refresh/only-export-components */
export const ATLAS_MAP = "/story-atlas/kanto-map.webp";
const REGIONS = {
  pewter: [30, 28],
  cerulean: [69, 27],
  vermilion: [79, 58],
  celadon: [49, 49],
  fuchsia: [65, 81],
  saffron: [65, 44],
  cinnabar: [27, 83],
  viridian: [24, 53],
  indigo: [16, 14],
  hideout: [24, 53],
  harbor: [79, 58],
  corner: [49, 49],
  lab: [27, 83],
  silph: [65, 44],
  hq: [30, 28],
};
export const regionPosition = (id, index = 0) =>
  REGIONS[id] ?? [20 + (index % 3) * 28, 30 + Math.floor(index / 3) * 25];
export const regionArtStyle = (id) => {
  const [x, y] = regionPosition(id);
  return {
    backgroundImage: `url(${ATLAS_MAP})`,
    backgroundSize: "280% auto",
    backgroundPosition: `${x}% ${y}%`,
  };
};

export function StoryCoins({ coins }) {
  return (
    <span
      className="atlas-coins"
      data-testid="coins"
      aria-label={`${coins} story coins`}
    >
      <FaCoins aria-hidden="true" /> {coins.toLocaleString()}
    </span>
  );
}

export function StoryHeader({
  coins,
  onBack,
  onJourney,
  onEditor,
  onShop,
  active = "journey",
  backLabel = "Stories",
}) {
  return (
    <header className="atlas-header">
      <button
        className="atlas-brand"
        onClick={onBack}
        aria-label={`Back to ${backLabel}`}
      >
        <img src="/pokeball.svg" alt="" />
        <span>
          PlayPokemonCards<small>STORY MODE</small>
        </span>
      </button>
      <nav className="atlas-nav" aria-label="Story navigation">
        {[
          [onJourney, "journey", FaMapMarkedAlt, "Journey"],
          [onEditor, "decks", FaLayerGroup, "Decks"],
          [onShop, "shop", FaStore, "Shop"],
        ].map(
          ([action, id, Icon, label]) =>
            action && (
              <button
                key={id}
                onClick={action}
                aria-current={active === id ? "page" : undefined}
                data-testid={
                  id === "decks"
                    ? "to-editor"
                    : id === "shop"
                      ? "to-shop"
                      : "to-journey"
                }
              >
                {createElement(Icon, { "aria-hidden": true })}
                {label}
              </button>
            ),
        )}
      </nav>
      <div className="atlas-header-tools">
        <StoryCoins coins={coins} />
        <SettingsButton />
      </div>
    </header>
  );
}

export function AtlasPortrait({ name, image, className = "" }) {
  const [failedImage, setFailedImage] = useState(null);
  return (
    <span className={`atlas-portrait ${className}`}>
      {image && failedImage !== image ? (
        <img
          src={image}
          alt={name}
          onError={() => setFailedImage(image)}
          draggable={false}
        />
      ) : (
        <span className="atlas-portrait-fallback" aria-label={name}>
          <FaUserAlt />
          <b>{name}</b>
        </span>
      )}
    </span>
  );
}

export function AtlasBadges({ story, state, onArea }) {
  const areas = story.areas.filter((area) => area.badge);
  return (
    <div className="atlas-badges" data-testid="badge-case">
      <div className="atlas-badge-icons">
        {areas.map((area) => {
          const earned = state.badges.some((badge) => badge.areaId === area.id);
          return (
            <button
              key={area.id}
              onClick={() => onArea?.(area.id)}
              className={earned ? "earned" : ""}
              title={`${area.badge.name ?? area.name}${earned ? " earned" : " not yet earned"}`}
              aria-label={`${area.badge.name ?? area.name}${earned ? ", earned" : ", not yet earned"}`}
            >
              <img src={area.badge.image} alt="" draggable={false} />
              {earned && <FaCheck className="atlas-badge-check" />}
            </button>
          );
        })}
        <span
          title={story.trophy?.name ?? "Champion trophy"}
          className={`atlas-trophy ${state.trophy ? "earned" : ""}`}
        >
          <FaTrophy />
        </span>
      </div>
      <span className="atlas-badge-count">
        <strong>
          {state.badges.length} / {areas.length}
        </strong>
        <small>Badges earned</small>
      </span>
    </div>
  );
}

export function AtlasBack({ onClick, children = "Back" }) {
  return (
    <button className="atlas-button secondary" onClick={onClick}>
      <FaArrowLeft />
      {children}
    </button>
  );
}

import {
  FaArrowLeft,
  FaArrowRight,
  FaCheck,
  FaLayerGroup,
  FaTrophy,
} from "react-icons/fa";
import { STORIES } from "../../data/stories.js";
import { storyState, resetProfile } from "../../lib/profileStore.js";
import { byName } from "../../engine/cards.js";
import { StoryHeader, storyMap } from "./StoryAtlas.jsx";
import { StoryModal } from "./StoryModal.jsx";

const CAMPAIGN_COPY = {
  kanto: ["THE ORIGINAL ADVENTURE", "A familiar world. A new hand."],
  rocket: ["A REGION UNDER SIEGE", "Turn the tide. Take Kanto back."],
  league: ["THE NEXT CHAPTER", "The League is ready. Are you?"],
};

export function StorySelect({ profile, onSelect, onReset, onBack }) {
  return (
    <div className="atlas-select-page">
      <StoryHeader
        coins={profile.coins}
        onBack={onBack}
        backLabel="Main Menu"
      />
      <section className="atlas-select-heading">
        <span className="atlas-eyebrow">EXPLORE THE REGION</span>
        <h1>Kanto</h1>
        <p>
          Three stories. One familiar region.
          <br /> Choose a story to explore its map and begin your adventure.
        </p>
      </section>
      <div className="atlas-campaign-cards">
        {Object.values(STORIES).map((story) => {
          const state = storyState(profile, story.id);
          const started = !!state.starterDeckId;
          return (
            <button
              className={`atlas-campaign-card ${story.id}`}
              data-testid={`story-${story.id}`}
              key={story.id}
              onClick={() => onSelect(story)}
            >
              <div className="atlas-campaign-cover">
                <img src={storyMap(story).image} alt="" />
                <span className="atlas-campaign-number">
                  {story.id === "kanto"
                    ? "01"
                    : story.id === "rocket"
                      ? "02"
                      : "03"}
                </span>
                <img
                  className="atlas-campaign-emblem"
                  src={story.cover || "/pokeball.svg"}
                  alt=""
                />
              </div>
              <div className="atlas-campaign-card-body">
                <span className="atlas-eyebrow">
                  {CAMPAIGN_COPY[story.id][0]}
                </span>
                <h2>{story.name}</h2>
                <p>{CAMPAIGN_COPY[story.id][1]}</p>
                <small>{story.description}</small>
                <div className="atlas-campaign-status">
                  {started ? (
                    <>
                      <FaCheck />
                      {state.badges.length} badges · {state.beaten.length}{" "}
                      battles won {state.trophy && <FaTrophy />}
                    </>
                  ) : (
                    <>
                      <FaLayerGroup />
                      New adventure
                    </>
                  )}
                </div>
                <span className="atlas-button primary">
                  {started ? "Continue journey" : "Explore story"}
                  <FaArrowRight />
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <footer className="atlas-select-footer">
        <button onClick={onBack}>
          <FaArrowLeft />
          Main Menu
        </button>
        <p>Your collection, coins and saved progress travel with you.</p>
        <button
          className="atlas-reset"
          onClick={() => {
            if (
              window.confirm(
                "Reset your story profile? Collection, coins, decks progress, and badges will be lost.",
              )
            )
              onReset(resetProfile());
          }}
        >
          Reset Profile
        </button>
      </footer>
    </div>
  );
}

export function StarterPick({ story, onPick, onBack }) {
  return (
    <StoryModal
      label={`Choose a starting deck for ${story.name}`}
      onClose={onBack}
      className="atlas-starter-modal"
      testId="starter-dialog"
    >
      <header className="atlas-starter-modal-heading">
        <span className="atlas-eyebrow">KANTO · {story.name}</span>
        <h2 data-autofocus tabIndex={-1}>
          Choose your starting deck
        </h2>
        <p>Your first sixty cards. Pick a partner for the journey ahead.</p>
      </header>
      <div className="atlas-starter-choices">
        {story.starterDecks.map((starter, i) => (
          <button
            className={`atlas-starter-card starter-${i}`}
            data-testid={`starter-${starter.id}`}
            key={starter.id}
            onClick={() => onPick(starter)}
          >
            <div className="atlas-starter-covers">
              {starter.coverCards.map((name) => (
                <img
                  key={name}
                  src={byName[name]?.image}
                  alt={name}
                  draggable={false}
                />
              ))}
            </div>
            <span className="atlas-eyebrow">STARTER DECK · 60 CARDS</span>
            <h3>{starter.name}</h3>
            <p>{starter.description}</p>
            <span className="atlas-button primary">
              Choose this deck <FaArrowRight />
            </span>
          </button>
        ))}
      </div>
      <p className="atlas-starter-note">
        These cards join your collection. Basic Energy is always available in
        the Deck Editor.
      </p>
    </StoryModal>
  );
}

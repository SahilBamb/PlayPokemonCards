import { useState } from "react";
import {
  FaArrowRight,
  FaCheck,
  FaChevronDown,
  FaLock,
  FaMapMarkerAlt,
  FaPen,
  FaTrophy,
} from "react-icons/fa";
import { STORIES, storyFormat } from "../../data/stories.js";
import { byName } from "../../engine/cards.js";
import { loadDecks, validateDeck } from "../../lib/deckStore.js";
import {
  storyState,
  areaUnlocked,
  nodeUnlocked,
  areaCompleted,
} from "../../lib/profileStore.js";
import {
  storyMap,
  AtlasBadges,
  AtlasPortrait,
  StoryHeader,
  regionArtStyle,
  regionPosition,
} from "./StoryAtlas.jsx";

function OpponentToken({ node, beaten, unlocked, onChallenge }) {
  const hidden = !beaten && node.kind !== "trainer";
  return (
    <button
      className={`atlas-opponent-token ${beaten ? "beaten" : ""} ${unlocked ? "available" : "locked"}`}
      disabled={!unlocked}
      onClick={onChallenge}
      data-testid={`node-${node.id}`}
      data-beaten={beaten ? "1" : "0"}
      title={hidden ? "An unknown opponent awaits" : node.char.name}
    >
      <span className="atlas-token-art">
        {hidden ? (
          <b>{node.kind === "boss" ? "!" : "?"}</b>
        ) : (
          <AtlasPortrait {...node.char} />
        )}
        {beaten ? (
          <i>
            <FaCheck />
          </i>
        ) : !unlocked ? (
          <i>
            <FaLock />
          </i>
        ) : null}
      </span>
      <span>{hidden ? "???" : node.char.name}</span>
    </button>
  );
}

export function StoryScreen({
  story,
  profile,
  onChallenge,
  onShop,
  onEditor,
  onSetDeck,
  onSelectStory,
  onBack,
  onBegin,
}) {
  const state = storyState(profile, story.id);
  const started = !!state.starterDeckId;
  const [selectedId, setSelectedId] = useState(
    () =>
      (
        story.areas.find((area) => !areaCompleted(area, state)) ??
        story.areas.at(-1)
      ).id,
  );
  const selectedIndex = Math.max(
    0,
    story.areas.findIndex((area) => area.id === selectedId),
  );
  const area = story.areas[selectedIndex];
  const unlocked = areaUnlocked(story, state, selectedIndex);
  const completed = areaCompleted(area, state);
  const nextNode =
    area.nodes.find((node) => !state.beaten.includes(node.id)) ??
    area.nodes.at(-1);
  const hidden =
    !state.beaten.includes(nextNode.id) && nextNode.kind !== "trainer";
  const name = hidden
    ? nextNode.kind === "boss"
      ? "A powerful challenger awaits"
      : "A familiar face?"
    : nextNode.char.name;
  const format = storyFormat(story);
  const decks = loadDecks().filter(
    (deck) => (deck.format ?? "classic") === format.id,
  );
  const activeDeck = started
    ? (decks.find((deck) => deck.id === state.activeDeckId) ?? decks[0])
    : null;
  const problems = activeDeck
    ? validateDeck(activeDeck.counts, profile.collection, format)
    : ["Choose a battle deck."];
  const battleReady = started && problems.length === 0;
  const covers = Object.keys(activeDeck?.counts ?? {})
    .filter((name) => byName[name]?.supertype === "pokemon")
    .slice(0, 3);
  const beatenCount = area.nodes.filter((node) =>
    state.beaten.includes(node.id),
  ).length;
  const challenge = (node) => {
    if (battleReady && activeDeck) onChallenge(node, activeDeck);
  };
  const points = story.areas.map((a, i) => regionPosition(a.id, i));

  return (
    <div className="atlas-journey" data-campaign={story.id}>
      <StoryHeader
        coins={profile.coins}
        onBack={onBack}
        onJourney={() =>
          setSelectedId(
            (
              story.areas.find((a) => !areaCompleted(a, state)) ??
              story.areas.at(-1)
            ).id,
          )
        }
        onEditor={onEditor}
        onShop={onShop}
      />
      <div className="atlas-campaign-bar">
        <div className="atlas-campaign-tabs" aria-label="Campaigns">
          {Object.values(STORIES).map((s) => (
            <button
              key={s.id}
              data-testid={`story-${s.id}`}
              aria-current={s.id === story.id ? "page" : undefined}
              onClick={() => onSelectStory(s)}
            >
              <img src={s.cover || "/pokeball.svg"} alt="" />
              {s.name}
            </button>
          ))}
        </div>
        <div className="atlas-journey-title">
          <span className="atlas-eyebrow">EXPLORE THE REGION</span>
          <h1>Kanto</h1>
          <p>{story.name}</p>
        </div>
        <AtlasBadges story={story} state={state} onArea={setSelectedId} />
      </div>

      <label className="atlas-mobile-region-picker">
        Explore the region
        <select
          aria-label="Choose a region"
          value={area.id}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {story.areas.map((a, i) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {!areaUnlocked(story, state, i)
                ? " · Locked"
                : areaCompleted(a, state)
                  ? " · Cleared"
                  : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="atlas-journey-content">
        <section
          className="atlas-map"
          aria-label={`${story.name} journey map`}
          data-testid="atlas-map"
        >
          <img
            className="atlas-map-art"
            src={storyMap(story).image}
            alt={storyMap(story).alt}
          />
          <svg
            className="atlas-route-lines"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {points.slice(1).map(([x, y], i) => (
              <path
                key={story.areas[i].id}
                className={
                  areaCompleted(story.areas[i], state) ? "cleared" : ""
                }
                d={`M ${points[i][0]} ${points[i][1]} Q ${(points[i][0] + x) / 2 + 4} ${(points[i][1] + y) / 2 - 5} ${x} ${y}`}
              />
            ))}
          </svg>
          <div className="atlas-map-caption">
            <FaMapMarkerAlt />
            <span>
              {area.name}
              <small>
                {completed
                  ? "Area cleared"
                  : `${beatenCount} of ${area.nodes.length} battles won`}
              </small>
            </span>
          </div>
          {story.areas.map((a, i) => {
            const done = areaCompleted(a, state);
            const open = areaUnlocked(story, state, i);
            const [x, y] = points[i];
            return (
              <button
                key={a.id}
                data-testid={`area-${a.id}`}
                className={`atlas-region ${a.id === area.id ? "selected" : ""} ${done ? "cleared" : ""} ${open ? "unlocked" : "locked"}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                onClick={() => setSelectedId(a.id)}
                aria-pressed={a.id === area.id}
                aria-label={`${a.name}, ${done ? "cleared" : open ? "available" : "locked"}`}
              >
                <span className="atlas-region-label">
                  {!open && <FaLock />}
                  {a.name}
                </span>
                <span className="atlas-map-pin">
                  {done ? (
                    <FaCheck />
                  ) : a.id === area.id ? (
                    <img src="/pokeball.svg" alt="" />
                  ) : !open ? (
                    <FaLock />
                  ) : (
                    <i />
                  )}
                </span>
              </button>
            );
          })}
          <div className="atlas-map-legend">
            <span>
              <i />
              Your next chapter
            </span>
            <span>
              <FaLock />
              Not yet reached
            </span>
          </div>
          <button
            className="atlas-map-continue atlas-button primary"
            onClick={() =>
              document
                .getElementById("atlas-next-encounter")
                ?.scrollIntoView({ block: "start" })
            }
          >
            Next battle
            <FaArrowRight />
          </button>
        </section>

        <aside
          id="atlas-next-encounter"
          className="atlas-encounter-panel"
          aria-label="Selected region and next battle"
        >
          <div
            className="atlas-encounter-art"
            style={regionArtStyle(area.id, story)}
          >
            <span className="atlas-eyebrow">
              {completed
                ? "CHAPTER COMPLETE"
                : unlocked
                  ? "YOUR NEXT CHAPTER"
                  : "ON THE HORIZON"}
            </span>
            <h2>{area.name}</h2>
            {!hidden ? (
              <AtlasPortrait {...nextNode.char} />
            ) : (
              <div className="atlas-mystery-portrait" aria-hidden="true">
                {nextNode.kind === "boss" ? "!" : "?"}
              </div>
            )}
          </div>
          <div className="atlas-encounter-details">
            <p className="atlas-eyebrow">
              {completed
                ? "Return for a friendly rematch"
                : hidden
                  ? "An unexpected encounter"
                  : "Next battle"}
            </p>
            <h3>{name}</h3>
            <p className="atlas-encounter-quote">
              {!started
                ? story.description
                : !unlocked
                  ? "Complete the previous area to reach this part of your journey."
                  : hidden
                    ? "Some surprises are best discovered along the way."
                    : nextNode.dialogue.intro[0]}
            </p>
            <div className="atlas-encounter-action">
              <span className="atlas-reward">
                <span>₽</span>
                {nextNode.rewards.win} coins<small>Victory reward</small>
              </span>
              <button
                className="atlas-button primary"
                disabled={started && (!unlocked || !battleReady)}
                data-testid={!started ? "begin-story" : "challenge-next"}
                onClick={() => (started ? challenge(nextNode) : onBegin())}
              >
                {!started ? (
                  <>
                    Begin story <FaArrowRight />
                  </>
                ) : !unlocked ? (
                  <>
                    <FaLock />
                    Locked
                  </>
                ) : (
                  <>
                    {completed ? "Rematch" : "Challenge"}
                    <FaArrowRight />
                  </>
                )}
              </button>
            </div>
            {started && !battleReady && (
              <button className="atlas-deck-warning" onClick={onEditor}>
                {problems[0]} Open Decks to get ready <FaArrowRight />
              </button>
            )}
            <div className="atlas-chapter-progress">
              <div>
                <strong>BATTLE PROGRESSION</strong>
                <span>
                  {beatenCount} / {area.nodes.length} completed
                </span>
              </div>
              <div className="atlas-opponent-path">
                {area.nodes.map((node, i) => (
                  <OpponentToken
                    key={node.id}
                    node={node}
                    beaten={state.beaten.includes(node.id)}
                    unlocked={
                      battleReady &&
                      unlocked &&
                      nodeUnlocked(story, state, selectedIndex, i)
                    }
                    onChallenge={() => challenge(node)}
                  />
                ))}
              </div>
            </div>
            {state.trophy && (
              <p className="atlas-complete-note">
                <FaTrophy />
                {story.trophy.name}
              </p>
            )}
          </div>
        </aside>
      </div>

      <footer
        className={`atlas-deck-dock ${started ? "" : "atlas-deck-unstarted"}`}
      >
        {!started ? (
          <>
            <div className="atlas-first-deck">
              <span className="atlas-eyebrow">YOUR STORY STARTS HERE</span>
              <h3>A deck for the journey</h3>
              <p>
                Choose your starter when you are ready to begin {story.name}.
              </p>
            </div>
            <button
              className="atlas-button primary"
              data-testid="choose-starter"
              onClick={onBegin}
            >
              <FaPen />
              Choose starting deck
            </button>
          </>
        ) : (
          <>
            <label>
              <span className="atlas-eyebrow">BATTLE DECK</span>
              <span className="atlas-deck-picker">
                <select
                  data-testid="deck-select"
                  aria-label="Battle deck"
                  value={activeDeck?.id ?? ""}
                  onChange={(e) => onSetDeck(e.target.value)}
                >
                  {decks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.name || "Untitled deck"}
                    </option>
                  ))}
                  {!decks.length && <option value="">Choose a deck</option>}
                </select>
                <FaChevronDown />
              </span>
            </label>
            <div className="atlas-deck-covers" aria-hidden="true">
              {covers.map((name) => (
                <img
                  key={name}
                  src={byName[name].image}
                  alt=""
                  draggable={false}
                />
              ))}
            </div>
            <span className="atlas-deck-size">
              {Object.values(activeDeck?.counts ?? {}).reduce(
                (a, b) => a + b,
                0,
              )}{" "}
              / 60 <small>cards</small>
            </span>
            <span
              className={`atlas-deck-ready ${battleReady ? "" : "invalid"}`}
            >
              <FaCheck />
              {battleReady ? "Ready to battle" : "Deck needs attention"}
            </span>
            <button className="atlas-button secondary" onClick={onEditor}>
              <FaPen />
              Edit deck
            </button>
          </>
        )}
      </footer>
    </div>
  );
}

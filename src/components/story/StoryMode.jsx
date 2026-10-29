import { useState, useCallback, useRef, useEffect } from "react";
import { MatchScreen } from "../MatchScreen.jsx";
import { DeckEditor } from "../DeckEditor.jsx";
import { StorySelect, StarterPick } from "./StorySelect.jsx";
import { StoryScreen } from "./StoryScreen.jsx";
import { ShopScreen } from "./ShopScreen.jsx";
import { DialogueBox } from "./DialogueBox.jsx";
import { storyFormat } from "../../data/stories.js";
import { StoryHeader, regionArtStyle } from "./StoryAtlas.jsx";
import "./story-atlas.css";
import {
  BOSS_DECKS,
  generateTrainerDeck,
  countsToList,
} from "../../data/storyDecks.js";
import { saveDeck, newDeckId, deckToList } from "../../lib/deckStore.js";
import {
  loadProfile,
  saveProfile,
  storyState,
  chooseStarter,
  setActiveDeck,
  recordBattle,
} from "../../lib/profileStore.js";

// Expand a node's deck spec into the flat list initialMatchState consumes.
function nodeDeckList(node, story) {
  const spec = node.deck ?? {};
  if (spec.boss) return countsToList(BOSS_DECKS[spec.boss]);
  const gen = spec.gen ?? { types: ["colorless"], tier: 1 };
  return countsToList(
    generateTrainerDeck(gen.types, gen.tier, node.id, storyFormat(story)),
  );
}

// Story Mode keeps setup and conversations above the campaign map hub.
// Owns the profile (persisted on every change), shop, editor and battles.
export function StoryMode({ onExit }) {
  const [profile, setProfileState] = useState(loadProfile);
  const setProfile = useCallback((next) => {
    setProfileState((prev) =>
      saveProfile(typeof next === "function" ? next(prev) : next),
    );
  }, []);

  const [story, setStory] = useState(null);
  const [view, setView] = useState("select"); // select | hub | shop | editor | battle
  const [dialogue, setDialogue] = useState(null); // { char, lines } or { scene } plus onDone/onCancel
  const [starterOpen, setStarterOpen] = useState(false);
  const [battle, setBattle] = useState(null); // { node, config, key }
  const outcome = useRef(null); // set by onResult, consumed on battle exit

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [view, story?.id]);

  const enterStory = (s) => {
    setStarterOpen(false);
    setDialogue(null);
    setStory(s);
    setView("hub");
  };

  const pickStarter = (starter) => {
    // Keep the stable story save ID; a starter is granted only once per story.
    if (storyState(loadProfile(), story.id).starterDeckId) return;
    const deck = saveDeck({
      id: newDeckId(),
      name: starter.name,
      counts: { ...starter.counts },
      format: story.formatId,
    });
    setProfile((p) => chooseStarter(p, story, starter, deck.id));
    setStarterOpen(false);
    const scene = (story.intro ?? []).map((beat) => ({
      ...beat,
      text: String(beat.text).replaceAll("{starter}", starter.name),
    }));
    setDialogue({
      scene: scene.length
        ? scene
        : [
            {
              name: "Professor Oak",
              image: null,
              text: `${starter.name} — a fine choice! Now go challenge the trainers of ${story.name}.`,
            },
          ],
      onDone: () => setDialogue(null),
      onCancel: () => setDialogue(null),
      cancelLabel: "Return to map",
      context: { location: story.name },
    });
    setView("hub");
  };

  // Challenge flow: intro dialogue -> battle -> result recorded once ->
  // win/lose dialogue with rewards when the player leaves the match.
  const challenge = (node, deck) => {
    const area = story.areas.find((a) => a.nodes.some((n) => n.id === node.id));
    const config = {
      playerDeckList: deckToList(deck),
      playerDeckName: deck.name,
      aiDeckList: nodeDeckList(node, story),
      aiDeckName: `${node.char.name}'s deck`,
      aiId: node.aiId,
      opponent: node.char,
      storyAtlas: true,
      storyLocation: area.name,
      storyName: story.name,
      onResult: (won) => {
        const { profile: next, awards } = recordBattle(
          loadProfile(),
          story,
          node,
          won,
        );
        setProfile(next);
        outcome.current = { node, won, awards };
      },
    };
    setDialogue({
      char: node.char,
      lines: node.dialogue.intro,
      context: {
        location: area.name,
        coins: node.rewards.win,
        badge: node.kind === "boss" ? area.badge : null,
      },
      sceneStyle:
        node.kind === "boss"
          ? { backgroundImage: "url(/story-atlas/pewter-gym.webp)" }
          : regionArtStyle(area.id, story),
      doneLabel: "Battle!",
      onCancel: () => setDialogue(null), // player can back out of the fight
      onDone: () => {
        setDialogue(null);
        setBattle({ node, config, key: Date.now() });
        setView("battle");
      },
    });
  };

  const exitBattle = () => {
    setView("hub");
    setBattle(null);
    const res = outcome.current;
    outcome.current = null;
    if (!res) return; // forfeited before the match ended — no rewards
    const { node, won, awards } = res;
    const area = story.areas.find((a) => a.nodes.some((n) => n.id === node.id));
    const cutscene =
      won && (awards.badge || awards.trophy) && area?.cutscene?.length
        ? area.cutscene
        : null;
    const lines = [...(won ? node.dialogue.win : node.dialogue.lose)];
    lines.push(`You earned ${awards.coins} coins!`);
    if (!cutscene) {
      if (awards.badge)
        lines.push(`You received the ${awards.badge.name ?? "area badge"}!`);
      if (awards.trophy)
        lines.push(
          "You earned the Champion Trophy! You have conquered this story!",
        );
    }
    setDialogue({
      char: node.char,
      lines,
      context: { location: area?.name },
      sceneStyle: { backgroundImage: "url(/story-atlas/pewter-gym.webp)" },
      onDone: () => {
        if (!cutscene) {
          setDialogue(null);
          return;
        }
        const extra = [];
        if (awards.badge)
          extra.push({
            name: node.char.name,
            image: node.char.image,
            text: `You received the ${awards.badge.name ?? "area badge"}!`,
          });
        if (awards.trophy)
          extra.push({
            name: node.char.name,
            image: node.char.image,
            text: "You earned the Champion Trophy! You have conquered this story!",
          });
        setDialogue({
          scene: [...cutscene, ...extra],
          onDone: () => setDialogue(null),
        });
      },
    });
  };

  let content = null;
  if (view === "select" || !story) {
    content = (
      <StorySelect
        profile={profile}
        onSelect={enterStory}
        onReset={(fresh) => setProfileState(fresh)}
        onBack={onExit}
      />
    );
  } else if (view === "shop") {
    content = (
      <ShopScreen
        story={story}
        profile={profile}
        setProfile={setProfile}
        onBack={() => setView("hub")}
        onEditor={() => setView("editor")}
      />
    );
  } else if (view === "editor") {
    content = (
      <div className="atlas-editor-page">
        <StoryHeader
          coins={profile.coins}
          onBack={() => setView("hub")}
          onJourney={() => setView("hub")}
          onEditor={() => {}}
          onShop={() => setView("shop")}
          active="decks"
          backLabel="Journey"
        />
        <DeckEditor
          onExit={() => setView("hub")}
          collection={profile.collection}
          format={storyFormat(story)}
          title={`${story.name} Decks`}
        />
      </div>
    );
  } else if (view === "battle" && battle) {
    content = (
      <MatchScreen
        key={battle.key}
        config={battle.config}
        onExit={exitBattle}
        exitLabel="Continue"
      />
    );
  } else {
    content = (
      <StoryScreen
        key={story.id}
        story={story}
        profile={profile}
        onChallenge={challenge}
        onShop={() => setView("shop")}
        onEditor={() => setView("editor")}
        onSetDeck={(deckId) =>
          setProfile((p) => setActiveDeck(p, story.id, deckId))
        }
        onBack={() => setView("select")}
        onSelectStory={enterStory}
        onBegin={() => setStarterOpen(true)}
      />
    );
  }

  return (
    <div className="story-atlas" data-story-view={view}>
      <div className="atlas-story-surface" inert={!!(starterOpen || dialogue)}>
        {content}
      </div>
      {starterOpen && (
        <StarterPick
          story={story}
          onPick={pickStarter}
          onBack={() => setStarterOpen(false)}
        />
      )}
      {dialogue && (
        <DialogueBox
          key={(dialogue.scene ?? dialogue.lines ?? [])
            .map((b) => b.text ?? b)
            .join("|")}
          name={dialogue.char?.name}
          image={dialogue.char?.image}
          lines={dialogue.lines}
          scene={dialogue.scene}
          doneLabel={dialogue.doneLabel}
          onDone={dialogue.onDone}
          onCancel={dialogue.onCancel}
          cancelLabel={dialogue.cancelLabel}
          context={dialogue.context}
          sceneStyle={dialogue.sceneStyle}
        />
      )}
    </div>
  );
}

import { useState, useCallback, useRef } from 'react'
import { MatchScreen } from '../MatchScreen.jsx'
import { DeckEditor } from '../DeckEditor.jsx'
import { StorySelect, StarterPick } from './StorySelect.jsx'
import { StoryScreen } from './StoryScreen.jsx'
import { ShopScreen } from './ShopScreen.jsx'
import { DialogueBox } from './DialogueBox.jsx'
import { storyFormat } from '../../data/stories.js'
import { BOSS_DECKS, generateTrainerDeck, countsToList } from '../../data/storyDecks.js'
import { saveDeck, newDeckId, deckToList } from '../../lib/deckStore.js'
import {
  loadProfile,
  saveProfile,
  storyState,
  chooseStarter,
  setActiveDeck,
  recordBattle,
} from '../../lib/profileStore.js'

// Expand a node's deck spec into the flat list initialMatchState consumes.
function nodeDeckList(node, story) {
  const spec = node.deck ?? {}
  if (spec.boss) return countsToList(BOSS_DECKS[spec.boss])
  const gen = spec.gen ?? { types: ['colorless'], tier: 1 }
  return countsToList(generateTrainerDeck(gen.types, gen.tier, node.id, storyFormat(story)))
}

// Story Mode root: routes between story select, starter pick, hub, shop, deck
// editor, and battles. Owns the profile (persisted on every change).
export function StoryMode({ onExit }) {
  const [profile, setProfileState] = useState(loadProfile)
  const setProfile = useCallback((next) => {
    setProfileState((prev) => saveProfile(typeof next === 'function' ? next(prev) : next))
  }, [])

  const [story, setStory] = useState(null)
  const [view, setView] = useState('select') // select | starter | hub | shop | editor | battle
  const [dialogue, setDialogue] = useState(null) // { char, lines, onDone }
  const [battle, setBattle] = useState(null) // { node, config, key }
  const outcome = useRef(null) // set by onResult, consumed on battle exit

  const enterStory = (s) => {
    setStory(s)
    setView(storyState(profile, s.id).starterDeckId ? 'hub' : 'starter')
  }

  const pickStarter = (starter) => {
    const deck = saveDeck({
      id: newDeckId(),
      name: starter.name,
      counts: { ...starter.counts },
      format: story.formatId,
    })
    setProfile((p) => chooseStarter(p, story, starter, deck.id))
    setDialogue({
      char: { name: 'Professor Oak', image: null },
      lines: [
        `${starter.name} — a fine choice!`,
        'The cards are yours, and I threw in some coins for the Shop.',
        'Now go challenge the trainers of ' + story.name + '. Good luck!',
      ],
      onDone: () => setDialogue(null),
    })
    setView('hub')
  }

  // Challenge flow: intro dialogue -> battle -> result recorded once ->
  // win/lose dialogue with rewards when the player leaves the match.
  const challenge = (node, deck) => {
    const config = {
      playerDeckList: deckToList(deck),
      playerDeckName: deck.name,
      aiDeckList: nodeDeckList(node, story),
      aiDeckName: `${node.char.name}'s deck`,
      aiId: node.aiId,
      opponent: node.char,
      onResult: (won) => {
        const { profile: next, awards } = recordBattle(loadProfile(), story, node, won)
        setProfile(next)
        outcome.current = { node, won, awards }
      },
    }
    setDialogue({
      char: node.char,
      lines: node.dialogue.intro,
      doneLabel: 'Battle!',
      onCancel: () => setDialogue(null), // player can back out of the fight
      onDone: () => {
        setDialogue(null)
        setBattle({ node, config, key: Date.now() })
        setView('battle')
      },
    })
  }

  const exitBattle = () => {
    setView('hub')
    setBattle(null)
    const res = outcome.current
    outcome.current = null
    if (!res) return // forfeited before the match ended — no rewards
    const { node, won, awards } = res
    const lines = [...(won ? node.dialogue.win : node.dialogue.lose)]
    lines.push(`You earned ${awards.coins} coins!`)
    if (awards.badge) lines.push(`You received the ${awards.badge.name ?? 'area badge'}!`)
    if (awards.trophy) lines.push('You earned the Champion Trophy! You have conquered this story! 🏆')
    setDialogue({ char: node.char, lines, onDone: () => setDialogue(null) })
  }

  let content = null
  if (view === 'select' || !story) {
    content = (
      <StorySelect
        profile={profile}
        onSelect={enterStory}
        onReset={(fresh) => setProfileState(fresh)}
        onBack={onExit}
      />
    )
  } else if (view === 'starter') {
    content = <StarterPick story={story} onPick={pickStarter} />
  } else if (view === 'shop') {
    content = <ShopScreen story={story} profile={profile} setProfile={setProfile} onBack={() => setView('hub')} />
  } else if (view === 'editor') {
    content = (
      <DeckEditor
        onExit={() => setView('hub')}
        collection={profile.collection}
        format={storyFormat(story)}
        title={`${story.name} Decks`}
      />
    )
  } else if (view === 'battle' && battle) {
    content = <MatchScreen key={battle.key} config={battle.config} onExit={exitBattle} exitLabel="Continue" />
  } else {
    content = (
      <StoryScreen
        story={story}
        profile={profile}
        onChallenge={challenge}
        onShop={() => setView('shop')}
        onEditor={() => setView('editor')}
        onSetDeck={(deckId) => setProfile((p) => setActiveDeck(p, story.id, deckId))}
        onBack={() => setView('select')}
      />
    )
  }

  return (
    <>
      {content}
      {dialogue && (
        <DialogueBox
          key={dialogue.lines.join('|')}
          name={dialogue.char.name}
          image={dialogue.char.image}
          lines={dialogue.lines}
          doneLabel={dialogue.doneLabel}
          onDone={dialogue.onDone}
          onCancel={dialogue.onCancel}
        />
      )}
    </>
  )
}

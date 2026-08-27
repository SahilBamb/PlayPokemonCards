import { useMemo } from 'react'
import { loadDecks, validateDeck } from '../../lib/deckStore.js'
import { storyFormat } from '../../data/stories.js'
import { storyState, areaUnlocked, nodeUnlocked, areaCompleted } from '../../lib/profileStore.js'
import { CoinPill } from './ShopScreen.jsx'

// One stop on an area's stepper. Trainers show their face; mystery nodes stay
// a ? and bosses a ! until beaten.
function NodeStop({ node, beaten, unlocked, onChallenge }) {
  const hidden = !beaten && node.kind !== 'trainer'
  const symbol = node.kind === 'boss' ? '!' : '?'
  return (
    <button
      data-testid={`node-${node.id}`}
      data-beaten={beaten ? '1' : '0'}
      disabled={!unlocked}
      onClick={onChallenge}
      title={hidden ? (node.kind === 'boss' ? 'A powerful foe awaits…' : 'Someone is waiting here…') : node.char.name}
      className={`relative z-10 flex flex-col items-center gap-1 group ${unlocked ? 'cursor-pointer' : 'cursor-not-allowed'}`}
    >
      <span
        className={`w-16 h-16 rounded-full border-4 flex items-center justify-center overflow-hidden bg-zinc-900 transition
          ${beaten ? 'border-green-500' : ''}
          ${!beaten && unlocked ? (node.kind === 'boss' ? 'border-poke-red group-hover:scale-110 shadow-[0_0_14px_rgba(227,53,13,0.5)]' : 'border-zinc-400 group-hover:scale-110 group-hover:border-white') : ''}
          ${!unlocked ? 'border-zinc-800 opacity-40' : ''}`}
      >
        {hidden ? (
          <span className={`text-3xl font-black ${node.kind === 'boss' ? 'text-poke-red' : 'text-zinc-300'}`}>{symbol}</span>
        ) : node.char.image ? (
          <img src={node.char.image} alt={node.char.name} className="w-full h-full object-cover object-top" draggable={false} />
        ) : (
          <span className="text-xl font-black text-zinc-300">{node.char.name[0]}</span>
        )}
      </span>
      {beaten && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 text-zinc-950 text-xs font-black flex items-center justify-center border-2 border-zinc-950">
          ✓
        </span>
      )}
      {!unlocked && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-zinc-600 text-zinc-200 flex items-center justify-center border-2 border-zinc-950">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5" aria-hidden="true">
            <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" />
          </svg>
        </span>
      )}
      <span className="text-[10px] font-semibold text-zinc-400 max-w-20 text-center leading-tight">
        {hidden ? '???' : node.char.name}
      </span>
    </button>
  )
}

function AreaStepper({ story, state, area, areaIdx, onChallenge }) {
  const unlocked = areaUnlocked(story, state, areaIdx)
  const done = areaCompleted(area, state)
  return (
    <div
      data-testid={`area-${area.id}`}
      className={`h-full bg-zinc-950/85 border rounded-sm p-4 flex flex-col ${unlocked ? 'border-zinc-700' : 'border-zinc-800 opacity-50'}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-white">{area.name}</h3>
        {area.badge?.image && (
          <img
            src={area.badge.image}
            alt={area.badge.name ?? ''}
            title={area.badge.name}
            className={`w-6 h-6 object-contain ${done ? 'drop-shadow-[0_0_6px_rgba(250,204,21,0.8)]' : 'grayscale opacity-30'}`}
            draggable={false}
          />
        )}
        {done && <span className="text-xs font-bold text-green-400 uppercase tracking-wide">Cleared</span>}
        {!unlocked && <span className="text-xs font-semibold text-zinc-500 ml-auto">Complete the previous area to unlock</span>}
      </div>
      {/* Equal-width columns; each connector spans from the previous circle's
          center to this one's (the circles render above it via z-10). */}
      <div className="flex overflow-x-auto pb-1 pt-2 grow items-start">
        {area.nodes.map((node, i) => (
          <div key={node.id} className="relative flex-1 min-w-20 flex flex-col items-center">
            {i > 0 && (
              <span
                className={`absolute right-1/2 w-full h-1 top-8 -translate-y-1/2
                  ${state.beaten.includes(area.nodes[i - 1].id) ? 'bg-green-500' : 'bg-zinc-700'}`}
              />
            )}
            <NodeStop
              node={node}
              beaten={state.beaten.includes(node.id)}
              unlocked={unlocked && nodeUnlocked(story, state, areaIdx, i)}
              onChallenge={() => onChallenge(node)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// Trophy + badges earned so far.
function BadgeCase({ story, state }) {
  return (
    <div className="flex items-center gap-1.5" data-testid="badge-case" title={`${state.badges.length} badges`}>
      {story.areas
        .filter((a) => a.badge)
        .map((a) => {
          const earned = state.badges.some((b) => b.areaId === a.id)
          return (
            <img
              key={a.id}
              src={a.badge.image}
              alt={a.badge.name ?? a.name}
              title={`${a.badge.name ?? a.name}${earned ? '' : ' — not yet earned'}`}
              className={`w-5 h-5 object-contain ${earned ? '' : 'grayscale opacity-25'}`}
              draggable={false}
            />
          )
        })}
      <span className={`text-lg leading-none ${state.trophy ? '' : 'grayscale opacity-25'}`} title={state.trophy ? story.trophy?.name : 'Defeat the final area for the trophy'}>
        🏆
      </span>
    </div>
  )
}

// The story hub: coins, badge case, deck picker, shop/editor links, and one
// stepper per area.
export function StoryScreen({ story, profile, onChallenge, onShop, onEditor, onSetDeck, onBack }) {
  const state = storyState(profile, story.id)
  const format = storyFormat(story)
  const decks = useMemo(
    () => loadDecks().filter((d) => (d.format ?? 'classic') === format.id),
    // reload whenever the profile changes (deck edits route through here)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, format.id]
  )
  const activeDeck = decks.find((d) => d.id === state.activeDeckId) ?? decks[0]
  const deckProblems = activeDeck ? validateDeck(activeDeck.counts, profile.collection, format) : ['No deck selected.']
  const battleReady = deckProblems.length === 0
  const collectionSize = Object.values(profile.collection).reduce((a, b) => a + b, 0)

  const challenge = (node) => {
    if (!battleReady || !activeDeck) return
    onChallenge(node, activeDeck)
  }

  return (
    <div className="w-full h-screen flex flex-col items-center text-white p-4 overflow-y-auto">
      <div className="w-full max-w-7xl flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={onBack} className="px-3 py-1 rounded-sm bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-xs font-semibold">
          ← Stories
        </button>
        <h1 className="text-xl font-black uppercase tracking-widest flex items-center gap-2">
          <img src="/pokeball.svg" alt="" className="w-5 h-5" draggable={false} />
          {story.name}
        </h1>
        <BadgeCase story={story} state={state} />
        <div className="ml-auto flex items-center gap-2">
          <CoinPill coins={profile.coins} />
          <button
            onClick={onShop}
            data-testid="to-shop"
            className="px-3 py-1 rounded-sm bg-poke-red hover:bg-[#f4460f] border-b-2 border-poke-red-dark text-xs font-bold uppercase tracking-wide"
          >
            Shop
          </button>
          <button
            onClick={onEditor}
            data-testid="to-editor"
            className="px-3 py-1 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-xs font-semibold"
          >
            Deck Editor
          </button>
        </div>
      </div>

      <div className="w-full max-w-7xl flex items-center gap-3 mb-4 bg-zinc-950/85 border border-zinc-800 rounded-sm px-3 py-2 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Battle deck:</span>
        <select
          data-testid="deck-select"
          value={activeDeck?.id ?? ''}
          onChange={(e) => onSetDeck(e.target.value)}
          className="px-2 py-1 rounded-sm bg-zinc-800 border border-zinc-600 text-xs outline-none min-w-40"
        >
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name || '(unnamed)'}
            </option>
          ))}
          {decks.length === 0 && <option value="">— no decks —</option>}
        </select>
        {battleReady ? (
          <span className="text-xs font-semibold text-green-400">✓ Ready to battle</span>
        ) : (
          <span className="text-xs font-semibold text-amber-400" title={deckProblems.join(' ')}>
            ⚠ {deckProblems[0]} Fix it in the Deck Editor.
          </span>
        )}
        <span className="ml-auto text-xs text-zinc-500 font-semibold">
          Collection: {collectionSize} cards · {Object.keys(profile.collection).length} unique
        </span>
      </div>

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-4 pb-8">
        {story.areas.map((area, i) => (
          <div key={area.id} className={i === story.areas.length - 1 ? 'lg:col-span-2' : 'h-full'}>
            <AreaStepper story={story} state={state} area={area} areaIdx={i} onChallenge={challenge} />
          </div>
        ))}
      </div>
    </div>
  )
}

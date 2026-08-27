import { STORIES } from '../../data/stories.js'
import { storyState, resetProfile } from '../../lib/profileStore.js'
import { byName } from '../../engine/cards.js'

// Pick which Story to enter. Collection and coins are shared across stories;
// each story only changes which era of cards is legal.
export function StorySelect({ profile, onSelect, onReset, onBack }) {
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center gap-8 text-white p-4">
      <div className="flex flex-col items-center gap-3">
        <img src="/pokeball.svg" alt="" className="w-14 h-14 drop-shadow-[0_0_24px_rgba(227,53,13,0.45)]" draggable={false} />
        <h1 className="text-3xl font-black tracking-tight">Story Mode</h1>
        <p className="text-zinc-400 text-sm font-medium">Battle trainers, earn badges, and build your collection.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {Object.values(STORIES).map((story) => {
          const state = storyState(profile, story.id)
          const started = !!state.starterDeckId
          return (
            <button
              key={story.id}
              data-testid={`story-${story.id}`}
              onClick={() => onSelect(story)}
              className="flex flex-col items-center gap-3 rounded-sm border-2 border-zinc-700 hover:border-poke-red bg-zinc-900 p-6 w-72 transition hover:scale-105 text-left"
            >
              {story.cover && <img src={story.cover} alt="" className="w-12 h-12 object-contain" draggable={false} />}
              <span className="text-xl font-black uppercase tracking-wide">{story.name}</span>
              <span className="text-xs text-zinc-400 text-center leading-relaxed">{story.description}</span>
              <span className="text-xs font-bold text-zinc-300">
                {started ? `${state.badges.length} badges · ${state.beaten.length} battles won` : 'New adventure'}
                {state.trophy ? ' · 🏆' : ''}
              </span>
              <span className="px-4 py-1.5 rounded-sm bg-poke-red border-b-2 border-poke-red-dark text-white text-xs font-bold uppercase tracking-wide">
                {started ? 'Continue' : 'Begin'}
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className="px-5 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 font-semibold text-sm">
          ← Main Menu
        </button>
        <button
          onClick={() => {
            if (window.confirm('Reset your story profile? Collection, coins, decks progress, and badges will be lost.')) {
              onReset(resetProfile())
            }
          }}
          className="px-5 py-2 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-red-400 font-semibold text-sm"
        >
          Reset Profile
        </button>
      </div>
    </div>
  )
}

// First entry into a story: choose one of its starter decks.
export function StarterPick({ story, onPick }) {
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center gap-8 text-white p-4">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-black uppercase tracking-widest">Choose your starter deck</h1>
        <p className="text-zinc-400 text-sm font-medium max-w-md text-center">
          These cards join your collection. Earn coins in battle and visit the Shop to grow it — the good stuff is in booster packs.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {story.starterDecks.map((starter) => (
          <button
            key={starter.id}
            data-testid={`starter-${starter.id}`}
            onClick={() => onPick(starter)}
            className="flex flex-col items-center gap-2 rounded-sm border-2 border-zinc-700 hover:border-poke-red bg-zinc-900 p-4 w-56 transition hover:scale-105"
          >
            <StarterCovers names={starter.coverCards} />
            <span className="font-bold text-sm">{starter.name}</span>
            <span className="text-xs text-zinc-400 text-center">{starter.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function StarterCovers({ names }) {
  return (
    <div className="flex -space-x-6">
      {names.map((name) => {
        const card = byName[name]
        return card?.image ? (
          <img
            key={name}
            src={card.image}
            alt={name}
            className="w-16 aspect-[245/342] rounded-sm shadow bg-zinc-800/60"
            draggable={false}
          />
        ) : (
          <span key={name}>{name}</span>
        )
      })}
    </div>
  )
}

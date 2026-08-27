// Plays every story node deck (hand-authored bosses + generated trainers)
// to completion in an AI-vs-AI match against one of that story's starters.
// Run: node scripts/smoke_story_decks.mjs [storyFilter]
import { reducer, initialMatchState } from '../src/engine/reducer.js'
import { enumerateActions } from '../src/engine/actions.js'
import { AI_POLICIES, aiNeedsToAct } from '../src/ai/index.js'
import { STORIES, storyFormat } from '../src/data/stories.js'
import { BOSS_DECKS, generateTrainerDeck, countsToList } from '../src/data/storyDecks.js'

const storyFilter = process.argv[2] ?? null

function runAiGame(p1DeckList, p2DeckList, maxSteps = 12000) {
  const policy = AI_POLICIES.basic
  let s = initialMatchState({ p1DeckList, p1DeckName: 'A', p2DeckList, p2DeckName: 'B' })
  let steps = 0
  let stuck = 0
  while (s.phase !== 'gameover' && steps++ < maxSteps) {
    const p = ['p1', 'p2'].find((x) => aiNeedsToAct(s, x))
    if (!p) throw new Error(`nobody can act (phase=${s.phase}, pending=${JSON.stringify(s.pending)})`)
    const actions = enumerateActions(s, p)
    if (!actions.length) throw new Error(`no legal actions for ${p} (pending=${JSON.stringify(s.pending)})`)
    const action = policy.pickAction(actions, s, p) ?? actions[0]
    const next = reducer(s, action)
    if (next === s) {
      if (++stuck > 5) throw new Error(`stuck: ${JSON.stringify(action)} rejected repeatedly`)
      s = reducer(s, actions.find((a) => a.type === 'end-turn') ?? actions[0])
    } else {
      stuck = 0
      s = next
    }
  }
  if (s.phase !== 'gameover') throw new Error(`did not finish in ${maxSteps} steps (turn ${s.turnNumber})`)
  return s
}

let failures = 0
let count = 0
for (const story of Object.values(STORIES)) {
  if (storyFilter && story.id !== storyFilter) continue
  const starter = countsToList(story.starterDecks[0].counts)
  for (const area of story.areas) {
    for (const node of area.nodes) {
      const counts = node.deck.boss
        ? BOSS_DECKS[node.deck.boss]
        : generateTrainerDeck(node.deck.gen.types, node.deck.gen.tier, node.id, storyFormat(story))
      count++
      try {
        const s = runAiGame(starter, countsToList(counts))
        console.log(`  ok ${story.id}/${node.id.padEnd(14)} winner=${s.winner} turn=${s.turnNumber} (${s.winReason})`)
      } catch (e) {
        failures++
        console.error(`FAIL ${story.id}/${node.id}: ${e.message}`)
      }
    }
  }
}
console.log(failures ? `\n${failures} node deck(s) failed` : `\nall ${count} node decks played to completion`)
process.exit(failures ? 1 : 0)

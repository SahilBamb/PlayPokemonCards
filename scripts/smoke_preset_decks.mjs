// Plays every preset deck to completion in an AI-vs-AI match.
// Run: node scripts/smoke_preset_decks.mjs [groupFilter]
import { reducer, initialMatchState } from '../src/engine/reducer.js'
import { enumerateActions } from '../src/engine/actions.js'
import { AI_POLICIES, aiNeedsToAct } from '../src/ai/index.js'
import { PRESET_DECK_DEFS } from '../src/data/presetDecks.js'

const groupFilter = process.argv[2] ?? null

function runAiGame(p1DeckId, p2DeckId, maxSteps = 12000) {
  const policy = AI_POLICIES.basic
  let s = initialMatchState({ p1DeckId, p2DeckId })
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
const decks = PRESET_DECK_DEFS.filter((d) => !groupFilter || (d.group ?? 'basefossil') === groupFilter)
for (const deck of decks) {
  try {
    const s = runAiGame(deck.id, 'haymakerBF')
    console.log(`  ok ${deck.id.padEnd(22)} winner=${s.winner} turn=${s.turnNumber} (${s.winReason})`)
  } catch (e) {
    failures++
    console.error(`FAIL ${deck.id}: ${e.message}`)
  }
}
console.log(failures ? `\n${failures} deck(s) failed` : `\nall ${decks.length} decks played to completion`)
process.exit(failures ? 1 : 0)

// AI-vs-AI matches with random decks sampled from Team Rocket / Gym Heroes /
// Gym Challenge, exercising the full turn loop with the new cards.
// Run: node scripts/fuzz_new_sets_match.mjs [games]
import { reducer } from '../src/engine/reducer.js'
import { initialMatchState } from '../src/engine/match.js'
import { enumerateActions } from '../src/engine/actions.js'
import { AI_POLICIES, aiNeedsToAct } from '../src/ai/index.js'
import CARDS from '../src/data/cardStats.js'

const SETS = ['rocket', 'gym1', 'gym2']
const ENERGY = { grass: 'Grass Energy', fire: 'Fire Energy', water: 'Water Energy', lightning: 'Lightning Energy', psychic: 'Psychic Energy', fighting: 'Fighting Energy' }
const pool = CARDS.filter((c) => SETS.includes(c.set) && c.supertype !== 'energy')
const basics = pool.filter((c) => c.supertype === 'pokemon' && c.stage === 'basic')

function randomDeck() {
  const list = []
  // guarantee playable basics, then random pokemon/trainers, then energy to 60
  for (let i = 0; i < 10; i++) list.push(basics[Math.floor(Math.random() * basics.length)].name)
  for (let i = 0; i < 26; i++) list.push(pool[Math.floor(Math.random() * pool.length)].name)
  const types = [...new Set(list.map((n) => CARDS.find((c) => c.name === n)).filter((c) => c?.supertype === 'pokemon').map((c) => c.type))]
  while (list.length < 60) {
    const t = types[Math.floor(Math.random() * types.length)]
    list.push(ENERGY[t] ?? 'Double Colorless Energy')
  }
  return list
}

const games = Number(process.argv[2] ?? 5)
let failed = 0
for (let g = 0; g < games; g++) {
  try {
    const policy = AI_POLICIES[['basic', 'aggro', 'stall', 'random'][g % 4]]
    let s = initialMatchState({ p1DeckList: randomDeck(), p2DeckList: randomDeck(), p1DeckName: 'Fuzz A', p2DeckName: 'Fuzz B' })
    let steps = 0
    let stuck = 0
    while (s.phase !== 'gameover' && steps++ < 8000) {
      const p = ['p1', 'p2'].find((x) => aiNeedsToAct(s, x))
      if (!p) throw new Error(`nobody can act (pending=${JSON.stringify(s.pending)})`)
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
    if (s.phase !== 'gameover') throw new Error(`game ${g} did not finish (turn ${s.turnNumber})`)
    console.log(`ok game ${g + 1}: ${s.winner} wins by ${s.winReason} (turn ${s.turnNumber})`)
  } catch (e) {
    failed++
    console.error(`FAIL game ${g + 1}:`, e.message)
  }
}
console.log(failed ? `${failed}/${games} games failed` : `all ${games} games completed`)
process.exit(failed ? 1 : 0)

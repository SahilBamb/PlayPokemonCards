// Executes every attack, power, and trainer from the Team Rocket / Gym Heroes /
// Gym Challenge sets once per coin bias, auto-resolving all choices, to catch
// runtime crashes and stuck states. Run: node scripts/fuzz_new_sets.mjs
import { reducer, initialGameState } from '../src/engine/reducer.js'
import { makeCard, makeSlot } from '../src/engine/cards.js'
import { enumerateActions } from '../src/engine/actions.js'
import CARDS from '../src/data/cardStats.js'

const SETS = ['rocket', 'gym1', 'gym2']
const realRandom = Math.random
let failures = 0

function place(state, player, id, cardName, energy = []) {
  const slot = makeSlot(makeCard(cardName))
  slot.energyAttached = energy.map((e) => {
    const c = makeCard(e)
    return { uid: c.uid, name: c.name, energy: c.energy, units: c.units ?? 1 }
  })
  const mon = [...state[player].mon]
  mon[id] = slot
  return { ...state, [player]: { ...state[player], mon } }
}

const ENERGY_NAME = {
  grass: 'Grass Energy', fire: 'Fire Energy', water: 'Water Energy',
  lightning: 'Lightning Energy', psychic: 'Psychic Energy', fighting: 'Fighting Energy',
}

function energyFor(card, atk) {
  const list = []
  let primary = null
  for (const [t, n] of Object.entries(atk.cost ?? {})) {
    if (t === 'colorless') continue
    primary = primary ?? t
    for (let i = 0; i < n; i++) list.push(ENERGY_NAME[t])
  }
  const filler = ENERGY_NAME[primary] ?? ENERGY_NAME[card.type] ?? 'Fighting Energy'
  const colorless = atk.cost?.colorless ?? 0
  for (let i = 0; i < colorless; i++) list.push(filler)
  // headroom for discard-extra / perExtraEnergy attacks
  list.push(filler, filler, filler)
  return list
}

// Base board: energy and cards scattered everywhere so searches, discards and
// bench snipes all have material to work with.
function baseState() {
  let s = initialGameState()
  s = place(s, 'p1', 1, 'Machop', ['Fighting Energy'])
  s = place(s, 'p1', 2, 'Rattata')
  s = place(s, 'p2', 0, 'Onix', ['Fighting Energy'])
  s = place(s, 'p2', 1, 'Chansey', ['Double Colorless Energy'])
  s = place(s, 'p2', 2, 'Rattata')
  const junk = () => [makeCard('Potion'), makeCard('Bill'), makeCard('Fire Energy'), makeCard('Fire Energy'), makeCard('Machop')]
  s = { ...s, p1: { ...s.p1, discard: junk(), prizes: [makeCard('Switch')] } }
  s = { ...s, p2: { ...s.p2, discard: junk(), prizes: [makeCard('Switch')] } }
  return s
}

function drain(state, label) {
  for (let i = 0; i < 300; i++) {
    if (!state.pending) return state
    const player = state.pending.chooserPlayer ?? 'p1'
    const actions = enumerateActions(state, player)
    if (!actions.length) throw new Error(`${label}: stuck on pending "${state.pending.prompt ?? state.pending.what}" with no actions`)
    const a = actions[Math.floor(Math.random() * actions.length)]
    const next = reducer(state, a)
    if (next === state && actions.length === 1) throw new Error(`${label}: pending did not advance`)
    state = next
  }
  throw new Error(`${label}: choice loop did not terminate`)
}

function run(label, fn) {
  for (const [bias, rnd] of [['heads', () => 0.9], ['tails', () => 0.1], ['mixed', realRandom]]) {
    Math.random = () => rnd() // choice picks inside drain use the same bias; fine
    try {
      fn(`${label} [${bias}]`)
    } catch (e) {
      failures++
      console.error(`FAIL ${label} [${bias}]:`, e.message)
    } finally {
      Math.random = realRandom
    }
  }
}

const cards = CARDS.filter((c) => SETS.includes(c.set))
let attacks = 0, powers = 0, trainers = 0

for (const card of cards) {
  if (card.supertype === 'trainer') {
    trainers++
    run(`T ${card.name}`, (label) => {
      let s = baseState()
      const tr = makeCard(card.name)
      const extras = [makeCard('Potion'), makeCard('Bill'), makeCard('Fire Energy'), makeCard('Fire Energy'), makeCard('Machop')]
      s = { ...s, p1: { ...s.p1, hand: [tr, ...extras] } }
      s = reducer(s, { type: 'play-trainer', player: 'p1', uid: tr.uid })
      s = drain(s, label)
      if (s.effectsQueue.length) throw new Error(`${label}: effectsQueue not drained`)
    })
    continue
  }
  if (card.supertype !== 'pokemon') continue
  if (card.power) {
    powers++
    run(`P ${card.name}::${card.power.name}`, (label) => {
      let s = baseState()
      s = place(s, 'p1', 0, card.name, ['Grass Energy', 'Fire Energy', 'Lightning Energy', 'Psychic Energy'])
      // seed a matching evolution/search target in deck+hand for evolve powers
      s = { ...s, p1: { ...s.p1, hand: [makeCard('Machoke'), makeCard('Potion')] } }
      s = reducer(s, { type: 'use-power', player: 'p1', id: 0 })
      s = drain(s, label)
      if (s.effectsQueue.length) throw new Error(`${label}: effectsQueue not drained`)
    })
  }
  for (const atk of card.attacks ?? []) {
    attacks++
    run(`A ${card.name}:${atk.name}`, (label) => {
      let s = baseState()
      s = place(s, 'p1', 0, card.name, energyFor(card, atk))
      s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: atk.name })
      s = drain(s, label)
      if (s.effectsQueue.length) throw new Error(`${label}: effectsQueue not drained`)
    })
  }
}

console.log(`\nfuzzed ${attacks} attacks, ${powers} powers, ${trainers} trainers x3 biases`)
if (failures) {
  console.error(`${failures} failures`)
  process.exit(1)
} else {
  console.log('all clean')
}

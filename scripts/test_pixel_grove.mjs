import test from 'node:test'
import assert from 'node:assert/strict'
import { creature, groveReducer, hpLeft, initialGroveState, POKEMON } from '../src/pixel-grove/game.js'

test('the demo contains only the six requested Pokémon', () => {
  assert.deepEqual(Object.keys(POKEMON).sort(), ['electrode', 'jigglypuff', 'koffing', 'pikachu', 'voltorb', 'weezing'])
  const state = initialGroveState()
  assert.equal(state.player.active.status, 'asleep')
  assert.equal(state.player.active.energy, 2)
  assert.equal(state.player.prizes, 3)
})

test('Energy is consumed from hand and attaches only once per turn', () => {
  let state = initialGroveState()
  state = groveReducer(state, { type: 'play-card', index: 0, target: 'p-pikachu' })
  assert.equal(state.player.active.energy, 3)
  assert.equal(state.player.hand.length, 4)
  assert.equal(state.attached, true)
  const twice = groveReducer(state, { type: 'play-card', index: 3, target: 'p-voltorb' })
  assert.equal(twice.player.bench[0].energy, 1)
  assert.equal(twice.player.hand.length, 4)
})

test('evolution preserves damage and Energy but clears special conditions', () => {
  const state = initialGroveState()
  state.player.bench[0].damage = 20
  state.player.bench[0].status = 'poisoned'
  const next = groveReducer(state, { type: 'play-card', index: 1, target: 'p-voltorb' })
  const evolved = next.player.bench[0]
  assert.equal(evolved.species, 'electrode')
  assert.equal(evolved.damage, 20)
  assert.equal(hpLeft(evolved), 70)
  assert.equal(evolved.energy, 1)
  assert.equal(evolved.status, null)
  assert.equal(next.player.hand.length, 4)
  assert.equal(state.player.bench[0].species, 'voltorb', 'the original state is immutable')
})

test('invalid evolution leaves the card in hand', () => {
  const state = initialGroveState()
  const next = groveReducer(state, { type: 'play-card', index: 1, target: 'p-pikachu' })
  assert.deepEqual(next.player.hand, state.player.hand)
  assert.match(next.notice, /Voltorb/)
})

test('basic Pokémon require an empty legal bench patch', () => {
  const state = initialGroveState()
  const invalid = groveReducer(state, { type: 'play-card', index: 2, bench: 0 })
  assert.equal(invalid.player.hand.length, 5)
  const valid = groveReducer(state, { type: 'play-card', index: 2, bench: 1 })
  assert.equal(valid.player.bench[1].species, 'voltorb')
  assert.equal(valid.player.hand.length, 4)
  assert.equal(groveReducer(state, { type: 'play-card', index: 2, bench: 7 }).player.hand.length, 5)
})

test('Pikachu changes from sleeping to awake on heads, not tails', () => {
  let state = initialGroveState()
  const blocked = groveReducer(state, { type: 'attack', index: 0 })
  assert.equal(blocked.opponent.active.damage, 0)
  const tails = groveReducer(state, { type: 'wake', roll: 0.1 })
  assert.equal(tails.player.active.status, 'asleep')
  assert.equal(tails.sleepChecked, true)
  assert.equal(groveReducer(tails, { type: 'wake', roll: 0.9 }).player.active.status, 'asleep')
  state = groveReducer(state, { type: 'wake', roll: 0.9 })
  assert.equal(state.player.active.status, null)
  assert.equal(state.coin, 'heads')
})

test('attacks check Energy, deal damage, discard Energy, and end the turn', () => {
  let state = initialGroveState()
  state.player.active.status = null
  const blocked = groveReducer(state, { type: 'attack', index: 1 })
  assert.equal(blocked.opponent.active.damage, 0)
  state.player.active.energy = 3
  state.opponent.active.damage = 0
  state.opponent.active.species = 'weezing'
  state = groveReducer(state, { type: 'attack', index: 1, rolls: [0, 0] })
  assert.equal(state.opponent.active.damage, 70)
  assert.equal(state.player.active.energy, 2)
  assert.equal(state.phase, 'opponent')
  assert.equal(groveReducer(state, { type: 'attack', index: 0 }).opponent.active.damage, 70)
})

test('knockouts take prizes and promote the next benched Pokémon', () => {
  let state = initialGroveState()
  state.player.active.status = null
  state.player.active.energy = 3
  state = groveReducer(state, { type: 'attack', index: 1, rolls: [0, 0] })
  assert.equal(state.player.prizes, 2)
  assert.equal(state.opponent.active.species, 'weezing')
  assert.equal(state.opponent.bench[0], null)
  assert.equal(state.opponent.discard, 1)
})

test('the opponent attacks, evolves Koffing, and returns control with a drawn card', () => {
  let state = initialGroveState()
  state.turn = 2
  state.phase = 'opponent'
  state.player.active.status = null
  state = groveReducer(state, { type: 'opponent-turn', rolls: [0, 0] })
  assert.equal(state.phase, 'player')
  assert.equal(state.turn, 3)
  assert.equal(state.player.active.damage, 20)
  assert.equal(state.opponent.bench[1].species, 'weezing')
  assert.equal(state.player.hand.length, 6)
  assert.equal(state.player.deck.length, 9)
  assert.equal(state.attached, false)
})

test('Jigglypuff can put the awake Pikachu back to sleep', () => {
  let state = initialGroveState()
  state.phase = 'opponent'
  state.turn = 3
  state.player.active.status = null
  state = groveReducer(state, { type: 'opponent-turn', rolls: [0, 0] })
  assert.equal(state.player.active.status, 'asleep')
})

test('retreat pays Energy and swaps the bench; sleeping Pokémon cannot retreat', () => {
  let state = initialGroveState()
  assert.equal(groveReducer(state, { type: 'retreat', target: 'p-voltorb' }).player.active.species, 'pikachu')
  state.player.active.status = null
  state = groveReducer(state, { type: 'retreat', target: 'p-voltorb' })
  assert.equal(state.player.active.species, 'voltorb')
  assert.equal(state.player.bench[0].species, 'pikachu')
  assert.equal(state.player.bench[0].energy, 1)
  assert.equal(state.retreated, true)
})

test('Potion heals at most 30 and cannot be wasted on undamaged Pokémon', () => {
  const state = initialGroveState()
  assert.equal(groveReducer(state, { type: 'play-card', index: 3, target: 'p-pikachu' }).player.hand.length, 5)
  state.player.active.damage = 40
  const next = groveReducer(state, { type: 'play-card', index: 3, target: 'p-pikachu' })
  assert.equal(next.player.active.damage, 10)
  assert.equal(next.player.hand.length, 4)
})

test('poison resolves between turns and can end the game', () => {
  let state = initialGroveState()
  state.player.active = creature('voltorb', 'last-voltorb', 1, { damage: 40, status: 'poisoned' })
  state.player.bench = [null, null, null]
  state = groveReducer(state, { type: 'end-turn', rolls: [0, 0] })
  assert.equal(state.phase, 'over')
  assert.equal(state.winner, 'opponent')
})

test('taking the last prize wins; restart restores a clean battle', () => {
  let state = initialGroveState()
  state.player.prizes = 1
  state.player.active.status = null
  state.opponent.active.damage = 60
  state = groveReducer(state, { type: 'attack', index: 0, rolls: [0, 0] })
  assert.equal(state.phase, 'over')
  assert.equal(state.winner, 'player')
  assert.equal(groveReducer(state, { type: 'attack', index: 0 }), state)
  assert.deepEqual(groveReducer(state, { type: 'reset' }), initialGroveState())
})

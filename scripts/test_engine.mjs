// Headless smoke tests for the effect engine. Run: node scripts/test_engine.mjs
import assert from 'assert'
import { reducer, initialGameState } from '../src/engine/reducer.js'
import { makeCard, makeSlot, DECKS } from '../src/engine/cards.js'
import { initialMatchState } from '../src/engine/match.js'
import { validateDeck, deckToList } from '../src/lib/deckStore.js'
import { combatView, retreatCostOf } from '../src/engine/powers.js'

let passed = 0
function test(name, fn) {
  try {
    fn()
    passed++
    console.log('  ok', name)
  } catch (e) {
    console.error('FAIL', name)
    console.error(' ', e.message)
    process.exitCode = 1
  }
}

const HEADS = () => 0.9
const TAILS = () => 0.1
const realRandom = Math.random

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

function fresh() {
  return initialGameState()
}

const active = (s, p) => s[p].mon[0]

// --- basic damage + weakness + KO ---
test('flat damage with weakness and KO to discard', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy']) // Low Kick 20
  s = place(s, 'p2', 0, 'Chansey') // 120 HP, weakness fighting
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(active(s, 'p2').dc, 40, 'weakness doubles 20 to 40')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(active(s, 'p2'), null, 'Chansey knocked out at 120')
  assert.ok(s.p2.discard.some((c) => c.name === 'Chansey'), 'Chansey in discard')
})

test('resistance reduces by 30', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Gastly') // resistance fighting
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(active(s, 'p2').dc ?? 0, 0, '20 - 30 resistance = 0')
})

test('not enough energy blocks attack', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Machop')
  s = place(s, 'p2', 0, 'Rattata')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(active(s, 'p2').dc ?? 0, 0)
})

// --- coin flip effects ---
test('Fury Attack heads scaling', () => {
  Math.random = HEADS
  let s = fresh()
  s = place(s, 'p1', 0, 'Doduo', ['Double Colorless Energy'])
  s = place(s, 'p2', 0, 'Onix')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Fury Attack' })
  Math.random = realRandom
  assert.equal(active(s, 'p2').dc, 20, '2 heads x 10')
})

test('paralysis on heads (Bubble) and clears at end of owner turn', () => {
  Math.random = HEADS
  let s = fresh()
  s = place(s, 'p1', 0, 'Squirtle', ['Water Energy'])
  s = place(s, 'p2', 0, 'Onix')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Bubble' })
  assert.equal(active(s, 'p2').status, 'paralyzed')
  s = reducer(s, { type: 'end-turn' }) // p1 ends; p2's paralysis not cleared yet
  assert.equal(active(s, 'p2').status, 'paralyzed')
  s = reducer(s, { type: 'end-turn' }) // p2 ends; clears
  Math.random = realRandom
  assert.equal(active(s, 'p2').status, null)
})

test('Thunder self damage on tails', () => {
  Math.random = TAILS
  let s = fresh()
  s = place(s, 'p1', 0, 'Zapdos', ['Lightning Energy', 'Lightning Energy', 'Lightning Energy', 'Lightning Energy'])
  s = place(s, 'p2', 0, 'Onix')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Thunder' })
  Math.random = realRandom
  assert.equal(active(s, 'p2').dc, 60)
  assert.equal(active(s, 'p1').dc, 30, 'Zapdos hurt itself')
})

// --- statuses over turns ---
test('Toxic poisons for 20 per turn', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Nidoking', ['Grass Energy', 'Grass Energy', 'Grass Energy'])
  s = place(s, 'p2', 0, 'Onix')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Toxic' })
  assert.equal(active(s, 'p2').poisoned, true)
  const before = active(s, 'p2').dc
  Math.random = TAILS
  s = reducer(s, { type: 'end-turn' })
  Math.random = realRandom
  assert.equal(active(s, 'p2').dc, before + 20, 'poison ticks 20')
})

test('sleep wakes on heads between turns', () => {
  Math.random = HEADS
  let s = fresh()
  s = place(s, 'p1', 0, 'Haunter', ['Psychic Energy'])
  s = place(s, 'p2', 0, 'Onix')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Hypnosis' })
  assert.equal(active(s, 'p2').status, 'asleep')
  s = reducer(s, { type: 'end-turn' })
  Math.random = realRandom
  assert.equal(active(s, 'p2').status, null, 'woke up')
})

test('Dream Eater requires sleeping defender', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Haunter', ['Psychic Energy', 'Psychic Energy'])
  s = place(s, 'p2', 0, 'Onix')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Dream Eater' })
  assert.equal(active(s, 'p2').dc ?? 0, 0, 'blocked while awake')
  s = { ...s, p2: { ...s.p2, mon: s.p2.mon.map((m, i) => (i === 0 ? { ...m, status: 'asleep' } : m)) } }
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Dream Eater' })
  assert.equal(active(s, 'p2').dc, 50)
})

// --- guards ---
test('Withdraw guard prevents damage and expires', () => {
  Math.random = HEADS
  let s = fresh()
  s = place(s, 'p1', 0, 'Squirtle', ['Water Energy', 'Fire Energy'])
  s = place(s, 'p2', 0, 'Machop', ['Fighting Energy'])
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Withdraw' })
  assert.ok(active(s, 'p1').guard)
  s = reducer(s, { type: 'end-turn' })
  s = reducer(s, { type: 'attack', player: 'p2', id: 0, attackName: 'Low Kick' })
  assert.equal(active(s, 'p1').dc ?? 0, 0, 'guarded')
  s = reducer(s, { type: 'end-turn' }) // p2's turn ends -> guard expires
  assert.equal(active(s, 'p1').guard, null)
  Math.random = realRandom
})

test('Harden threshold guard blocks <=30 only', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Onix', ['Fighting Energy', 'Fighting Energy'])
  s = place(s, 'p2', 0, 'Hitmonchan', ['Fighting Energy', 'Fighting Energy', 'Fighting Energy'])
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Harden' })
  s = reducer(s, { type: 'end-turn' })
  s = reducer(s, { type: 'attack', player: 'p2', id: 0, attackName: 'Jab' }) // 20 <= 30 blocked
  assert.equal(active(s, 'p1').dc ?? 0, 0)
  s = reducer(s, { type: 'attack', player: 'p2', id: 0, attackName: 'Special Punch' }) // 40 > 30
  assert.equal(active(s, 'p1').dc, 40)
})

// --- energy discards ---
test('Ember cost discard via choose', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Charmander', ['Fire Energy', 'Fire Energy'])
  s = place(s, 'p2', 0, 'Onix')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Ember' })
  assert.ok(s.pending, 'waiting for energy choice')
  const uid = active(s, 'p1').energyAttached[0].uid
  s = reducer(s, { type: 'resolve-choice', payload: { uids: [uid] } })
  assert.equal(active(s, 'p1').energyAttached.length, 1, 'one energy discarded')
  assert.equal(active(s, 'p2').dc, 30)
  assert.ok(s.p1.discard.some((c) => c.name === 'Fire Energy'))
})

test('Thunderbolt discards all energy', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Zapdos', ['Lightning Energy', 'Lightning Energy', 'Lightning Energy', 'Lightning Energy'])
  s = place(s, 'p2', 0, 'Chansey') // 120 HP survives 100
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Thunderbolt' })
  assert.equal(active(s, 'p1').energyAttached.length, 0)
  assert.equal(active(s, 'p2').dc, 100)
})

test('Hyper Beam discards defender energy', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Dragonair', ['Double Colorless Energy', 'Double Colorless Energy'])
  s = place(s, 'p2', 0, 'Onix', ['Fighting Energy'])
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Hyper Beam' })
  assert.ok(s.pending)
  const uid = active(s, 'p2').energyAttached[0].uid
  s = reducer(s, { type: 'resolve-choice', payload: { uids: [uid] } })
  assert.equal(active(s, 'p2').energyAttached.length, 0)
  assert.equal(active(s, 'p2').dc, 20)
})

// --- scaling amounts ---
test('Water Gun counts extra water energy (capped)', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Poliwrath', ['Water Energy', 'Water Energy', 'Water Energy', 'Water Energy', 'Water Energy', 'Water Energy'])
  s = place(s, 'p2', 0, 'Machamp')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Water Gun' })
  // cost WWC paid with 3 water; 3 extra water but max 2 -> 30 + 20 = 50
  assert.equal(active(s, 'p2').dc, 50)
})

test('Mewtwo Psychic scales with defender energy cards', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Mewtwo', ['Psychic Energy', 'Psychic Energy'])
  s = place(s, 'p2', 0, 'Onix', ['Fighting Energy', 'Fighting Energy'])
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Psychic' })
  assert.equal(active(s, 'p2').dc, 30, '10 + 2x10')
})

test('Super Fang halves remaining HP', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Raticate', ['Double Colorless Energy', 'Fire Energy'])
  s = place(s, 'p2', 0, 'Machamp') // 100 hp
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Super Fang' })
  assert.equal(active(s, 'p2').dc, 50)
})

test('Flail scales with own damage', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Magikarp', ['Water Energy'])
  s = place(s, 'p2', 0, 'Machamp')
  s.p1.mon[0].dc = 20
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Flail' })
  assert.equal(active(s, 'p2').dc, 20)
})

// --- bench damage ---
test('Selfdestruct hits both benches and self', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Magneton', ['Lightning Energy', 'Lightning Energy', 'Double Colorless Energy'])
  s = place(s, 'p1', 1, 'Voltorb')
  s = place(s, 'p2', 0, 'Machamp')
  s = place(s, 'p2', 1, 'Onix')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Selfdestruct' })
  assert.equal(active(s, 'p2').dc, 80)
  assert.equal(s.p2.mon[1].dc, 20)
  assert.equal(s.p1.mon[1].dc, 20)
  assert.equal(active(s, 'p1'), null, 'Magneton KO by 80 self damage')
})

// --- switching ---
test('Gust of Wind switches opponent active', () => {
  let s = fresh()
  s = place(s, 'p2', 0, 'Machamp')
  s = place(s, 'p2', 1, 'Onix')
  s.p1.hand = [makeCard('Gust of Wind')]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: s.p1.hand[0].uid })
  assert.ok(s.pending)
  s = reducer(s, { type: 'click', player: 'p2', id: 1 })
  assert.equal(active(s, 'p2').name, 'Onix')
  assert.equal(s.p2.mon[1].name, 'Machamp')
})

test('retreat pays energy and switches', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Onix', ['Fighting Energy', 'Fighting Energy']) // retreat 2... actually Onix retreat cost
  s = place(s, 'p1', 1, 'Machop')
  s = reducer(s, { type: 'retreat', player: 'p1' })
  assert.ok(s.pending, 'choose energy to discard')
  const uids = s.p1.mon[0].energyAttached.map((e) => e.uid)
  s = reducer(s, { type: 'resolve-choice', payload: { uids } })
  if (s.pending) s = reducer(s, { type: 'click', player: 'p1', id: 1 })
  assert.equal(active(s, 'p1').name, 'Machop')
})

// --- trainers ---
test('Bill draws 2', () => {
  let s = fresh()
  const before = s.p1.hand.length
  s.p1.hand = [...s.p1.hand, makeCard('Bill')]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: s.p1.hand[before].uid })
  assert.equal(s.p1.hand.length, before + 2)
})

test('Professor Oak discards hand, draws 7', () => {
  let s = fresh()
  const oak = makeCard('Professor Oak')
  s.p1.hand = [...s.p1.hand, oak]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: oak.uid })
  assert.equal(s.p1.hand.length, 7)
  assert.ok(s.p1.discard.length >= 8, 'old hand + oak discarded')
})

test('Potion heals 20 via choose', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Machamp')
  s.p1.mon[0].dc = 30
  const potion = makeCard('Potion')
  s.p1.hand = [potion]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: potion.uid })
  s = reducer(s, { type: 'click', player: 'p1', id: 0 })
  assert.equal(active(s, 'p1').dc, 10)
})

test('Energy Removal discards opponent energy', () => {
  let s = fresh()
  s = place(s, 'p2', 0, 'Onix', ['Fighting Energy'])
  const er = makeCard('Energy Removal')
  s.p1.hand = [er]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: er.uid })
  s = reducer(s, { type: 'click', player: 'p2', id: 0 })
  assert.ok(s.pending, 'choose which energy')
  const uid = active(s, 'p2').energyAttached[0].uid
  s = reducer(s, { type: 'resolve-choice', payload: { uids: [uid] } })
  assert.equal(active(s, 'p2').energyAttached.length, 0)
})

test('Full Heal cures status', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Machamp')
  s.p1.mon[0].status = 'confused'
  s.p1.mon[0].poisoned = true
  const fh = makeCard('Full Heal')
  s.p1.hand = [fh]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: fh.uid })
  assert.equal(active(s, 'p1').status, null)
  assert.equal(active(s, 'p1').poisoned, false)
})

test('Revive benches basic with half HP damage', () => {
  let s = fresh()
  s.p1.discard = [makeCard('Machop')]
  const rv = makeCard('Revive')
  s.p1.hand = [rv]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: rv.uid })
  s = reducer(s, { type: 'resolve-choice', payload: { uids: [s.p1.discard.find((c) => c.name === 'Machop').uid] } })
  const benched = s.p1.mon.find((m) => m?.name === 'Machop')
  assert.ok(benched, 'Machop on bench')
  assert.equal(benched.dc, Math.floor(benched.hp / 2 / 10) * 10)
})

test('Energy Retrieval recovers energy that was discarded from play', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Charmander')
  s = place(s, 'p2', 0, 'Chansey')
  // attach two Fire Energy through the real drop path
  const e1 = makeCard('Fire Energy')
  const e2 = makeCard('Fire Energy')
  s.p1.hand = [e1, e2]
  s = reducer(s, { type: 'drop', source: { player: 'p1', from: 'hand', uid: e1.uid }, dest: { player: 'p1', id: 0 } })
  s = reducer(s, { type: 'drop', source: { player: 'p1', from: 'hand', uid: e2.uid }, dest: { player: 'p1', id: 0 } })
  // Ember's cost discards one of them into the discard pile
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Ember' })
  s = reducer(s, { type: 'resolve-choice', payload: { uids: [e1.uid] } })
  const discarded = s.p1.discard.find((c) => c.uid === e1.uid)
  assert.ok(discarded, 'energy in discard pile')
  assert.equal(discarded.supertype, 'energy', 'discarded energy is still a real card')
  // Energy Retrieval trades a card for it
  const rt = makeCard('Energy Retrieval')
  const filler = makeCard('Potion')
  s.p1.hand = [rt, filler]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: rt.uid })
  s = reducer(s, { type: 'resolve-choice', payload: { uids: [filler.uid] } })
  assert.ok(s.pending, 'energy pick offered from discard')
  s = reducer(s, { type: 'resolve-choice', payload: { uids: [e1.uid] } })
  assert.ok(s.p1.hand.some((c) => c.uid === e1.uid), 'Fire Energy back in hand')
  assert.ok(!s.p1.discard.some((c) => c.uid === e1.uid), 'no longer in discard')
})

test('Energy Retrieval unplayable with no basic energy in discard', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Charmander')
  const rt = makeCard('Energy Retrieval')
  const filler = makeCard('Potion')
  s.p1.hand = [rt, filler]
  s.p1.discard = [makeCard('Bill')]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: rt.uid })
  assert.equal(s.pending, null, 'no choice started')
  assert.ok(s.p1.hand.some((c) => c.uid === rt.uid), 'Energy Retrieval stays in hand')
  assert.ok(s.p1.hand.some((c) => c.uid === filler.uid), 'Potion not traded away')
})

test('PlusPower adds 10 to attack and expires end of turn', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Machamp')
  const pp = makeCard('PlusPower')
  s.p1.hand = [pp]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: pp.uid })
  assert.ok(active(s, 'p1').markers.plusPower)
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(active(s, 'p2').dc, 30, '20 + 10 PlusPower')
  s = reducer(s, { type: 'end-turn' })
  assert.ok(!active(s, 'p1').markers.plusPower, 'expired')
})

test('Defender reduces incoming damage by 20', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Chansey') // weakness fighting
  s = place(s, 'p2', 0, 'Machop', ['Fighting Energy'])
  const df = makeCard('Defender')
  s.p1.hand = [df]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: df.uid })
  s = reducer(s, { type: 'click', player: 'p1', id: 0 })
  s = reducer(s, { type: 'end-turn' })
  s = reducer(s, { type: 'attack', player: 'p2', id: 0, attackName: 'Low Kick' })
  // 20 x2 weakness = 40, -20 defender = 20
  assert.equal(active(s, 'p1').dc, 20)
})

// --- powers ---
test('Damage Swap moves counters', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Alakazam')
  s = place(s, 'p1', 1, 'Chansey')
  s.p1.mon[0].dc = 20
  s = reducer(s, { type: 'use-power', player: 'p1', id: 0 })
  s = reducer(s, { type: 'click', player: 'p1', id: 0 }) // from
  s = reducer(s, { type: 'click', player: 'p1', id: 1 }) // to
  assert.equal(s.p1.mon[0].dc, 10)
  assert.equal(s.p1.mon[1].dc, 10)
})

test('Energy Burn lets Charizard pay with any energy', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Charizard', ['Grass Energy', 'Grass Energy', 'Grass Energy', 'Grass Energy'])
  s = place(s, 'p2', 0, 'Chansey') // 120 HP survives 100
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Fire Spin' })
  assert.ok(s.pending, 'cost discard prompt (energy accepted as fire)')
  const uids = active(s, 'p1').energyAttached.slice(0, 2).map((e) => e.uid)
  s = reducer(s, { type: 'resolve-choice', payload: { uids } })
  assert.equal(active(s, 'p2').dc, 100)
})

test('Buzzap turns Electrode into 2 energy', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Electrode')
  s = place(s, 'p1', 1, 'Machop')
  s = reducer(s, { type: 'use-power', player: 'p1', id: 0 })
  s = reducer(s, { type: 'resolve-choice', payload: { type: 'fighting' } })
  s = reducer(s, { type: 'click', player: 'p1', id: 1 })
  assert.equal(active(s, 'p1'), null, 'Electrode gone')
  const machop = s.p1.mon[1]
  assert.equal(machop.energyAttached.length, 1)
  assert.equal(machop.energyAttached[0].units, 2)
  assert.equal(machop.energyAttached[0].energy, 'fighting')
})

test('Strikes Back returns 10 damage', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Machamp')
  s = place(s, 'p2', 0, 'Rattata', ['Fire Energy'])
  s = reducer(s, { type: 'attack', player: 'p2', id: 0, attackName: 'Bite' })
  assert.equal(active(s, 'p1').dc, 20)
  assert.equal(active(s, 'p2').dc, 10, 'Strikes Back')
})

// --- misc mechanics ---
test('Metronome copies defender attack without cost', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Clefairy', ['Double Colorless Energy', 'Fire Energy'])
  s = place(s, 'p2', 0, 'Machop', ['Fighting Energy'])
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Metronome' })
  assert.ok(s.pending, 'choose attack to copy')
  s = reducer(s, { type: 'resolve-choice', payload: { attackName: 'Low Kick' } })
  assert.equal(active(s, 'p2').dc, 20, 'copied Low Kick, no weakness (colorless attacker)')
})

test('Destiny Bond KOs the attacker', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Gastly', ['Psychic Energy', 'Psychic Energy'])
  s = place(s, 'p2', 0, 'Machamp', ['Fighting Energy', 'Fighting Energy', 'Fighting Energy', 'Double Colorless Energy'])
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Destiny Bond' })
  const uid = active(s, 'p1').energyAttached[0].uid
  s = reducer(s, { type: 'resolve-choice', payload: { uids: [uid] } })
  assert.ok(active(s, 'p1').markers.destinyBond)
  s = reducer(s, { type: 'end-turn' })
  s = reducer(s, { type: 'attack', player: 'p2', id: 0, attackName: 'Seismic Toss' })
  assert.equal(active(s, 'p1'), null, 'Gastly KO')
  assert.equal(active(s, 'p2'), null, 'Machamp KO by Destiny Bond')
})

test('Amnesia locks the chosen attack for a turn', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Poliwhirl', ['Water Energy', 'Water Energy'])
  s = place(s, 'p2', 0, 'Machop', ['Fighting Energy'])
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Amnesia' })
  s = reducer(s, { type: 'resolve-choice', payload: { attackName: 'Low Kick' } })
  s = reducer(s, { type: 'end-turn' })
  s = reducer(s, { type: 'attack', player: 'p2', id: 0, attackName: 'Low Kick' })
  assert.equal(active(s, 'p1').dc ?? 0, 0, 'locked attack did nothing')
})

test('evolution via drop keeps damage and energy, clears status', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Charmander', ['Fire Energy'])
  s.p1.mon[0].dc = 10
  s.p1.mon[0].status = 'asleep'
  const meleon = makeCard('Charmeleon')
  s.p1.hand = [meleon]
  s = reducer(s, { type: 'drop', source: { from: 'hand', player: 'p1', uid: meleon.uid }, dest: { player: 'p1', id: 0 } })
  const evolved = active(s, 'p1')
  assert.equal(evolved.name, 'Charmeleon')
  assert.equal(evolved.dc, 10)
  assert.equal(evolved.status, null)
  assert.equal(evolved.energyAttached.length, 1)
  assert.equal(evolved.prevStack.length, 1)
})

test('Devolution Spray devolves and discards the evolution', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Charmander')
  const meleon = makeCard('Charmeleon')
  s.p1.hand = [meleon]
  s = reducer(s, { type: 'drop', source: { from: 'hand', player: 'p1', uid: meleon.uid }, dest: { player: 'p1', id: 0 } })
  const spray = makeCard('Devolution Spray')
  s.p1.hand = [spray]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: spray.uid })
  s = reducer(s, { type: 'click', player: 'p1', id: 0 })
  assert.equal(active(s, 'p1').name, 'Charmander')
  assert.ok(s.p1.discard.some((c) => c.name === 'Charmeleon'))
})

test('Clefairy Doll: no status, discardable', () => {
  let s = fresh()
  const doll = makeCard('Clefairy Doll')
  s.p1.hand = [doll]
  s = reducer(s, { type: 'drop', source: { from: 'hand', player: 'p1', uid: doll.uid }, dest: { player: 'p1', id: 1 } })
  assert.equal(s.p1.mon[1].name, 'Clefairy Doll')
  s = place(s, 'p2', 0, 'Haunter', ['Psychic Energy'])
  // put doll active to be targeted
  s = { ...s, p1: { ...s.p1, mon: [s.p1.mon[1], null, null, null, null, null] } }
  s = reducer(s, { type: 'attack', player: 'p2', id: 0, attackName: 'Hypnosis' })
  assert.equal(active(s, 'p1').status, null, 'doll immune to status')
  s = reducer(s, { type: 'discard-doll', player: 'p1', id: 0 })
  assert.equal(active(s, 'p1'), null)
})

test('Whirlwind does damage then opponent switches', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Pidgey', ['Double Colorless Energy'])
  s = place(s, 'p2', 0, 'Machamp')
  s = place(s, 'p2', 1, 'Onix')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Whirlwind' })
  assert.equal(s.p2.mon.find((m) => m?.name === 'Machamp').dc, 10)
  assert.ok(s.pending)
  s = reducer(s, { type: 'click', player: 'p2', id: 1 })
  assert.equal(active(s, 'p2').name, 'Onix')
})

test('Leek Slap once per time in play', () => {
  Math.random = HEADS
  let s = fresh()
  s = place(s, 'p1', 0, "Farfetch'd", ['Fire Energy'])
  s = place(s, 'p2', 0, 'Machamp')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Leek Slap' })
  assert.equal(active(s, 'p2').dc, 30)
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Leek Slap' })
  Math.random = realRandom
  assert.equal(active(s, 'p2').dc, 30, 'second use blocked')
})

test('Recover discards energy and heals fully', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Kadabra', ['Psychic Energy', 'Psychic Energy', 'Psychic Energy'])
  s.p1.mon[0].dc = 40
  s = place(s, 'p2', 0, 'Machamp')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Recover' })
  const uid = active(s, 'p1').energyAttached[0].uid
  s = reducer(s, { type: 'resolve-choice', payload: { uids: [uid] } })
  assert.equal(active(s, 'p1').dc, 0)
  assert.equal(active(s, 'p1').energyAttached.length, 2)
})

test('Pokemon Center heals all own and discards their energy', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Machamp', ['Fighting Energy'])
  s = place(s, 'p1', 1, 'Onix', ['Fighting Energy'])
  s.p1.mon[0].dc = 30
  s.p1.mon[1].dc = 10
  const pc = makeCard('Pokémon Center')
  s.p1.hand = [pc]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: pc.uid })
  assert.equal(s.p1.mon[0].dc, 0)
  assert.equal(s.p1.mon[1].dc, 0)
  assert.equal(s.p1.mon[0].energyAttached.length, 0)
  assert.equal(s.p1.mon[1].energyAttached.length, 0)
})

test('Mirror Move reflects last turn damage', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Pidgeotto', ['Double Colorless Energy', 'Fire Energy'])
  s = place(s, 'p2', 0, 'Rattata', ['Fire Energy']) // colorless Bite avoids Pidgeotto's fighting resistance
  s = reducer(s, { type: 'end-turn' }) // p2 turn
  s = reducer(s, { type: 'attack', player: 'p2', id: 0, attackName: 'Bite' })
  assert.equal(active(s, 'p1').dc, 20)
  s = reducer(s, { type: 'end-turn' }) // back to p1
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Mirror Move' })
  assert.equal(active(s, 'p2').dc, 20, 'reflected 20')
})

test('confusion can hurt self on tails', () => {
  Math.random = TAILS
  let s = fresh()
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s.p1.mon[0].status = 'confused'
  s = place(s, 'p2', 0, 'Machamp')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  Math.random = realRandom
  assert.equal(active(s, 'p1').dc, 20, 'hurt itself')
  assert.equal(active(s, 'p2').dc ?? 0, 0)
})

// --- sandbox card catalog drops ---
test('catalog drop spawns any pokemon straight onto an empty spot', () => {
  let s = fresh()
  s = reducer(s, { type: 'drop', source: { from: 'catalog', name: 'Charizard' }, dest: { player: 'p1', id: 0 } })
  assert.equal(active(s, 'p1').name, 'Charizard', 'stage 2 spawned directly')
})

test('catalog drop attaches energy and moves cards to deck/discard/hand', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Squirtle')
  s = reducer(s, { type: 'drop', source: { from: 'catalog', name: 'Water Energy' }, dest: { player: 'p1', id: 0 } })
  assert.equal(active(s, 'p1').energyAttached.length, 1, 'energy attached from catalog')

  const deckBefore = s.p1.deck.length
  s = reducer(s, { type: 'drop', source: { from: 'catalog', name: 'Bill' }, dest: { player: 'p1', zone: 'deck' } })
  assert.equal(s.p1.deck.length, deckBefore + 1)
  assert.equal(s.p1.deck[0].name, 'Bill', 'goes on top of the deck')

  s = reducer(s, { type: 'drop', source: { from: 'catalog', name: 'Potion' }, dest: { player: 'p2', zone: 'discard' } })
  assert.ok(s.p2.discard.some((c) => c.name === 'Potion'))

  const handBefore = s.p1.hand.length
  s = reducer(s, { type: 'drop', source: { from: 'catalog', name: 'Professor Oak' }, dest: { player: 'p1', zone: 'hand' } })
  assert.equal(s.p1.hand.length, handBefore + 1)
})

test('hand cards can be dragged to deck and discard in sandbox', () => {
  let s = fresh()
  const card = s.p1.hand[0]
  s = reducer(s, { type: 'drop', source: { from: 'hand', player: 'p1', uid: card.uid }, dest: { player: 'p1', zone: 'discard' } })
  assert.ok(!s.p1.hand.some((c) => c.uid === card.uid), 'left the hand')
  assert.ok(s.p1.discard.some((c) => c.uid === card.uid), 'in the discard')
})

// --- sandbox turn-based toggle ---
test('turn rules toggle enforces order, limits, and auto end-of-attack', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Chansey')
  const energy1 = makeCard('Fighting Energy')
  const energy2 = makeCard('Fighting Energy')
  s = { ...s, p1: { ...s.p1, hand: [...s.p1.hand, energy1, energy2] } }
  s = reducer(s, { type: 'toggle-turn-rules' })
  assert.equal(s.enforceTurns, true)
  assert.equal(s.turnPlayer, 'p1')

  // off-turn action rejected
  const before = s.p2.mon[0].dc ?? 0
  s = reducer(s, { type: 'attack', player: 'p2', id: 0, attackName: 'Scrunch' })
  assert.equal(s.p1.mon[0].dc ?? 0, 0, 'p2 attack did nothing on p1 turn')
  assert.ok(s.log[s.log.length - 1].includes("turn"), 'rejection logged')

  // one energy per turn
  s = reducer(s, { type: 'drop', source: { from: 'hand', player: 'p1', uid: energy1.uid }, dest: { player: 'p1', id: 0 } })
  assert.equal(s.p1.mon[0].energyAttached.length, 2, 'first attach ok')
  s = reducer(s, { type: 'drop', source: { from: 'hand', player: 'p1', uid: energy2.uid }, dest: { player: 'p1', id: 0 } })
  assert.equal(s.p1.mon[0].energyAttached.length, 2, 'second attach blocked')

  // manual draws blocked
  const handLen = s.p1.hand.length
  s = reducer(s, { type: 'draw', player: 'p1' })
  assert.equal(s.p1.hand.length, handLen, 'manual draw blocked')

  // attack ends the turn and the next player draws
  const p2Hand = s.p2.hand.length
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(s.turnPlayer, 'p2', 'attack ended the turn')
  assert.equal(s.p2.hand.length, p2Hand + 1, 'p2 drew for turn')
  assert.equal(s.p2.mon[0].dc, before + 40, 'attack still resolved')

  // catalog drops bypass turn rules (testing tool)
  s = reducer(s, { type: 'drop', source: { from: 'catalog', name: 'Fire Energy' }, dest: { player: 'p1', id: 0 } })
  assert.equal(s.p1.mon[0].energyAttached.length, 3, 'catalog attach exempt from limits')

  // toggle off restores free play
  s = reducer(s, { type: 'toggle-turn-rules' })
  assert.equal(s.enforceTurns, false)
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(s.turnPlayer, 'p2', 'no auto turn end... turnPlayer unchanged by attack')
})

// --- fx queue (battle animations) ---
test('fx disabled by default: attacks resolve instantly with no fx', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Chansey')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(s.fxQueue.length, 0)
  assert.equal(active(s, 'p2').dc, 40, 'damage applied immediately')
})

test('fx queue pauses attack resolution until fx-done', () => {
  let s = fresh()
  s = { ...s, fxEnabled: true }
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Chansey')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(s.fxQueue[0]?.kind, 'attack', 'attack fx queued')
  assert.equal(active(s, 'p2').dc ?? 0, 0, 'no damage while the lunge plays')
  assert.ok(s.effectsQueue.length > 0, 'damage effect still queued')
  // other actions are ignored while fx play
  const before = s
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(s.p2.mon[0].dc ?? 0, 0, 'second attack ignored mid-fx')
  s = reducer(before, { type: 'fx-done' })
  assert.equal(active(s, 'p2').dc, 40, 'damage lands after fx-done')
  assert.equal(s.fxQueue[0]?.kind, 'hit', 'hit fx queued with the damage')
  s = reducer(s, { type: 'fx-done' })
  assert.equal(s.fxQueue.length, 0)
  assert.equal(s.effectsQueue.length, 0)
})

test('fx: coins shown before flip-dependent damage; statuses emit fx', () => {
  Math.random = HEADS
  let s = fresh()
  s = { ...s, fxEnabled: true }
  s = place(s, 'p1', 0, 'Nidoking', ['Grass Energy', 'Grass Energy', 'Grass Energy'])
  s = place(s, 'p2', 0, 'Chansey')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Toxic' })
  s = reducer(s, { type: 'fx-done' }) // attack lunge done
  Math.random = realRandom
  assert.equal(s.fxQueue[0]?.kind, 'hit', 'hit fx after damage')
  s = reducer(s, { type: 'fx-done' })
  assert.equal(s.fxQueue[0]?.kind, 'status', 'poison status fx')
  assert.equal(s.fxQueue[0]?.status, 'poisoned')
  s = reducer(s, { type: 'fx-done' })
  assert.equal(s.fxQueue.length, 0)
  assert.ok(active(s, 'p2').poisoned, 'poison applied')
})

test('fx: flip effects pause on the coins before resolving', () => {
  Math.random = HEADS
  let s = fresh()
  s = { ...s, fxEnabled: true }
  s = place(s, 'p1', 0, 'Doduo', ['Double Colorless Energy'])
  s = place(s, 'p2', 0, 'Onix')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Fury Attack' })
  s = reducer(s, { type: 'fx-done' }) // attack lunge
  Math.random = realRandom
  assert.equal(s.fxQueue[0]?.kind, 'coins', 'coin fx queued')
  assert.equal(s.fxQueue[0].results.length, 2, 'both flips shown')
  assert.equal(active(s, 'p2').dc ?? 0, 0, 'damage waits for the coins')
  s = reducer(s, { type: 'fx-done' })
  assert.equal(active(s, 'p2').dc, 20, '2 heads x 10 after coins shown')
})

test('fx: disabling mid-playback resumes the queue', () => {
  let s = fresh()
  s = { ...s, fxEnabled: true }
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Chansey')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.ok(s.fxQueue.length > 0)
  s = reducer(s, { type: 'set-fx-enabled', value: false })
  assert.equal(s.fxQueue.length, 0)
  assert.equal(active(s, 'p2').dc, 40, 'attack finished resolving')
})

test('turn rules enforce once-per-turn powers in sandbox', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Zapdos')
  s = place(s, 'p1', 1, 'Electrode', ['Lightning Energy'])
  s = place(s, 'p2', 0, 'Chansey')
  s = reducer(s, { type: 'toggle-turn-rules' })
  // Buzzap (once per turn) marks the flag when used under turn rules
  const uid = s.p1.mon[1].uid
  s = reducer(s, { type: 'use-power', player: 'p1', id: 1 })
  assert.ok(s.pending, 'first use prompts a choice')
  assert.equal(s.turnFlags.powersUsed[uid], true, 'power marked as used')
  // a slot whose power is already flagged gets rejected by the guard
  s = { ...s, pending: null, effectsQueue: [] }
  s = reducer(s, { type: 'use-power', player: 'p1', id: 1 })
  assert.ok(s.log[s.log.length - 1].includes('once per turn'), 'second use blocked')
  // toggling off clears the flags and frees the power again
  s = reducer(s, { type: 'toggle-turn-rules' })
  assert.deepEqual(s.turnFlags.powersUsed, {})
})

// --- custom decks -----------------------------------------------------------
const goodCounts = {
  Ponyta: 4,
  Growlithe: 4,
  Charmander: 4,
  Bill: 4,
  Potion: 4,
  'Fire Energy': 40,
}

test('validateDeck: legal 60-card deck passes', () => {
  assert.deepEqual(validateDeck(goodCounts), [])
})

test('validateDeck: wrong size and copy limit reported', () => {
  const problems = validateDeck({ Ponyta: 5, 'Fire Energy': 10 })
  assert.ok(problems.some((p) => p.includes('exactly 60')), 'size problem reported')
  assert.ok(problems.some((p) => p.includes('Max 4 copies of Ponyta')), 'copy limit reported')
})

test('validateDeck: basic energy exempt from copy limit, DCE is not', () => {
  const problems = validateDeck({ ...goodCounts, 'Fire Energy': 35, 'Double Colorless Energy': 5 })
  assert.ok(!problems.some((p) => p.includes('Fire Energy')), '40 Fire Energy is fine')
  assert.ok(problems.some((p) => p.includes('Double Colorless Energy')), 'DCE capped at 4')
})

test('validateDeck: requires a Basic Pokémon', () => {
  const problems = validateDeck({ 'Fire Energy': 60 })
  assert.ok(problems.some((p) => p.includes('Basic Pokémon')))
})

test('validateDeck: collection constrains copies (Story Mode seam)', () => {
  const collection = { ...goodCounts, Ponyta: 2 }
  const problems = validateDeck(goodCounts, collection)
  assert.ok(problems.some((p) => p.includes('only own 2') && p.includes('Ponyta')))
  assert.deepEqual(validateDeck(goodCounts, goodCounts), [], 'full collection passes')
})

test('deckToList expands counts to a flat 60-name list', () => {
  const list = deckToList({ counts: goodCounts })
  assert.equal(list.length, 60)
  assert.equal(list.filter((n) => n === 'Ponyta').length, 4)
  assert.equal(list.filter((n) => n === 'Fire Energy').length, 40)
})

test('initialMatchState deals a custom deck list and logs its name', () => {
  const s = initialMatchState({ p1DeckList: deckToList({ counts: goodCounts }), p1DeckName: 'My Fire Deck' })
  const total = s.p1.hand.length + s.p1.prizes.length + s.p1.deck.length
  assert.equal(total, 60, 'all 60 cards dealt across hand/prizes/deck')
  assert.ok(s.p1.hand.length >= 7, 'opening hand dealt (plus any mulligan draws)')
  assert.equal(s.p1.prizes.length, 6)
  const names = [...s.p1.hand, ...s.p1.prizes, ...s.p1.deck].map((c) => c.name)
  assert.equal(names.filter((n) => n === 'Fire Energy').length, 40, 'list contents respected')
  assert.ok(s.log[0].includes('My Fire Deck'), 'custom deck name in match log')
})

test('every Quick Play preset deck is 60 cards and match-legal', () => {
  for (const deck of Object.values(DECKS)) {
    const counts = {}
    for (const n of deck.list) counts[n] = (counts[n] ?? 0) + 1
    const problems = validateDeck(counts)
    assert.deepEqual(problems, [], `${deck.id}: ${problems.join(' | ')}`)
  }
})

// --- Jungle & Fossil: sets, species, and new mechanics ----------------------

test('species: Base Raichu evolves Jungle Pikachu', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Pikachu (Jungle)')
  const raichu = makeCard('Raichu')
  s = { ...s, p1: { ...s.p1, hand: [raichu] } }
  s = reducer(s, { type: 'drop', source: { player: 'p1', from: 'hand', uid: raichu.uid }, dest: { player: 'p1', id: 0 } })
  assert.equal(active(s, 'p1').name, 'Raichu', 'evolved across sets')
  assert.equal(active(s, 'p1').prevStack[0].name, 'Pikachu (Jungle)')
})

test('copy limit is shared across prints of a species', () => {
  const counts = { Zapdos: 3, 'Zapdos (Fossil)': 2, Ponyta: 4, Growlithe: 4, Charmander: 4, Bill: 3, 'Fire Energy': 40 }
  const problems = validateDeck(counts)
  assert.ok(problems.some((p) => p.includes('Max 4 copies of Zapdos across all prints')), 'shared cap reported')
})

test('format seam: cards outside the format are rejected', () => {
  const baseOnly = { id: 'baseOnly', name: 'Base Only', sets: ['base1'] }
  const counts = { ...goodCounts, Bill: 3, Snorlax: 1 } // Snorlax is Jungle
  assert.deepEqual(validateDeck(counts), [], 'legal in Classic')
  const problems = validateDeck(counts, null, baseOnly)
  assert.ok(problems.some((p) => p.includes('Snorlax') && p.includes('not legal in Base Only')))
})

test('Toxic Gas shuts off other powers', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Alakazam')
  s = place(s, 'p2', 0, 'Muk')
  s = reducer(s, { type: 'use-power', player: 'p1', id: 0 })
  assert.ok(!s.pending, 'Damage Swap did not activate')
  assert.ok(s.log[s.log.length - 1].includes('Toxic Gas'), 'blocked with a Toxic Gas message')
})

test('Prehistoric Power blocks evolution under turn rules', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Squirtle')
  s = place(s, 'p2', 0, 'Aerodactyl')
  const wartortle = makeCard('Wartortle')
  s = { ...s, p1: { ...s.p1, hand: [wartortle] } }
  s = reducer(s, { type: 'toggle-turn-rules' })
  s = { ...s, turnNumber: 5 }
  s = reducer(s, { type: 'drop', source: { player: 'p1', from: 'hand', uid: wartortle.uid }, dest: { player: 'p1', id: 0 } })
  assert.equal(active(s, 'p1').name, 'Squirtle', 'evolution blocked')
  assert.ok(s.log[s.log.length - 1].includes('Prehistoric Power'))
  // a statused Aerodactyl stops blocking
  s = { ...s, p2: { ...s.p2, mon: s.p2.mon.map((m, i) => (i === 0 ? { ...m, status: 'asleep' } : m)) } }
  s = reducer(s, { type: 'drop', source: { player: 'p1', from: 'hand', uid: wartortle.uid }, dest: { player: 'p1', id: 0 } })
  assert.equal(active(s, 'p1').name, 'Wartortle', 'evolves once Aerodactyl is asleep')
})

test('Kabuto Armor halves attack damage', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Kabuto')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(active(s, 'p2').dc, 10, '20 halved to 10')
})

test('Invisible Wall prevents 30+ damage to Mr. Mime', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Pinsir', ['Grass Energy', 'Grass Energy', 'Double Colorless Energy'])
  s = place(s, 'p2', 0, 'Mr. Mime')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Guillotine' })
  assert.equal(active(s, 'p2').dc ?? 0, 0, '50 fully prevented')
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(active(s, 'p2').dc, 20, 'small hits still land')
})

test('Thick Skinned: Snorlax cannot be statused', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Nidoking', ['Grass Energy', 'Grass Energy', 'Grass Energy'])
  s = place(s, 'p2', 0, 'Snorlax')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Toxic' })
  assert.ok(!active(s, 'p2').poisoned, 'poison blocked')
  assert.ok(s.log.some((l) => l.includes('Thick Skinned')))
})

test('Retreat Aid: benched Dodrio discounts the retreat cost', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Snorlax')
  const full = retreatCostOf(s, 'p1')
  s = place(s, 'p1', 1, 'Dodrio')
  assert.equal(retreatCostOf(s, 'p1'), full - 1, 'one less with Dodrio benched')
})

test('Transform: active Ditto copies the defender and pays with any energy', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Ditto', ['Psychic Energy'])
  s = place(s, 'p2', 0, 'Machop')
  const view = combatView(s, { player: 'p1', id: 0 })
  assert.equal(view.attacks[0]?.name, 'Low Kick', 'copied attacks visible')
  assert.equal(view.type, 'fighting', 'copied type')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(active(s, 'p2').dc, 20, 'copied attack lands (psychic paid a fighting cost)')
})

test('Mysterious Fossil plays like a doll and awards no prize', () => {
  let s = fresh()
  s = { ...s, mode: 'match', turnNumber: 3, turnPlayer: 'p1' }
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Mysterious Fossil')
  s = place(s, 'p2', 1, 'Chansey')
  assert.equal(active(s, 'p2').hp, 10)
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Low Kick' })
  assert.equal(s.prizesOwed.p1, 0, 'no prize for KOing the fossil')
  assert.ok(s.p2.discard.some((c) => c.name === 'Mysterious Fossil'), 'fossil discarded')
  assert.ok(s.pending?.promote, 'p2 must promote a new active')
})

test('Poké Ball: heads searches any Pokémon from the deck', () => {
  Math.random = HEADS
  let s = fresh()
  const ball = makeCard('Poké Ball')
  s = { ...s, p1: { ...s.p1, hand: [ball] } }
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: ball.uid })
  Math.random = realRandom
  assert.ok(s.pending, 'search prompt shown on heads')
  const pick = s.p1.deck.find((c) => c.supertype === 'pokemon')
  s = reducer(s, { type: 'resolve-choice', payload: { uids: [pick.uid] } })
  assert.ok(s.p1.hand.some((c) => c.uid === pick.uid), 'chosen Pokémon in hand')
})

test('Gambler: shuffles the hand away, draws 8 on heads / 1 on tails', () => {
  for (const [rng, expected] of [[HEADS, 8], [TAILS, 1]]) {
    Math.random = rng
    let s = fresh()
    const gambler = makeCard('Gambler')
    s = { ...s, p1: { ...s.p1, hand: [gambler, makeCard('Potion'), makeCard('Bill')] } }
    s = reducer(s, { type: 'play-trainer', player: 'p1', uid: gambler.uid })
    Math.random = realRandom
    assert.equal(s.p1.hand.length, expected, `drew ${expected}`)
  }
})

test('Hurricane returns the surviving defender and attachments to hand', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Pidgeot', ['Double Colorless Energy', 'Grass Energy'])
  s = place(s, 'p2', 0, 'Onix', ['Fighting Energy'])
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Hurricane' })
  assert.equal(active(s, 'p2'), null, 'Onix left the field')
  assert.ok(s.p2.hand.some((c) => c.name === 'Onix'), 'Onix in hand')
  assert.ok(s.p2.hand.some((c) => c.name === 'Fighting Energy'), 'energy came back too')
  assert.ok(!s.p2.discard.some((c) => c.name === 'Onix'), 'not discarded')
})

test('Leech Life heals the damage dealt', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Venonat', ['Grass Energy', 'Grass Energy'])
  s = { ...s, p1: { ...s.p1, mon: s.p1.mon.map((m, i) => (i === 0 ? { ...m, dc: 20 } : m)) } }
  s = place(s, 'p2', 0, 'Chansey')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Leech Life' })
  assert.equal(active(s, 'p2').dc, 10)
  assert.equal(active(s, 'p1').dc, 10, 'healed 10 of the 20')
})

test("Curse moves a damage counter between the opponent's pokemon", () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Gengar')
  s = place(s, 'p2', 0, 'Onix')
  s = place(s, 'p2', 1, 'Chansey')
  s = { ...s, p2: { ...s.p2, mon: s.p2.mon.map((m, i) => (i === 0 ? { ...m, dc: 10 } : m)) } }
  s = reducer(s, { type: 'use-power', player: 'p1', id: 0 })
  s = reducer(s, { type: 'click', player: 'p2', id: 0 })
  s = reducer(s, { type: 'click', player: 'p2', id: 1 })
  assert.equal(active(s, 'p2').dc, 0)
  assert.equal(s.p2.mon[1].dc, 10)
})

test('Peek works from the bench and is once per turn under turn rules', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Machop')
  s = place(s, 'p1', 1, 'Mankey') // benched — Peek must still be usable
  s = place(s, 'p2', 0, 'Onix')
  s = reducer(s, { type: 'toggle-turn-rules' })
  s = reducer(s, { type: 'use-power', player: 'p1', id: 1 })
  assert.ok(s.pending, 'benched Peek prompts for what to look at')
  assert.equal(s.pending.what, 'option')
  s = reducer(s, { type: 'resolve-choice', payload: { option: 'oppDeck' } })
  assert.ok(s.reveal, 'a card was revealed')
  assert.equal(s.reveal.player, 'p1', 'only the peeking player sees it')
  assert.equal(s.reveal.cards[0].uid, s.p2.deck[0].uid, "showed the top of the opponent's deck")
  s = reducer(s, { type: 'close-reveal' })
  s = reducer(s, { type: 'use-power', player: 'p1', id: 1 })
  assert.ok(!s.pending, 'second use this turn is rejected')
  assert.ok(s.log[s.log.length - 1].includes('once per turn'))
})

test('Strange Behavior pulls counters onto Slowbro but never KOs it', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Slowbro')
  s = place(s, 'p1', 1, 'Machop')
  s = { ...s, p1: { ...s.p1, mon: s.p1.mon.map((m, i) => (i === 1 ? { ...m, dc: 20 } : m)) } }
  s = reducer(s, { type: 'use-power', player: 'p1', id: 0 })
  s = reducer(s, { type: 'click', player: 'p1', id: 1 })
  assert.equal(s.p1.mon[1].dc, 10)
  assert.equal(active(s, 'p1').dc, 10)
  // pin Slowbro at 10-under-KO: further moves refuse
  s = { ...s, p1: { ...s.p1, mon: s.p1.mon.map((m, i) => (i === 0 ? { ...m, dc: m.hp - 10 } : m)) } }
  s = reducer(s, { type: 'use-power', player: 'p1', id: 0 })
  s = reducer(s, { type: 'click', player: 'p1', id: 1 })
  assert.equal(active(s, 'p1').dc, active(s, 'p1').hp - 10, 'stopped short of a KO')
  assert.ok(s.log[s.log.length - 1].includes('stays put'))
})

// --- Wizards Black Star Promos ----------------------------------------------

test('promo Pikachu: Growl shaves 10 off the next attack', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Pikachu (Promo 1)', ['Lightning Energy'])
  s = place(s, 'p2', 0, 'Machop', ['Fighting Energy'])
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Growl' })
  s = reducer(s, { type: 'attack', player: 'p2', id: 0, attackName: 'Low Kick' })
  assert.equal(active(s, 'p1').dc, 30, '20 doubled by weakness, then -10 from Growl')
})

test('promo Electabuzz: Light Screen halves attack damage', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Electabuzz (Promo 2)', ['Lightning Energy'])
  s = place(s, 'p2', 0, 'Pinsir', ['Grass Energy', 'Grass Energy', 'Double Colorless Energy'])
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Light Screen' })
  s = reducer(s, { type: 'attack', player: 'p2', id: 0, attackName: 'Guillotine' })
  assert.equal(active(s, 'p1').dc, 20, '50 halved to 20 (rounded down to nearest 10)')
})

test('promo Mewtwo: Energy Absorption attaches energy from the discard pile', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Mewtwo (Promo 3)', ['Psychic Energy'])
  s = place(s, 'p2', 0, 'Onix')
  const e1 = makeCard('Psychic Energy')
  const e2 = makeCard('Fighting Energy')
  s = { ...s, p1: { ...s.p1, discard: [e1, e2] } }
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Energy Absorption' })
  assert.ok(s.pending, 'discard pile choice prompted')
  s = reducer(s, { type: 'resolve-choice', payload: { uids: [e1.uid, e2.uid] } })
  assert.equal(active(s, 'p1').energyAttached.length, 3, 'both cards attached')
  assert.equal(s.p1.discard.length, 0)
})

test("Mew: Psywave scales with the defender's energy; Devolution Beam returns the evolution to hand", () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Mew', ['Psychic Energy', 'Psychic Energy'])
  s = place(s, 'p2', 0, 'Onix', ['Fighting Energy', 'Fighting Energy', 'Fighting Energy'])
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Psywave' })
  assert.equal(active(s, 'p2').dc, 30, '10 x 3 energy')
  // set up an evolved pokemon and beam the Machoke back to hand
  s = place(s, 'p2', 1, 'Machop')
  const machoke = makeCard('Machoke')
  s = { ...s, p2: { ...s.p2, hand: [machoke] } }
  s = reducer(s, { type: 'drop', source: { player: 'p2', from: 'hand', uid: machoke.uid }, dest: { player: 'p2', id: 1 } })
  assert.equal(s.p2.mon[1].name, 'Machoke')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Devolution Beam' })
  s = reducer(s, { type: 'click', player: 'p2', id: 1 })
  assert.equal(s.p2.mon[1].name, 'Machop', 'devolved')
  assert.ok(s.p2.hand.some((c) => c.name === 'Machoke'), 'Machoke back in hand, not discarded')
})

test('promo Mewtwo 12: Telekinesis hits any Pokémon without W/R', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Mewtwo (Promo 12)', ['Psychic Energy', 'Psychic Energy', 'Psychic Energy'])
  s = place(s, 'p2', 0, 'Machop') // psychic-weak, 50 HP — doubling would KO
  s = place(s, 'p2', 1, 'Chansey')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Telekinesis' })
  s = reducer(s, { type: 'click', player: 'p2', id: 0 })
  assert.equal(active(s, 'p2').dc, 30, '30 flat — weakness is not applied even on the active')
})

test('promo Venusaur: Solar Power cures both Active Pokémon', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Venusaur (Promo 13)')
  s = place(s, 'p2', 0, 'Onix')
  s = { ...s, p1: { ...s.p1, mon: s.p1.mon.map((m, i) => (i === 0 ? { ...m, poisoned: true } : m)) } }
  s = { ...s, p2: { ...s.p2, mon: s.p2.mon.map((m, i) => (i === 0 ? { ...m, status: 'asleep' } : m)) } }
  s = reducer(s, { type: 'use-power', player: 'p1', id: 0 })
  assert.ok(!active(s, 'p1').poisoned, 'own active cured')
  assert.equal(active(s, 'p2').status, null, 'defending active cured')
})

test('Computer Error: both players draw 5 and the turn ends', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Onix')
  s = place(s, 'p2', 0, 'Onix')
  s = reducer(s, { type: 'toggle-turn-rules' })
  const err = makeCard('Computer Error')
  s = { ...s, p1: { ...s.p1, hand: [err] } }
  const oppHand = s.p2.hand.length
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: err.uid })
  assert.equal(s.p1.hand.length, 5, 'drew 5 (Computer Error left the hand)')
  // +5 from the trainer, +1 from the turn-start draw after the forced end turn
  assert.equal(s.p2.hand.length, oppHand + 6, 'opponent drew 5, then their turn began')
  assert.equal(s.turnPlayer, 'p2', 'turn passed to the opponent')
})

test('Super Energy Retrieval: trade 2 cards for up to 4 basic energy', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Onix')
  s = place(s, 'p2', 0, 'Onix')
  const ser = makeCard('Super Energy Retrieval')
  const junk = [makeCard('Potion'), makeCard('Bill')]
  const energy = [makeCard('Water Energy'), makeCard('Water Energy'), makeCard('Fire Energy'), makeCard('Grass Energy')]
  s = { ...s, p1: { ...s.p1, hand: [ser, ...junk], discard: [...energy, makeCard('Double Colorless Energy')] } }
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: ser.uid })
  s = reducer(s, { type: 'resolve-choice', payload: { uids: junk.map((c) => c.uid) } })
  s = reducer(s, { type: 'resolve-choice', payload: { uids: energy.map((c) => c.uid) } })
  assert.equal(s.p1.hand.length, 4, '4 energy in hand')
  assert.ok(s.p1.hand.every((c) => c.supertype === 'energy'))
  assert.ok(s.p1.discard.some((c) => c.name === 'Double Colorless Energy'), 'DCE not retrievable')
})

test("promo Dragonite: Special Delivery draws then returns a card to the deck top", () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Dragonite (Promo 5)')
  s = place(s, 'p2', 0, 'Onix')
  const handBefore = s.p1.hand.length
  const deckBefore = s.p1.deck.length
  s = reducer(s, { type: 'use-power', player: 'p1', id: 0 })
  assert.ok(s.pending, 'asked which card to put back')
  const putBack = s.p1.hand[0]
  s = reducer(s, { type: 'resolve-choice', payload: { uids: [putBack.uid] } })
  assert.equal(s.p1.hand.length, handBefore, 'net hand size unchanged')
  assert.equal(s.p1.deck.length, deckBefore, 'net deck size unchanged')
  assert.equal(s.p1.deck[0].uid, putBack.uid, 'chosen card is on top of the deck')
})

test("promo Eevee: Chain Reaction evolves from the deck", () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Eevee (Promo 11)')
  s = place(s, 'p2', 0, 'Onix')
  const flareon = makeCard('Flareon')
  s = { ...s, p1: { ...s.p1, deck: [flareon, ...s.p1.deck] } }
  s = reducer(s, { type: 'use-power', player: 'p1', id: 0 })
  s = reducer(s, { type: 'resolve-choice', payload: { uids: [flareon.uid] } })
  assert.equal(active(s, 'p1').name, 'Flareon', 'Eevee evolved from the deck')
  assert.equal(active(s, 'p1').prevStack[0].name, 'Eevee (Promo 11)')
})

// --- Team Rocket / Gym Heroes / Gym Challenge ---

test('Dark Golbat: Sneak Attack triggers when played from hand', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Zubat (Rocket)')
  s = place(s, 'p2', 0, 'Onix')
  const golbat = makeCard('Dark Golbat')
  s = { ...s, p1: { ...s.p1, hand: [golbat] } }
  s = reducer(s, { type: 'drop', source: { from: 'hand', player: 'p1', uid: golbat.uid }, dest: { player: 'p1', id: 0 } })
  assert.equal(active(s, 'p1').name, 'Dark Golbat', 'Zubat evolved')
  assert.ok(s.pending, 'Sneak Attack asks for a target')
  s = reducer(s, { type: 'click', player: 'p2', id: 0 })
  assert.equal(active(s, 'p2').dc, 10, 'Sneak Attack did 10')
})

test('Rattata (Rocket): Trickery swaps a prize with the top of the deck', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Rattata (Rocket)')
  s = place(s, 'p2', 0, 'Onix')
  const prize = makeCard('Potion')
  const top = makeCard('Bill')
  s = { ...s, p1: { ...s.p1, prizes: [prize], deck: [top, ...s.p1.deck] } }
  s = reducer(s, { type: 'use-power', player: 'p1', id: 0 })
  assert.equal(s.p1.prizes[0].uid, top.uid, 'top card became the prize')
  assert.equal(s.p1.deck[0].uid, prize.uid, 'prize went to the top of the deck')
})

test('Focus Energy doubles Gnaw next turn', () => {
  let s = fresh()
  s = place(s, 'p1', 0, "Lt. Surge's Rattata", ['Double Colorless Energy'])
  s = place(s, 'p2', 0, 'Onix')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Focus Energy' })
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Gnaw' })
  assert.equal(active(s, 'p2').dc, 40, '20 base doubled to 40')
})

test("Dark Muk's Sticky Goo raises the opposing active's retreat cost", () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Dark Muk')
  s = place(s, 'p2', 0, 'Onix') // retreat cost 3
  assert.equal(retreatCostOf(s, 'p2'), 5, '3 + 2 while Dark Muk is active')
})

test('Koga (trainer): damaging attacks by Koga Pokémon poison this turn', () => {
  let s = fresh()
  s = place(s, 'p1', 0, "Koga's Ekans", ['Grass Energy'])
  s = place(s, 'p2', 0, 'Onix')
  const koga = makeCard('Koga')
  s = { ...s, p1: { ...s.p1, hand: [koga] } }
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: koga.uid })
  Math.random = TAILS // Fast-Acting Poison's own flips fail; the poison must come from Koga
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Fast-Acting Poison' })
  Math.random = realRandom
  assert.equal(active(s, 'p2').dc, 20, '10 doubled by Onix grass weakness')
  assert.equal(active(s, 'p2').poisoned, true, 'Koga poisoned the defender')
})

test('Giovanni (trainer): the marked Pokémon ignores evolution timing', () => {
  let s = fresh()
  s = place(s, 'p1', 0, "Giovanni's Machop")
  s = place(s, 'p2', 0, 'Onix')
  s = reducer(s, { type: 'toggle-turn-rules' })
  s = { ...s, p1: { ...s.p1, mon: s.p1.mon.map((m, i) => (i === 0 ? { ...m, turnPlayed: s.turnNumber } : m)) } }
  const gio = makeCard('Giovanni')
  const machoke = makeCard("Giovanni's Machoke")
  s = { ...s, p1: { ...s.p1, hand: [gio, machoke] } }
  // without Giovanni the evolution is rejected (played this turn / turn 1)
  s = reducer(s, { type: 'drop', source: { from: 'hand', player: 'p1', uid: machoke.uid }, dest: { player: 'p1', id: 0 } })
  assert.equal(active(s, 'p1').name, "Giovanni's Machop", 'evolution blocked by timing')
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: gio.uid })
  s = reducer(s, { type: 'click', player: 'p1', id: 0 })
  assert.ok(active(s, 'p1').markers?.giovanni, 'marker applied')
  s = reducer(s, { type: 'drop', source: { from: 'hand', player: 'p1', uid: machoke.uid }, dest: { player: 'p1', id: 0 } })
  assert.equal(active(s, 'p1').name, "Giovanni's Machoke", 'evolved despite timing rules')
})

test('Stadiums replace each other; No Removal Gym taxes Energy Removal', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Onix')
  s = place(s, 'p2', 0, 'Onix', ['Fighting Energy'])
  const gym1 = makeCard("The Rocket's Training Gym")
  const gym2 = makeCard('No Removal Gym')
  const er = makeCard('Energy Removal')
  s = { ...s, p1: { ...s.p1, hand: [gym1, gym2, er] } }
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: gym1.uid })
  assert.equal(s.stadium?.card?.name, "The Rocket's Training Gym")
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: gym2.uid })
  assert.equal(s.stadium?.card?.name, 'No Removal Gym', 'new stadium replaced the old')
  assert.ok(s.p1.discard.some((c) => c.name === "The Rocket's Training Gym"), 'old stadium discarded')
  // hand now: just Energy Removal — no 2 cards to discard, so it can't be played
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: er.uid })
  assert.ok(s.p1.hand.some((c) => c.uid === er.uid), 'Energy Removal blocked without the 2-card tax')
})

test('Goop Gas Attack turns Pokémon Powers off', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Onix')
  s = place(s, 'p2', 0, 'Rattata (Rocket)')
  const goop = makeCard('Goop Gas Attack')
  s = { ...s, p1: { ...s.p1, hand: [goop] } }
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: goop.uid })
  const before = s.p2.prizes.length
  s = { ...s, p2: { ...s.p2, prizes: [makeCard('Potion')] } }
  s = reducer(s, { type: 'use-power', player: 'p2', id: 0 })
  assert.equal(s.p2.prizes[0].name, 'Potion', 'Trickery did nothing while powers are off')
})

test('Warp Point switches both actives', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Onix')
  s = place(s, 'p1', 1, 'Machop')
  s = place(s, 'p2', 0, 'Onix')
  s = place(s, 'p2', 1, 'Rattata')
  const wp = makeCard('Warp Point')
  s = { ...s, p1: { ...s.p1, hand: [wp] } }
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: wp.uid })
  s = reducer(s, { type: 'click', player: 'p2', id: 1 }) // opponent picks
  s = reducer(s, { type: 'click', player: 'p1', id: 1 }) // then you pick
  assert.equal(active(s, 'p2').name, 'Rattata')
  assert.equal(active(s, 'p1').name, 'Machop')
})

test('Trash Exchange shuffles the discard into the deck, then mills that many', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Onix')
  s = place(s, 'p2', 0, 'Onix')
  const tx = makeCard('Trash Exchange')
  const trash = [makeCard('Potion'), makeCard('Bill'), makeCard('Switch')]
  s = { ...s, p1: { ...s.p1, hand: [tx], discard: trash } }
  const deckBefore = s.p1.deck.length
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: tx.uid })
  assert.equal(s.p1.discard.length, 3 + 1, '3 milled cards plus Trash Exchange itself')
  assert.equal(s.p1.deck.length, deckBefore, 'deck size net unchanged')
})

test('Rainbow Energy counts as any type but deals 10 when attached', () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Squirtle')
  s = place(s, 'p2', 0, 'Onix')
  const rainbow = makeCard('Rainbow Energy')
  s = { ...s, p1: { ...s.p1, hand: [rainbow] } }
  s = reducer(s, { type: 'drop', source: { from: 'hand', player: 'p1', uid: rainbow.uid }, dest: { player: 'p1', id: 0 } })
  assert.equal(active(s, 'p1').dc, 10, 'Rainbow Energy hurt its host')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Bubble' })
  Math.random = realRandom
  assert.ok((active(s, 'p2').dc ?? 0) >= 10, 'Bubble paid for by Rainbow Energy')
})

test("Vending Gastly's Spookify blocks the opponent's trainers next turn", () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Gastly (Vending)', ['Psychic Energy'])
  s = place(s, 'p2', 0, 'Onix')
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Spookify' })
  assert.equal(s.trainerBlock?.player, 'p2', 'p2 is trainer-blocked')
  const bill = makeCard('Bill')
  let t = { ...s, turnPlayer: 'p2', p2: { ...s.p2, hand: [bill] } }
  t = reducer(t, { type: 'play-trainer', player: 'p2', uid: bill.uid })
  assert.ok(t.p2.hand.some((c) => c.uid === bill.uid), 'Bill could not be played')
})

test("Vending Haunter's Poltergeist does 10 per trainer in the opponent's hand", () => {
  let s = fresh()
  s = place(s, 'p1', 0, 'Haunter (Vending)', ['Psychic Energy'])
  s = place(s, 'p2', 0, 'Onix') // no psychic weakness/resistance
  s = { ...s, p2: { ...s.p2, hand: [makeCard('Bill'), makeCard('Potion'), makeCard('Switch'), makeCard('Psychic Energy')] } }
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Poltergeist' })
  assert.equal(active(s, 'p2').dc, 30, '3 trainers -> 30 damage')
  assert.equal(s.reveal?.player, 'p1', "opponent's hand revealed to the attacker")
})

test("Vending Haunter's Bad Dreams: heads sleeps, tails confuses", () => {
  for (const [rng, status] of [[HEADS, 'asleep'], [TAILS, 'confused']]) {
    let s = fresh()
    s = place(s, 'p1', 0, 'Haunter (Vending)', ['Psychic Energy', 'Psychic Energy'])
    s = place(s, 'p2', 0, 'Onix')
    Math.random = rng
    s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: 'Bad Dreams' })
    Math.random = realRandom
    assert.equal(active(s, 'p2').dc, 20, 'base 20 damage')
    assert.equal(active(s, 'p2').status, status, `status is ${status}`)
  }
})

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`)

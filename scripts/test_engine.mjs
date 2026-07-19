// Headless smoke tests for the effect engine. Run: node scripts/test_engine.mjs
import assert from 'assert'
import { reducer, initialGameState } from '../src/engine/reducer.js'
import { makeCard, makeSlot } from '../src/engine/cards.js'

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

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`)

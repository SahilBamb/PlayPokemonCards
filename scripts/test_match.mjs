// Headless tests for match-mode rules and the AI. Run: node scripts/test_match.mjs
import assert from 'assert'
import { reducer, initialMatchState } from '../src/engine/reducer.js'
import { makeCard, makeSlot } from '../src/engine/cards.js'
import { enumerateActions } from '../src/engine/actions.js'
import { maskStateFor } from '../src/engine/view.js'
import { AI_POLICIES, aiNeedsToAct } from '../src/ai/index.js'

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

function giveHand(state, player, names) {
  return { ...state, [player]: { ...state[player], hand: names.map(makeCard) } }
}

// A match already past setup, at the given turn, p1 to act.
function playing(turnNumber = 3) {
  let s = initialMatchState({})
  return {
    ...s,
    phase: 'playing',
    setupDone: { p1: true, p2: true },
    turnPlayer: 'p1',
    turnNumber,
    turnFlags: { energyAttached: false, retreated: false, powersUsed: {} },
  }
}

const active = (s, p) => s[p].mon[0]
const attack = (s, name) => reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: name })

// --- setup ---
test('match setup: 7-card hands, 6 prizes, 60-card total', () => {
  const s = initialMatchState({})
  for (const p of ['p1', 'p2']) {
    assert.ok(s[p].hand.length >= 7, 'opening hand of at least 7 (mulligan bonus possible)')
    assert.equal(s[p].prizes.length, 6, 'six prizes set aside')
    assert.equal(s[p].hand.length + s[p].deck.length + s[p].prizes.length, 60, 'full deck accounted for')
    assert.ok(s[p].hand.some((c) => c.supertype === 'pokemon' && c.stage === 'basic'), 'mulligans resolved: hand has a basic')
  }
  assert.equal(s.phase, 'setup')
})

test('setup flow: place actives, ready up, coin flip starts play with a draw', () => {
  let s = initialMatchState({})
  for (const p of ['p1', 'p2']) {
    const basic = s[p].hand.find((c) => c.supertype === 'pokemon' && c.stage === 'basic')
    s = reducer(s, { type: 'drop', source: { player: p, from: 'hand', uid: basic.uid }, dest: { player: p, id: 0 } })
    assert.ok(s[p].mon[0], `${p} active placed`)
  }
  // can't attack during setup
  const before = s
  s = reducer(s, { type: 'attack', player: 'p1', id: 0, attackName: s.p1.mon[0].attacks?.[0]?.name })
  assert.equal(s.p1.mon[0].dc, before.p1.mon[0].dc, 'attacks blocked during setup')

  const handBefore = { p1: s.p1.hand.length, p2: s.p2.hand.length }
  s = reducer(s, { type: 'setup-done', player: 'p1' })
  assert.equal(s.phase, 'setup', 'still waiting for p2')
  Math.random = HEADS // p1 wins the opening flip
  s = reducer(s, { type: 'setup-done', player: 'p2' })
  Math.random = realRandom
  assert.equal(s.phase, 'playing')
  assert.equal(s.turnPlayer, 'p1')
  assert.equal(s.turnNumber, 1)
  assert.equal(s.p1.hand.length, handBefore.p1 + 1, 'first player auto-drew')
})

test('setup rejects non-basic placements', () => {
  let s = initialMatchState({})
  s = giveHand(s, 'p1', ['Wartortle', 'Water Energy', 'Squirtle'])
  const [wartortle, energy, squirtle] = s.p1.hand
  const drop = (uid, id = 0) => reducer(s, { type: 'drop', source: { player: 'p1', from: 'hand', uid }, dest: { player: 'p1', id } })
  assert.equal(drop(wartortle.uid).p1.mon[0], null, 'stage-1 rejected')
  assert.equal(drop(energy.uid).p1.mon[0], null, 'energy rejected')
  assert.ok(drop(squirtle.uid).p1.mon[0], 'basic accepted')
})

// --- turn ownership ---
test('actions from the wrong player are rejected', () => {
  let s = playing()
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Chansey', ['Psychic Energy'])
  let t = reducer(s, { type: 'attack', player: 'p2', id: 0, attackName: 'Scrunch' })
  assert.equal(t.turnPlayer, 'p1', 'turn unchanged')
  assert.equal(active(t, 'p1').dc ?? 0, 0, 'no damage from off-turn attack')
  t = reducer(s, { type: 'end-turn', actor: 'p2' })
  assert.equal(t.turnPlayer, 'p1', 'p2 cannot end p1 turn')
  t = reducer(s, { type: 'end-turn', actor: 'p1' })
  assert.equal(t.turnPlayer, 'p2', 'p1 can end own turn')
})

test('manual deck draws are blocked in a match', () => {
  let s = playing()
  const before = s.p1.hand.length
  s = reducer(s, { type: 'draw', player: 'p1' })
  assert.equal(s.p1.hand.length, before)
})

// --- once-per-turn limits ---
test('only one energy attach per turn', () => {
  let s = playing()
  s = place(s, 'p1', 0, 'Charmander')
  s = place(s, 'p2', 0, 'Chansey')
  s = giveHand(s, 'p1', ['Fire Energy', 'Fire Energy'])
  const [e1, e2] = s.p1.hand
  s = reducer(s, { type: 'drop', source: { player: 'p1', from: 'hand', uid: e1.uid }, dest: { player: 'p1', id: 0 } })
  assert.equal(active(s, 'p1').energyAttached.length, 1)
  s = reducer(s, { type: 'drop', source: { player: 'p1', from: 'hand', uid: e2.uid }, dest: { player: 'p1', id: 0 } })
  assert.equal(active(s, 'p1').energyAttached.length, 1, 'second attach rejected')
  s = reducer(s, { type: 'end-turn', actor: 'p1' })
  s = reducer(s, { type: 'end-turn', actor: 'p2' })
  s = reducer(s, { type: 'drop', source: { player: 'p1', from: 'hand', uid: e2.uid }, dest: { player: 'p1', id: 0 } })
  assert.equal(active(s, 'p1').energyAttached.length, 2, 'attach allowed again next turn')
})

test('Rain Dance allows extra water attaches to water pokemon', () => {
  let s = playing()
  s = place(s, 'p1', 0, 'Squirtle')
  s = place(s, 'p1', 1, 'Blastoise')
  s = place(s, 'p1', 2, 'Charmander')
  s = place(s, 'p2', 0, 'Chansey')
  s = giveHand(s, 'p1', ['Water Energy', 'Water Energy', 'Fire Energy'])
  const [w1, w2, f1] = s.p1.hand
  const drop = (st, uid, id) => reducer(st, { type: 'drop', source: { player: 'p1', from: 'hand', uid }, dest: { player: 'p1', id } })
  s = drop(s, w1.uid, 0)
  s = drop(s, w2.uid, 0)
  assert.equal(active(s, 'p1').energyAttached.length, 2, 'two water attaches via Rain Dance')
  s = drop(s, f1.uid, 2)
  assert.equal(s.p1.mon[2].energyAttached.length, 1, 'regular attach still available')
  s = giveHand(s, 'p1', ['Fire Energy', 'Water Energy'])
  const [f2, w3] = s.p1.hand
  s = drop(s, f2.uid, 2)
  assert.equal(s.p1.mon[2].energyAttached.length, 1, 'second regular attach rejected')
  s = drop(s, w3.uid, 0)
  assert.equal(active(s, 'p1').energyAttached.length, 3, 'Rain Dance attach still allowed')
})

test('retreat only once per turn', () => {
  let s = playing()
  s = place(s, 'p1', 0, 'Gastly') // free retreat
  s = place(s, 'p1', 1, 'Abra')
  s = place(s, 'p1', 2, 'Machop')
  s = place(s, 'p2', 0, 'Chansey')
  s = reducer(s, { type: 'retreat', player: 'p1' })
  assert.equal(s.pending?.what, 'pokemon', 'choose the new active')
  s = reducer(s, { type: 'click', player: 'p1', id: 1, actor: 'p1' })
  assert.equal(active(s, 'p1').name, 'Abra')
  s = reducer(s, { type: 'retreat', player: 'p1' })
  assert.equal(s.pending, null, 'second retreat rejected')
  assert.equal(active(s, 'p1').name, 'Abra')
})

test('first player cannot attack on turn 1', () => {
  let s = playing(1)
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Chansey')
  s = attack(s, 'Low Kick')
  assert.equal(active(s, 'p2').dc ?? 0, 0, 'attack blocked on turn 1')
  assert.equal(s.turnPlayer, 'p1', 'turn not consumed')
})

// --- evolution timing ---
test('no evolution on either player first turn or same-turn plays', () => {
  let s = playing(2) // p2's first turn... but p1 acting; either way turnNumber <= 2 blocks
  s = place(s, 'p1', 0, 'Squirtle')
  s = place(s, 'p2', 0, 'Chansey')
  s = giveHand(s, 'p1', ['Wartortle'])
  const evo = s.p1.hand[0]
  const drop = (st) => reducer(st, { type: 'drop', source: { player: 'p1', from: 'hand', uid: evo.uid }, dest: { player: 'p1', id: 0 } })
  assert.equal(drop(s).p1.mon[0].name, 'Squirtle', 'blocked on turn 2')

  s = { ...s, turnNumber: 3 }
  assert.equal(drop(s).p1.mon[0].name, 'Wartortle', 'allowed on turn 3')

  // a basic played this turn cannot evolve this turn
  let t = { ...s, turnNumber: 5 }
  t = giveHand(t, 'p1', ['Squirtle', 'Wartortle'])
  const [sq, wt] = t.p1.hand
  t = reducer(t, { type: 'drop', source: { player: 'p1', from: 'hand', uid: sq.uid }, dest: { player: 'p1', id: 1 } })
  t = reducer(t, { type: 'drop', source: { player: 'p1', from: 'hand', uid: wt.uid }, dest: { player: 'p1', id: 1 } })
  assert.equal(t.p1.mon[1].name, 'Squirtle', 'same-turn evolution blocked')
})

// --- Pokemon Breeder ---
test('Breeder evolves a Basic played on a previous turn', () => {
  let s = playing(5)
  s = place(s, 'p1', 0, 'Machop')
  s = place(s, 'p1', 1, 'Weedle') // turnPlayed 0
  s = place(s, 'p2', 0, 'Chansey')
  s = giveHand(s, 'p1', ['Pokémon Breeder', 'Beedrill'])
  const [breeder, beedrill] = s.p1.hand
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: breeder.uid })
  assert.equal(s.pending?.what, 'cards', 'choose the Stage 2')
  s = reducer(s, { type: 'resolve-choice', actor: 'p1', payload: { uids: [beedrill.uid] } })
  assert.equal(s.pending?.what, 'pokemon', 'choose the Basic')
  s = reducer(s, { type: 'click', player: 'p1', id: 1, actor: 'p1' })
  assert.equal(s.p1.mon[1].name, 'Beedrill', 'Weedle evolved straight to Beedrill')
  assert.ok(s.p1.mon[1].prevStack.some((c) => c.name === 'Weedle'), 'Weedle underneath')
  assert.ok(s.p1.discard.some((c) => c.name === 'Pokémon Breeder'), 'Breeder discarded')
})

test('Breeder is not consumed when the Basic entered play this turn', () => {
  let s = playing(10)
  s = place(s, 'p1', 0, 'Machop')
  s = place(s, 'p1', 1, 'Weedle')
  // Weedle was just Revived / played this turn
  s = { ...s, p1: { ...s.p1, mon: s.p1.mon.map((m, i) => (i === 1 ? { ...m, turnPlayed: 10 } : m)) } }
  s = place(s, 'p2', 0, 'Chansey')
  s = giveHand(s, 'p1', ['Pokémon Breeder', 'Beedrill'])
  const breeder = s.p1.hand[0]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: breeder.uid })
  assert.equal(s.pending, null, 'no choice started')
  assert.ok(s.p1.hand.some((c) => c.uid === breeder.uid), 'Breeder stays in hand')
  assert.equal(s.p1.mon[1].name, 'Weedle', 'nothing evolved')
})

test('trainers with no possible effect stay in hand', () => {
  let s = playing(5)
  s = place(s, 'p1', 0, 'Charmander') // undamaged
  s = place(s, 'p2', 0, 'Chansey')
  s = giveHand(s, 'p1', ['Potion'])
  const potion = s.p1.hand[0]
  s = reducer(s, { type: 'play-trainer', player: 'p1', uid: potion.uid })
  assert.equal(s.pending, null)
  assert.ok(s.p1.hand.some((c) => c.uid === potion.uid), 'Potion stays in hand')
  assert.ok(!s.p1.discard.some((c) => c.name === 'Potion'), 'Potion not wasted')
})

// --- attack ends turn, prizes, promotion ---
test('attack resolves, KO awards a prize, loser promotes, turn ends', () => {
  let s = playing(3)
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Voltorb') // 40 HP, fighting weakness: 20x2 = KO
  s = place(s, 'p2', 1, 'Chansey')
  s = attack(s, 'Low Kick')
  assert.equal(active(s, 'p2'), null, 'Voltorb KOd')
  assert.equal(s.pending?.what, 'prize')
  assert.equal(s.pending.chooserPlayer, 'p1')
  const handBefore = s.p1.hand.length
  s = reducer(s, { type: 'resolve-choice', actor: 'p1', payload: { index: 0 } })
  assert.equal(s.p1.hand.length, handBefore + 1, 'prize into hand')
  assert.equal(s.p1.prizes.length, 5)
  assert.equal(s.pending?.promote, true, 'p2 must promote')
  assert.equal(s.pending.chooserPlayer, 'p2')
  s = reducer(s, { type: 'click', player: 'p2', id: 1, actor: 'p2' })
  assert.equal(active(s, 'p2').name, 'Chansey', 'promoted from bench')
  assert.equal(s.turnPlayer, 'p2', 'attack ended p1 turn after everything settled')
})

test('attack ends the turn even without a KO', () => {
  let s = playing(3)
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Chansey')
  const p2Hand = s.p2.hand.length
  s = attack(s, 'Low Kick')
  assert.equal(s.turnPlayer, 'p2')
  assert.equal(s.p2.hand.length, p2Hand + 1, 'p2 auto-drew for their turn')
})

// --- win conditions ---
test('win by taking all prizes', () => {
  let s = playing(3)
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Voltorb')
  s = place(s, 'p2', 1, 'Chansey')
  s = { ...s, p1: { ...s.p1, prizes: s.p1.prizes.slice(0, 1) } } // one prize left
  s = attack(s, 'Low Kick')
  s = reducer(s, { type: 'resolve-choice', actor: 'p1', payload: { index: 0 } })
  assert.equal(s.phase, 'gameover')
  assert.equal(s.winner, 'p1')
})

test('win when opponent has no pokemon in play', () => {
  let s = playing(3)
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Voltorb') // no bench
  s = attack(s, 'Low Kick')
  assert.equal(s.phase, 'gameover')
  assert.equal(s.winner, 'p1')
  assert.match(s.winReason, /no Pokémon/)
})

test('win when opponent cannot draw at turn start', () => {
  let s = playing(3)
  s = place(s, 'p1', 0, 'Machop')
  s = place(s, 'p2', 0, 'Chansey')
  s = { ...s, p2: { ...s.p2, deck: [] } }
  s = reducer(s, { type: 'end-turn', actor: 'p1' })
  assert.equal(s.phase, 'gameover')
  assert.equal(s.winner, 'p1')
  assert.match(s.winReason, /draw/)
})

// --- masking ---
test('maskStateFor hides opponent hand and both decks/prizes', () => {
  const s = playing(3)
  const v = maskStateFor(s, 'p1')
  assert.ok(v.p2.hand.every((c) => c.hidden && !c.name), 'opponent hand hidden')
  assert.ok(v.p1.hand.every((c) => c.name), 'own hand visible')
  assert.ok(v.p1.deck.every((c) => c.hidden), 'own deck hidden')
  assert.ok(v.p1.prizes.every((c) => c.hidden), 'own prizes hidden')
  assert.ok(v.p2.prizes.every((c) => c.hidden), 'opponent prizes hidden')
  assert.equal(v.p2.hand.length, s.p2.hand.length, 'counts preserved')
})

// --- enumerateActions sanity ---
test('enumerateActions respects ownership and pendings', () => {
  let s = playing(3)
  s = place(s, 'p1', 0, 'Machop', ['Fighting Energy'])
  s = place(s, 'p2', 0, 'Chansey')
  assert.equal(enumerateActions(s, 'p2').length, 0, 'off-turn player has no actions')
  const acts = enumerateActions(s, 'p1')
  assert.ok(acts.some((a) => a.type === 'attack' && a.attackName === 'Low Kick'))
  assert.ok(acts.some((a) => a.type === 'end-turn'))

  s = place(s, 'p2', 1, 'Abra')
  s = attack(s, 'Seismic Toss') // no KO (Chansey 120hp, 60x2... actually 120 exactly)
  // whatever pendings arise must be answerable by their chooser
  let guard = 0
  while (s.pending && guard++ < 10) {
    const chooser = s.pending.chooserPlayer
    const answers = enumerateActions(s, chooser)
    assert.ok(answers.length > 0, `chooser ${chooser} has answers for ${s.pending.what}`)
    s = reducer(s, answers[0])
  }
  assert.equal(s.pending, null)
})

// --- AI vs AI ---
function runAiGame(policyId, maxSteps = 4000) {
  const policy = AI_POLICIES[policyId]
  let s = initialMatchState({ p1DeckId: 'blazeSurf', p2DeckId: 'boltFist' })
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
      // fall back to ending the turn / first action
      s = reducer(s, actions.find((a) => a.type === 'end-turn') ?? actions[0])
    } else {
      stuck = 0
      s = next
    }
  }
  if (s.phase !== 'gameover') throw new Error(`game did not finish in ${maxSteps} steps (turn ${s.turnNumber})`)
  return s
}

test('BasicAI vs BasicAI plays to completion', () => {
  const s = runAiGame('basic')
  assert.ok(['p1', 'p2'].includes(s.winner))
  assert.ok(s.winReason, 'has a reason')
})

test('RandomAI vs RandomAI plays to completion', () => {
  const s = runAiGame('random', 8000)
  assert.ok(['p1', 'p2'].includes(s.winner))
})

console.log(`\n${passed} tests passed`)

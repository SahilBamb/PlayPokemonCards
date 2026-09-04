// Headless tests for Story Mode: booster packs, the profile store (collection
// cap + dupe refunds, coins, progression/badges/trophy), story deck data, the
// trainer deck generator, and format filtering. Run: node scripts/test_story.mjs
import assert from 'assert'
import fs from 'fs'
import { byName } from '../src/engine/cards.js'
import { validateDeck } from '../src/lib/deckStore.js'
import { FORMATS, SETS } from '../src/data/sets.js'
import { STORIES, storyFormat, findNode } from '../src/data/stories.js'
import { BOSS_DECKS, generateTrainerDeck, countsToList } from '../src/data/storyDecks.js'
import { BOOSTER_PACKS, SUB_PACKS, subPacksForStory, openPack, packPool, DUPE_REFUND } from '../src/data/boosters.js'
import {
  emptyProfile,
  addToCollection,
  buyPack,
  openOwnedPack,
  rollPromoOffer,
  rollSubOffer,
  chooseStarter,
  storyState,
  recordBattle,
  areaUnlocked,
  nodeUnlocked,
  COLLECTION_CAP,
} from '../src/lib/profileStore.js'
import { AI_POLICIES } from '../src/ai/index.js'

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

const KANTO = STORIES.kanto
const seededRng = (seed = 42) => {
  let a = seed
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296
    return a / 4294967296
  }
}

// --- booster packs -----------------------------------------------------------

test('regular packs contain 5 cards: 3 commons, 1 uncommon, 1 rare(ish)', () => {
  for (const packId of ['base1', 'jungle', 'fossil', 'rocket', 'gym1', 'gym2']) {
    const pack = BOOSTER_PACKS[packId]
    const rng = seededRng(7)
    for (let i = 0; i < 20; i++) {
      const names = openPack(pack, rng)
      assert.equal(names.length, 5, `${packId} pack has 5 cards`)
      const rarities = names.map((n) => byName[n].rarity)
      assert.equal(rarities.filter((r) => r === 'Common').length, 3, '3 commons')
      assert.equal(rarities.filter((r) => r === 'Uncommon').length, 1, '1 uncommon')
      assert.ok(['Rare', 'Rare Holo', 'Rare Secret'].includes(rarities[4]), 'last card is the rare slot')
      for (const n of names) {
        assert.equal(byName[n].set, pack.setId, `${n} belongs to ${pack.setId}`)
        assert.notEqual(byName[n].supertype, 'energy', 'packs never contain basic energy')
      }
    }
  }
})

test('sub-packs pull only from their slice of the parent set', () => {
  for (const pack of Object.values(SUB_PACKS)) {
    // every rarity tier the slots need is non-empty for this slice
    const pool = packPool(pack.setId, pack.filter)
    assert.ok(pool.Common?.length, `${pack.id} has commons`)
    assert.ok(pool.Uncommon?.length, `${pack.id} has uncommons`)
    assert.ok((pool.Rare?.length ?? 0) + (pool['Rare Holo']?.length ?? 0) > 0, `${pack.id} has a rare tier`)
    const rng = seededRng(13)
    for (let i = 0; i < 10; i++) {
      const names = openPack(pack, rng)
      assert.equal(names.length, 5, `${pack.id} pack has 5 cards`)
      for (const n of names) {
        const card = byName[n]
        assert.equal(card.set, pack.setId, `${pack.id}: ${n} from the parent set`)
        if (pack.filter.trainers) assert.equal(card.supertype, 'trainer', `${pack.id}: ${n} is a trainer`)
        if (pack.filter.types) {
          assert.ok(pack.filter.types.includes(card.type), `${pack.id}: ${n} (${card.type}) matches the theme`)
        }
      }
    }
    assert.ok(pack.sub, `${pack.id} flagged as a sub-pack`)
    assert.ok(pack.price > BOOSTER_PACKS[pack.setId].price, `${pack.id} costs more than the plain booster`)
    const parentLabel = SETS[pack.setId].label
    assert.ok(pack.name.startsWith(parentLabel), `${pack.id} name prefixed with ${parentLabel}`)
  }
})

test('sub-pack shop event: uncommon roll, more common than promo, sticks until bought', () => {
  assert.ok(KANTO.subPackEvent.chance > KANTO.promoEvent.chance, 'sub-packs restock more often than promos')
  const options = subPacksForStory(KANTO)
  assert.ok(options.length >= 6, 'kanto has themed packs for all three sets')

  let profile = emptyProfile()
  profile = rollSubOffer(profile, KANTO, () => 0.99)
  assert.equal(profile.subOffer, null, 'no offer on a bad roll')
  profile = rollSubOffer(profile, KANTO, () => 0.01)
  assert.ok(profile.subOffer?.packId, 'offer appears on a lucky roll')
  const offered = SUB_PACKS[profile.subOffer.packId]
  assert.ok(offered, 'offer references a real sub-pack')
  const again = rollSubOffer(profile, KANTO, () => 0.01)
  assert.equal(again, profile, 'existing offer is not re-rolled')

  const bought = buyPack({ ...profile, coins: 500 }, offered)
  assert.equal(bought.subOffer, null, 'buying consumes the offer')
  assert.equal(bought.packs[offered.id], 1, 'sub-pack stocked')
  assert.equal(bought.coins, 500 - offered.price, 'sub-pack price paid')
  const opened = openOwnedPack(bought, offered, seededRng(21))
  assert.equal(opened.names.length, 5, 'owned sub-pack opens after the offer is gone')
})

test('promo pack yields exactly 1 promo card', () => {
  const rng = seededRng(3)
  for (let i = 0; i < 10; i++) {
    const names = openPack(BOOSTER_PACKS.promoPack, rng)
    assert.equal(names.length, 1)
    assert.equal(byName[names[0]].set, 'promo')
  }
})

test('pack pools cover every non-energy card of the set', () => {
  const pool = packPool('jungle')
  const total = Object.values(pool).reduce((a, l) => a + l.length, 0)
  const expected = Object.values(byName).filter((c) => c.set === 'jungle' && c.supertype !== 'energy').length
  assert.equal(total, expected, 'jungle pool complete')
})

// --- collection + dupes --------------------------------------------------------

test('collection caps at 4 copies and refunds dupes by rarity', () => {
  let profile = emptyProfile()
  const six = Array(6).fill('Charizard') // Rare Holo
  const res = addToCollection(profile, six)
  assert.equal(res.profile.collection['Charizard'], COLLECTION_CAP, 'capped at 4')
  assert.equal(res.refunded['Charizard'], 2, '2 extras refunded')
  assert.equal(res.refund, 2 * DUPE_REFUND['Rare Holo'], 'refund uses holo rate')
  assert.equal(res.profile.coins, res.refund, 'coins credited')
})

test('basic energy never enters the collection', () => {
  const res = addToCollection(emptyProfile(), ['Fire Energy', 'Fire Energy', 'Pikachu'])
  assert.equal(res.profile.collection['Fire Energy'], undefined)
  assert.equal(res.profile.collection['Pikachu'], 1)
})

test('buyPack spends coins and stocks the pack; opening adds to collection', () => {
  let profile = { ...emptyProfile(), coins: 250 }
  const pack = BOOSTER_PACKS.base1
  profile = buyPack(profile, pack)
  assert.equal(profile.coins, 150, 'price deducted')
  assert.equal(profile.packs.base1, 1, 'pack stocked')
  assert.equal(buyPack({ ...profile, coins: 10 }, pack), null, 'cannot afford')

  const res = openOwnedPack(profile, pack, seededRng(11))
  assert.equal(res.names.length, 5)
  assert.equal(res.profile.packs.base1, 0, 'pack consumed')
  const totalOwned = Object.values(res.profile.collection).reduce((a, b) => a + b, 0)
  assert.equal(totalOwned + Object.values(res.refunded).reduce((a, b) => a + b, 0), 5, 'all 5 accounted for')
  assert.equal(openOwnedPack(res.profile, pack), null, 'cannot open a pack you do not own')
})

test('promo shop event: rare roll sticks until bought', () => {
  let profile = emptyProfile()
  profile = rollPromoOffer(profile, KANTO, () => 0.99)
  assert.equal(profile.promoOffer, null, 'no offer on a bad roll')
  profile = rollPromoOffer(profile, KANTO, () => 0.01)
  assert.equal(profile.promoOffer.packId, 'promoPack', 'offer appears on a lucky roll')
  const again = rollPromoOffer(profile, KANTO, () => 0.01)
  assert.equal(again, profile, 'existing offer is not re-rolled')
  const bought = buyPack({ ...profile, coins: 500 }, BOOSTER_PACKS.promoPack)
  assert.equal(bought.promoOffer, null, 'buying consumes the offer')
  assert.equal(bought.packs.promoPack, 1)
})

// --- story data ----------------------------------------------------------------

test('every story: starter decks are 60 cards and legal for the collection they grant', () => {
  for (const story of Object.values(STORIES)) {
    for (const starter of story.starterDecks) {
      const problems = validateDeck(starter.counts, null, storyFormat(story))
      assert.deepEqual(problems, [], `${story.id}/${starter.name}: ${problems.join(' | ')}`)
      // after choosing it, the deck must validate against the granted collection
      const profile = chooseStarter(emptyProfile(), story, starter, 'deck-x')
      const withCollection = validateDeck(starter.counts, profile.collection, storyFormat(story))
      assert.deepEqual(withCollection, [], `${story.id}/${starter.name} vs own collection: ${withCollection.join(' | ')}`)
    }
  }
})

test('every story: node decks are 60 cards and legal in the story format', () => {
  const referenced = new Set()
  for (const story of Object.values(STORIES)) {
    for (const area of story.areas) {
      for (const node of area.nodes) {
        assert.ok(AI_POLICIES[node.aiId], `${node.id} has a registered AI (${node.aiId})`)
        assert.ok(node.char.name, `${node.id} has a name`)
        assert.ok(node.char.image, `${node.id} has a portrait`)
        assert.ok(node.dialogue.intro.length && node.dialogue.win.length && node.dialogue.lose.length, `${node.id} dialogue complete`)
        if (node.deck.boss) {
          assert.ok(BOSS_DECKS[node.deck.boss], `${node.id}: boss deck ${node.deck.boss} exists`)
          referenced.add(node.deck.boss)
        }
        const counts = node.deck.boss
          ? BOSS_DECKS[node.deck.boss]
          : generateTrainerDeck(node.deck.gen.types, node.deck.gen.tier, node.id, storyFormat(story))
        const problems = validateDeck(counts, null, storyFormat(story))
        assert.deepEqual(problems, [], `${story.id}/${node.id}: ${problems.join(' | ')}`)
      }
    }
  }
  // no orphaned hand-authored decks
  for (const id of Object.keys(BOSS_DECKS)) {
    assert.ok(referenced.has(id), `boss deck ${id} is used by some story node`)
  }
})

test('every story has a multi-speaker intro and a cutscene on each area', () => {
  for (const story of Object.values(STORIES)) {
    assert.ok(Array.isArray(story.intro) && story.intro.length >= 4, `${story.id} intro is too short`)
    const speakers = new Set(story.intro.map((b) => b.name))
    assert.ok(speakers.size >= 2, `${story.id} intro needs more than one speaker`)
    for (const [i, beat] of story.intro.entries()) {
      assert.ok(beat.name && beat.text, `${story.id} intro beat ${i} needs name + text`)
    }
    for (const area of story.areas) {
      assert.ok(Array.isArray(area.cutscene) && area.cutscene.length >= 3, `${story.id}/${area.id} cutscene missing`)
      const who = new Set(area.cutscene.map((b) => b.name))
      assert.ok(who.size >= 2, `${story.id}/${area.id} cutscene needs a back-and-forth`)
      for (const [i, beat] of area.cutscene.entries()) {
        assert.ok(beat.name && beat.text, `${story.id}/${area.id} beat ${i} needs name + text`)
        if (beat.image?.startsWith('/')) {
          assert.ok(fs.existsSync('public' + beat.image), `${story.id}/${area.id}: missing portrait ${beat.image}`)
        }
      }
    }
  }
})

test('every story: node ids are unique and local portraits exist on disk', () => {
  const seen = new Set()
  for (const story of Object.values(STORIES)) {
    for (const area of story.areas) {
      for (const node of area.nodes) {
        assert.ok(!seen.has(node.id), `duplicate node id ${node.id}`)
        seen.add(node.id)
        if (node.char.image?.startsWith('/')) {
          assert.ok(fs.existsSync('public' + node.char.image), `${node.id}: missing image ${node.char.image}`)
        }
      }
    }
  }
  const rocket = STORIES.rocket
  for (const src of [rocket.cover, rocket.shopkeeper.image]) {
    assert.ok(fs.existsSync('public' + src), `missing story asset ${src}`)
  }
})

test('trainer deck generator is deterministic per seed and legal across tiers', () => {
  const a = generateTrainerDeck(['water'], 2, 'seed-1')
  const b = generateTrainerDeck(['water'], 2, 'seed-1')
  const c = generateTrainerDeck(['water'], 2, 'seed-2')
  assert.deepEqual(a, b, 'same seed, same deck')
  assert.notDeepEqual(a, c, 'different seed, different deck')
  for (const tier of [1, 2, 3]) {
    for (const types of [['fire'], ['psychic', 'colorless'], ['grass', 'water']]) {
      const counts = generateTrainerDeck(types, tier, `t${tier}`)
      const problems = validateDeck(counts, null, FORMATS.classic)
      assert.deepEqual(problems, [], `tier ${tier} ${types}: ${problems.join(' | ')}`)
    }
  }
  // tier 1 keeps rares and holos out
  const t1 = generateTrainerDeck(['lightning'], 1, 'low')
  for (const name of Object.keys(t1)) {
    const card = byName[name]
    if (card.supertype === 'pokemon') assert.ok(['Common', 'Uncommon'].includes(card.rarity), `tier1 pulled ${name} (${card.rarity})`)
  }
})

// --- progression -----------------------------------------------------------------

test('areas unlock in order; nodes unlock left to right', () => {
  const state = { ...storyState(emptyProfile(), 'kanto') }
  assert.ok(areaUnlocked(KANTO, state, 0), 'first area open')
  assert.ok(!areaUnlocked(KANTO, state, 1), 'second area locked')
  assert.ok(nodeUnlocked(KANTO, state, 0, 0), 'first node open')
  assert.ok(!nodeUnlocked(KANTO, state, 0, 1), 'second node locked')
  state.beaten = KANTO.areas[0].nodes.slice(0, 1).map((n) => n.id)
  assert.ok(nodeUnlocked(KANTO, state, 0, 1), 'second node opens after first win')
  state.beaten = KANTO.areas[0].nodes.map((n) => n.id)
  assert.ok(areaUnlocked(KANTO, state, 1), 'second area opens once the first is cleared')
})

test('recordBattle pays coins, awards the badge on area clear, trophy at the end', () => {
  let profile = emptyProfile()
  const area = KANTO.areas[0]
  // beat everything except the boss
  for (const node of area.nodes.slice(0, -1)) {
    const res = recordBattle(profile, KANTO, node, true)
    assert.equal(res.profile.coins, profile.coins + node.rewards.win, 'win coins paid')
    assert.equal(res.awards.badge, null, 'no badge mid-area')
    profile = res.profile
  }
  const bossNode = area.nodes[area.nodes.length - 1]
  const loss = recordBattle(profile, KANTO, bossNode, false)
  assert.equal(loss.profile.coins, profile.coins + bossNode.rewards.lose, 'consolation coins on a loss')
  assert.ok(!storyState(loss.profile, 'kanto').beaten.includes(bossNode.id), 'loss does not beat the node')

  const win = recordBattle(profile, KANTO, bossNode, true)
  assert.ok(win.awards.badge, 'badge awarded with the area clear')
  assert.equal(win.awards.badge.name, area.badge.name)
  assert.equal(win.profile.coins, profile.coins + bossNode.rewards.win + KANTO.badgeBonus, 'badge bonus added')
  assert.ok(areaUnlocked(KANTO, storyState(win.profile, 'kanto'), 1), 'next area unlocked')

  // repeat win: coins again, but no second badge / first-clear
  const repeat = recordBattle(win.profile, KANTO, bossNode, true)
  assert.equal(repeat.awards.badge, null, 'no duplicate badge')
  assert.ok(!repeat.awards.firstClear, 'not a first clear')
  assert.equal(repeat.profile.coins, win.profile.coins + bossNode.rewards.win, 'repeat wins still pay')
})

test('clearing the final area awards the trophy', () => {
  let profile = emptyProfile()
  // mark everything beaten except the champion
  const allButLast = KANTO.areas.flatMap((a) => a.nodes.map((n) => n.id))
  const champ = findNode(KANTO, 'indigo-boss').node
  profile = {
    ...profile,
    stories: { kanto: { ...storyState(profile, 'kanto'), beaten: allButLast.filter((id) => id !== champ.id) } },
  }
  const res = recordBattle(profile, KANTO, champ, true)
  assert.ok(res.awards.trophy, 'trophy awarded')
  assert.ok(storyState(res.profile, 'kanto').trophy, 'trophy persisted')
})

test('chooseStarter grants cards, coins, and marks the story started', () => {
  const starter = KANTO.starterDecks[0]
  const profile = chooseStarter(emptyProfile(), KANTO, starter, 'deck-1')
  assert.equal(profile.coins, KANTO.startingCoins, 'starting coins granted')
  const state = storyState(profile, 'kanto')
  assert.equal(state.starterDeckId, starter.id)
  assert.equal(state.activeDeckId, 'deck-1')
  assert.equal(profile.collection['Squirtle'], 4, 'starter cards in collection')
  assert.equal(profile.collection['Water Energy'], undefined, 'energy not tracked')
})

// --- format filtering --------------------------------------------------------------

test('format validation rejects off-format cards and collection shortages', () => {
  const classic = FORMATS.classic
  const counts = { Pikachu: 4, 'Lightning Energy': 56 }
  assert.deepEqual(validateDeck(counts, null, classic), [], 'classic deck fine')
  const tinyCollection = { Pikachu: 2 }
  const problems = validateDeck(counts, tinyCollection, classic)
  assert.ok(problems.some((p) => p.includes('only own 2')), 'collection shortage reported')
  assert.ok(!problems.some((p) => p.includes('Lightning Energy')), 'basic energy exempt from ownership')
})

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`)

// The single story-mode profile: coin wallet, card collection, unopened
// packs, and per-story progress. Collection and coins are shared across all
// Stories; each story only filters what is visible/legal via its format.
// Pure helpers + localStorage persistence (memory fallback for node tests).
import { byName } from '../engine/cards.js'
import { openPack, subPacksForStory, DUPE_REFUND } from '../data/boosters.js'
import { isBasicEnergy } from './deckStore.js'

const KEY = 'ppc-profile'
export const COLLECTION_CAP = 4

const memory = (() => {
  let m = {}
  return {
    getItem: (k) => m[k] ?? null,
    setItem: (k, v) => {
      m[k] = v
    },
    removeItem: (k) => {
      delete m[k]
    },
  }
})()
const store = typeof localStorage !== 'undefined' ? localStorage : memory

export const emptyProfile = () => ({
  coins: 0,
  collection: {},
  packs: {},
  promoOffer: null,
  subOffer: null,
  stories: {},
})

export function loadProfile() {
  try {
    const p = JSON.parse(store.getItem(KEY))
    return p && typeof p === 'object' ? { ...emptyProfile(), ...p } : emptyProfile()
  } catch {
    return emptyProfile()
  }
}

export function saveProfile(profile) {
  store.setItem(KEY, JSON.stringify(profile))
  return profile
}

export function resetProfile() {
  store.removeItem(KEY)
  return emptyProfile()
}

export const emptyStoryState = () => ({
  starterDeckId: null,
  activeDeckId: null,
  beaten: [],
  badges: [],
  trophy: false,
})

export const storyState = (profile, storyId) => ({ ...emptyStoryState(), ...(profile.stories[storyId] ?? {}) })

function withStory(profile, storyId, patch) {
  return {
    ...profile,
    stories: { ...profile.stories, [storyId]: { ...storyState(profile, storyId), ...patch } },
  }
}

// --- collection ---------------------------------------------------------------

// Add pulled/starter cards to the collection. Copies past the 4-cap are
// redeemed for coins by rarity. Basic energy is never tracked (it's free).
export function addToCollection(profile, names) {
  const collection = { ...profile.collection }
  const kept = {}
  const refunded = {}
  let refund = 0
  for (const name of names) {
    if (isBasicEnergy(name)) continue
    const owned = collection[name] ?? 0
    if (owned >= COLLECTION_CAP) {
      const coins = DUPE_REFUND[byName[name]?.rarity] ?? DUPE_REFUND.Common
      refunded[name] = (refunded[name] ?? 0) + 1
      refund += coins
    } else {
      collection[name] = owned + 1
      kept[name] = (kept[name] ?? 0) + 1
    }
  }
  return {
    profile: { ...profile, collection, coins: profile.coins + refund },
    kept,
    refunded,
    refund,
  }
}

// --- shop ----------------------------------------------------------------------

export function buyPack(profile, pack) {
  if (profile.coins < pack.price) return null
  let next = {
    ...profile,
    coins: profile.coins - pack.price,
    packs: { ...profile.packs, [pack.id]: (profile.packs[pack.id] ?? 0) + 1 },
  }
  // buying a limited offer consumes it
  if (pack.promo) next = { ...next, promoOffer: null }
  if (pack.sub) next = { ...next, subOffer: null }
  return next
}

// Open one owned pack: rolls contents, adds them to the collection.
export function openOwnedPack(profile, pack, rng = Math.random) {
  if (!(profile.packs[pack.id] > 0)) return null
  const names = openPack(pack, rng)
  const withoutPack = {
    ...profile,
    packs: { ...profile.packs, [pack.id]: profile.packs[pack.id] - 1 },
  }
  const result = addToCollection(withoutPack, names)
  return { ...result, names }
}

// Roll the rare promo-pack shop event (persists until bought).
export function rollPromoOffer(profile, story, rng = Math.random) {
  if (!story.promoEvent || profile.promoOffer) return profile
  if (rng() < story.promoEvent.chance) {
    return { ...profile, promoOffer: { packId: story.promoEvent.packId } }
  }
  return profile
}

// Roll the themed sub-pack restock: uncommon, but friendlier than the promo.
// One random sub-pack from the story's sets, stocked until bought.
export function rollSubOffer(profile, story, rng = Math.random) {
  if (!story.subPackEvent || profile.subOffer) return profile
  const options = subPacksForStory(story)
  if (!options.length) return profile
  if (rng() < story.subPackEvent.chance) {
    const pack = options[Math.floor(rng() * options.length)]
    return { ...profile, subOffer: { packId: pack.id } }
  }
  return profile
}

// --- story progression ----------------------------------------------------------

// Grant the starter deck: cards join the collection (uncapped refunds don't
// apply — starters stay within 4 copies) and the story is marked started.
export function chooseStarter(profile, story, starter, deckId) {
  const names = Object.entries(starter.counts).flatMap(([name, n]) => Array(n).fill(name))
  let next = addToCollection(profile, names).profile
  next = { ...next, coins: next.coins + (story.startingCoins ?? 0) }
  return withStory(next, story.id, { starterDeckId: starter.id, activeDeckId: deckId })
}

export const setActiveDeck = (profile, storyId, deckId) => withStory(profile, storyId, { activeDeckId: deckId })

export function areaUnlocked(story, state, areaIdx) {
  if (areaIdx === 0) return true
  const prev = story.areas[areaIdx - 1]
  return prev.nodes.every((n) => state.beaten.includes(n.id))
}

export function nodeUnlocked(story, state, areaIdx, nodeIdx) {
  if (!areaUnlocked(story, state, areaIdx)) return false
  const area = story.areas[areaIdx]
  return area.nodes.slice(0, nodeIdx).every((n) => state.beaten.includes(n.id))
}

export const areaCompleted = (area, state) => area.nodes.every((n) => state.beaten.includes(n.id))

// Record a battle result and hand out rewards. Returns the updated profile
// plus a summary of what was earned (for the reward dialogue).
export function recordBattle(profile, story, node, won) {
  const state = storyState(profile, story.id)
  const coinsBase = won ? (node.rewards?.win ?? 50) : (node.rewards?.lose ?? 10)
  let coins = coinsBase
  const awards = { coins: coinsBase, badge: null, trophy: false, firstClear: false }

  let patch = {}
  if (won && !state.beaten.includes(node.id)) {
    awards.firstClear = true
    const beaten = [...state.beaten, node.id]
    patch.beaten = beaten
    const areaIdx = story.areas.findIndex((a) => a.nodes.some((n) => n.id === node.id))
    const area = story.areas[areaIdx]
    if (area && area.nodes.every((n) => beaten.includes(n.id))) {
      if (area.badge && !state.badges.some((b) => b.areaId === area.id)) {
        awards.badge = { areaId: area.id, name: area.badge.name, image: area.badge.image }
        patch.badges = [...state.badges, awards.badge]
        coins += story.badgeBonus ?? 0
        awards.coins = coins
      }
      if (areaIdx === story.areas.length - 1 && !state.trophy) {
        awards.trophy = true
        patch.trophy = true
      }
    }
  }

  const next = withStory({ ...profile, coins: profile.coins + coins }, story.id, patch)
  return { profile: next, awards }
}

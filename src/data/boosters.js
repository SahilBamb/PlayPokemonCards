// Booster pack definitions and the pack-opening roll. Pools are derived from
// CARD_STATS by set + rarity so new sets automatically get sensible packs.
import CARD_STATS from './cardStats.js'
import { SETS } from './sets.js'

export const BOOSTER_PACKS = {
  base1: { id: 'base1', setId: 'base1', name: 'Base Set Booster', price: 100 },
  jungle: { id: 'jungle', setId: 'jungle', name: 'Jungle Booster', price: 100 },
  fossil: { id: 'fossil', setId: 'fossil', name: 'Fossil Booster', price: 100 },
  rocket: { id: 'rocket', setId: 'rocket', name: 'Team Rocket Booster', price: 100 },
  gym1: { id: 'gym1', setId: 'gym1', name: 'Gym Heroes Booster', price: 100 },
  gym2: { id: 'gym2', setId: 'gym2', name: 'Gym Challenge Booster', price: 100 },
  promoPack: {
    id: 'promoPack',
    setId: 'promo',
    name: 'Black Star Promo',
    price: 150,
    promo: true, // single random promo card; only appears via the rare shop event
  },
}

// Themed sub-packs: same 5-card structure but drawn from a slice of the
// parent set, so players can target the cards they want. Pricier, and only
// stocked via a shop event (rarer than regular packs, more common than the
// promo). Every slice keeps commons, uncommons, and a rare tier non-empty.
export const SUB_PACKS = {
  baseFirestorm: { id: 'baseFirestorm', setId: 'base1', name: 'Base – Firestorm', price: 175, sub: true, filter: { types: ['fire'] } },
  baseRiptide: { id: 'baseRiptide', setId: 'base1', name: 'Base – Riptide', price: 175, sub: true, filter: { types: ['water'] } },
  baseMindbend: { id: 'baseMindbend', setId: 'base1', name: 'Base – Mindbend', price: 175, sub: true, filter: { types: ['psychic'] } },
  baseTrainerCache: { id: 'baseTrainerCache', setId: 'base1', name: 'Base – Trainer Cache', price: 175, sub: true, filter: { trainers: true } },
  jungleOvergrowth: { id: 'jungleOvergrowth', setId: 'jungle', name: 'Jungle – Overgrowth', price: 175, sub: true, filter: { types: ['grass'] } },
  jungleSafari: { id: 'jungleSafari', setId: 'jungle', name: 'Jungle – Safari', price: 175, sub: true, filter: { types: ['colorless'] } },
  fossilDeepSea: { id: 'fossilDeepSea', setId: 'fossil', name: 'Fossil – Deep Sea', price: 175, sub: true, filter: { types: ['water'] } },
  fossilRelics: { id: 'fossilRelics', setId: 'fossil', name: 'Fossil – Relics', price: 175, sub: true, filter: { types: ['fighting'] } },
  fossilShadows: { id: 'fossilShadows', setId: 'fossil', name: 'Fossil – Shadows', price: 175, sub: true, filter: { types: ['psychic', 'grass'] } },
  rocketShadowOps: { id: 'rocketShadowOps', setId: 'rocket', name: 'Rocket – Shadow Ops', price: 175, sub: true, filter: { types: ['psychic', 'grass'] } },
  rocketDarkTide: { id: 'rocketDarkTide', setId: 'rocket', name: 'Rocket – Dark Tide', price: 175, sub: true, filter: { types: ['water', 'lightning'] } },
  rocketDirtyTricks: { id: 'rocketDirtyTricks', setId: 'rocket', name: 'Rocket – Dirty Tricks', price: 175, sub: true, filter: { trainers: true } },
  heroesPewterStone: { id: 'heroesPewterStone', setId: 'gym1', name: 'Heroes – Pewter Stone', price: 175, sub: true, filter: { types: ['fighting'] } },
  heroesCeruleanWaters: { id: 'heroesCeruleanWaters', setId: 'gym1', name: 'Heroes – Cerulean Waters', price: 175, sub: true, filter: { types: ['water'] } },
  heroesSaffronSpirits: { id: 'heroesSaffronSpirits', setId: 'gym1', name: 'Heroes – Saffron Spirits', price: 175, sub: true, filter: { types: ['psychic'] } },
  challengeCinnabarBlaze: { id: 'challengeCinnabarBlaze', setId: 'gym2', name: 'Challenge – Cinnabar Blaze', price: 175, sub: true, filter: { types: ['fire'] } },
  challengeToxicGardens: { id: 'challengeToxicGardens', setId: 'gym2', name: 'Challenge – Toxic Gardens', price: 175, sub: true, filter: { types: ['grass'] } },
  challengeLeagueSecrets: { id: 'challengeLeagueSecrets', setId: 'gym2', name: 'Challenge – League Secrets', price: 175, sub: true, filter: { trainers: true } },
}

export const packById = (id) => BOOSTER_PACKS[id] ?? SUB_PACKS[id] ?? null

// Sub-packs whose parent set is one of the story's shop sets.
export const subPacksForStory = (story) =>
  Object.values(SUB_PACKS).filter((p) => (story.packs ?? []).includes(p.setId))

// 5-card pack: 3 commons / 1 uncommon / 1 rare, with a 1-in-3 chance the
// rare is a holo.
export const PACK_SLOTS = { Common: 3, Uncommon: 1 }
export const HOLO_CHANCE = 1 / 3

// Coins refunded when a pull would push a card past the 4-copy collection cap.
export const DUPE_REFUND = { Common: 5, Uncommon: 10, Rare: 25, 'Rare Holo': 50, 'Rare Secret': 75, Promo: 100 }

// Cards by rarity for a set (optionally narrowed to a sub-pack's slice).
// Basic energy is excluded — energy is free to use in story decks, pulling it
// would feel like a dud card.
export function packPool(setId, filter = null) {
  const pool = {}
  for (const c of CARD_STATS) {
    if (c.set !== setId || c.supertype === 'energy') continue
    if (filter?.trainers && c.supertype !== 'trainer') continue
    if (filter?.types && !(c.supertype === 'pokemon' && filter.types.includes(c.type))) continue
    ;(pool[c.rarity] ??= []).push(c.name)
  }
  return pool
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)]

// Roll the contents of one pack. Returns card names (with repeats).
export function openPack(pack, rng = Math.random) {
  const pool = packPool(pack.setId, pack.filter)
  if (pack.promo) return [pick(pool.Promo ?? [], rng)]
  const cards = []
  for (const [rarity, n] of Object.entries(PACK_SLOTS)) {
    for (let i = 0; i < n; i++) cards.push(pick(pool[rarity] ?? [], rng))
  }
  // Secret rares (Dark Raichu) ride along in the holo slot as chase cards.
  const holos = [...(pool['Rare Holo'] ?? []), ...(pool['Rare Secret'] ?? [])]
  const rares = pool.Rare ?? []
  const wantHolo = rng() < HOLO_CHANCE
  // Pools without plain rares (Jungle/Fossil dedupe kept the holo prints)
  // fall back to the holo pool and vice versa.
  const rareSlot = wantHolo ? (holos.length ? holos : rares) : rares.length ? rares : holos
  cards.push(pick(rareSlot, rng))
  return cards.filter(Boolean)
}

export const packSetName = (pack) => SETS[pack.setId]?.name ?? pack.setId

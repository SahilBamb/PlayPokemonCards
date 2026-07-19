import BASE_STATS from '../data/baseStats.js'
import { ATTACK_EFFECTS, TRAINER_EFFECTS, POWER_EFFECTS } from '../data/cardEffects.js'
import { nextUid, shuffle } from './utils.js'

export const CARD_DB = BASE_STATS
export const byName = Object.fromEntries(BASE_STATS.map((c) => [c.name, c]))
export const byNumber = Object.fromEntries(BASE_STATS.map((c) => [c.number, c]))

// Attack encodings: "CardName:AttackName" wins over "AttackName".
export function getAttackEffects(cardName, attackName) {
  return ATTACK_EFFECTS[`${cardName}:${attackName}`] ?? ATTACK_EFFECTS[attackName] ?? null
}

export function getTrainerEffects(cardName) {
  return TRAINER_EFFECTS[cardName] ?? null
}

export function getPowerEffects(powerName) {
  return POWER_EFFECTS[powerName] ?? null
}

// Create a card instance (hand/deck representation) from the DB.
export function makeCard(ref) {
  const stats = typeof ref === 'number' ? byNumber[ref] : byName[ref]
  if (!stats) throw new Error(`Unknown card: ${ref}`)
  const card = { ...stats, uid: nextUid() }
  if (card.supertype === 'energy') {
    card.units = card.energy === 'doublecolorless' ? 2 : 1
  }
  if (card.name === 'Clefairy Doll') {
    card.doll = true
    card.hp = 10
  }
  return card
}

// Turn a pokemon (or Clefairy Doll) card into an in-play slot.
export function makeSlot(card, turnNumber = 0) {
  return {
    ...card,
    dc: 0,
    status: null,
    poisonAmount: 10,
    energyAttached: [],
    prevStack: [], // cards underneath (pre-evolutions)
    markers: {},
    guard: null,
    attackLock: null,
    accuracyDebuff: false,
    lastHit: null, // { damage, turnNumber } for Mirror Move
    turnPlayed: turnNumber,
  }
}

// Strip play-state off a slot, returning the raw cards (top card, stack, energy).
export function slotCards(slot) {
  const top = byName[slot.name] ? { ...byName[slot.name], uid: slot.uid } : null
  return {
    top,
    stack: slot.prevStack ?? [],
    energy: slot.energyAttached.filter((e) => !e.isBuzzap),
  }
}

const DECK_P1 = [
  ...Array(4).fill('Squirtle'), ...Array(3).fill('Wartortle'), ...Array(2).fill('Blastoise'),
  ...Array(3).fill('Seel'), ...Array(2).fill('Dewgong'),
  ...Array(4).fill('Charmander'), ...Array(3).fill('Charmeleon'), ...Array(2).fill('Charizard'),
  ...Array(2).fill('Growlithe'), ...Array(2).fill('Arcanine'),
  'Bill', 'Bill', 'Professor Oak', 'Potion', 'Potion', 'Super Potion', 'Switch', 'Gust of Wind',
  'Energy Removal', 'PlusPower', 'Defender', 'Full Heal', 'Energy Retrieval', 'Computer Search',
  ...Array(9).fill('Water Energy'), ...Array(8).fill('Fire Energy'), 'Double Colorless Energy', 'Double Colorless Energy',
]

const DECK_P2 = [
  ...Array(4).fill('Bulbasaur'), ...Array(3).fill('Ivysaur'), ...Array(2).fill('Venusaur'),
  ...Array(3).fill('Weedle'), ...Array(2).fill('Kakuna'), ...Array(2).fill('Beedrill'),
  ...Array(3).fill('Abra'), ...Array(2).fill('Kadabra'), ...Array(2).fill('Alakazam'),
  ...Array(2).fill('Gastly'), ...Array(2).fill('Haunter'), 'Mewtwo', 'Clefairy Doll',
  'Bill', 'Bill', 'Professor Oak', 'Potion', 'Scoop Up', 'Pokémon Center', 'Pokémon Trader',
  'Pokémon Breeder', 'Lass', 'Revive', 'Pokédex', 'Maintenance',
  ...Array(9).fill('Grass Energy'), ...Array(8).fill('Psychic Energy'), 'Double Colorless Energy', 'Double Colorless Energy',
]

export function makeDeck(list) {
  return shuffle(list.map(makeCard))
}

export function initialGameState() {
  const d1 = makeDeck(DECK_P1)
  const d2 = makeDeck(DECK_P2)
  return {
    p1: { hand: d1.slice(0, 7), deck: d1.slice(7), mon: [null, null, null, null, null, null], discard: [] },
    p2: { hand: d2.slice(0, 7), deck: d2.slice(7), mon: [null, null, null, null, null, null], discard: [] },
    turnPlayer: 'p1',
    turnNumber: 1,
    effectsQueue: [],
    context: {},
    pending: null,
    viewZone: null, // { player, zone } when browsing a discard pile etc.
    log: ['Sandbox started. Drag Basic Pokémon from your hand onto the board.'],
  }
}

import CARD_STATS from '../data/cardStats.js'
import { ATTACK_EFFECTS, TRAINER_EFFECTS, POWER_EFFECTS } from '../data/cardEffects.js'
import { PRESET_DECK_DEFS } from '../data/presetDecks.js'
import { nextUid, shuffle } from './utils.js'

// Card names are unique across all sets (re-prints carry a set suffix, e.g.
// "Zapdos (Fossil)"); card.species holds the printed name for evolution
// matching and shared copy limits.
export const CARD_DB = CARD_STATS
export const byName = Object.fromEntries(CARD_STATS.map((c) => [c.name, c]))

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
  const stats = byName[ref]
  if (!stats) throw new Error(`Unknown card: ${ref}`)
  const card = { ...stats, uid: nextUid() }
  if (card.supertype === 'energy') {
    card.units = card.energy === 'doublecolorless' ? 2 : 1
  }
  if (card.name === 'Clefairy Doll' || card.name === 'Mysterious Fossil') {
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

const DECK_P3 = [
  ...Array(4).fill('Pikachu'), ...Array(3).fill('Raichu'),
  ...Array(3).fill('Voltorb'), ...Array(2).fill('Electrode'),
  ...Array(2).fill('Electabuzz'), ...Array(2).fill('Zapdos'),
  ...Array(4).fill('Machop'), ...Array(3).fill('Machoke'), ...Array(2).fill('Machamp'),
  ...Array(2).fill('Hitmonchan'),
  'Bill', 'Bill', 'Professor Oak', 'Potion', 'Potion', 'Switch', 'Gust of Wind',
  'Energy Removal', 'Energy Removal', 'PlusPower', 'Defender', 'Full Heal',
  ...Array(11).fill('Lightning Energy'), ...Array(8).fill('Fighting Energy'),
  'Double Colorless Energy', 'Double Colorless Energy',
]

const countsToList = (counts) => Object.entries(counts).flatMap(([name, n]) => Array(n).fill(name))

export const DECKS = {
  blazeSurf: {
    id: 'blazeSurf',
    name: 'Blaze & Surf',
    group: 'starter',
    description: 'Charizard and Blastoise lines with Water/Fire energy.',
    coverCards: ['Charizard', 'Blastoise'],
    list: DECK_P1,
  },
  jungleMind: {
    id: 'jungleMind',
    name: 'Jungle Mind',
    group: 'starter',
    description: 'Venusaur, Alakazam, and Mewtwo with Grass/Psychic energy.',
    coverCards: ['Venusaur', 'Alakazam'],
    list: DECK_P2,
  },
  boltFist: {
    id: 'boltFist',
    name: 'Bolt & Fist',
    group: 'starter',
    description: 'Raichu, Zapdos, and Machamp with Lightning/Fighting energy.',
    coverCards: ['Zapdos', 'Machamp'],
    list: DECK_P3,
  },
  // Historical Base–Fossil and Game Boy decks (see src/data/presetDecks.js)
  ...Object.fromEntries(
    PRESET_DECK_DEFS.map((d) => [d.id, { group: 'basefossil', ...d, list: countsToList(d.counts) }])
  ),
}

export function makeDeck(list) {
  return shuffle(list.map(makeCard))
}

const emptySide = () => ({ hand: [], deck: [], mon: [null, null, null, null, null, null], discard: [], prizes: [] })

// Shared state shape. Sandbox is "always playing, nothing enforced".
export function baseGameState() {
  return {
    mode: 'sandbox',
    phase: 'playing', // setup | playing | gameover
    p1: emptySide(),
    p2: emptySide(),
    turnPlayer: 'p1',
    turnNumber: 1,
    setupDone: { p1: true, p2: true },
    turnFlags: { energyAttached: false, retreated: false, powersUsed: {} },
    enforceTurns: false, // sandbox "turn based" toggle
    fxQueue: [], // visual/sound events awaiting playback (pauses the game)
    fxEnabled: false, // set by the UI from settings; false for headless runs
    prizesOwed: { p1: 0, p2: 0 },
    trainerBlock: null, // { player, turnNumber } after Psyduck's Headache
    endTurnAfterResolve: false,
    winner: null,
    winReason: null,
    effectsQueue: [],
    context: {},
    pending: null,
    viewZone: null, // { player, zone } when browsing a discard pile etc.
    reveal: null, // { player, cards, label } after a Peek-style effect
    log: [],
  }
}

export function initialGameState() {
  const d1 = makeDeck(DECK_P1)
  const d2 = makeDeck(DECK_P2)
  const state = baseGameState()
  return {
    ...state,
    p1: { ...state.p1, hand: d1.slice(0, 7), deck: d1.slice(7) },
    p2: { ...state.p2, hand: d2.slice(0, 7), deck: d2.slice(7) },
    log: ['Sandbox started. Drag Basic Pokémon from your hand onto the board.'],
  }
}

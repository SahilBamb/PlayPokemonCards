// Custom deck storage and validation. Decks are stored as name->count maps
// and expanded to flat lists (the format makeDeck expects) when a match
// starts. localStorage-backed like ppc-settings / ppc-fav-cards.
import { byName } from '../engine/cards.js'
import { DEFAULT_FORMAT, SETS } from '../data/sets.js'

const KEY = 'ppc-decks'
export const DECK_SIZE = 60
export const MAX_COPIES = 4

// Basic energy is exempt from the 4-copy rule; Double Colorless is not.
export const isBasicEnergy = (name) => {
  const c = byName[name]
  return !!c && c.supertype === 'energy' && c.name !== 'Double Colorless Energy'
}

export function loadDecks() {
  try {
    const decks = JSON.parse(localStorage.getItem(KEY)) ?? []
    return Array.isArray(decks) ? decks : []
  } catch {
    return []
  }
}

function persist(decks) {
  localStorage.setItem(KEY, JSON.stringify(decks))
  return decks
}

export function saveDeck(deck) {
  const decks = loadDecks()
  const stamped = { ...deck, updatedAt: Date.now() }
  const i = decks.findIndex((d) => d.id === deck.id)
  if (i >= 0) decks[i] = stamped
  else decks.push(stamped)
  persist(decks)
  return stamped
}

export function deleteDeck(id) {
  persist(loadDecks().filter((d) => d.id !== id))
}

export function newDeckId() {
  return `deck-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

export const deckSize = (counts) => Object.values(counts).reduce((a, b) => a + b, 0)

// Expand a deck's counts into the flat card-name list makeDeck consumes.
export function deckToList(deck) {
  const list = []
  for (const [name, n] of Object.entries(deck.counts)) {
    for (let i = 0; i < n; i++) list.push(name)
  }
  return list
}

// Total copies per species: re-prints (e.g. Base + Fossil Zapdos) share the
// same 4-copy limit because they share the same printed name.
function speciesTotals(counts) {
  const totals = {}
  for (const [name, n] of Object.entries(counts)) {
    if (n <= 0) continue
    const species = byName[name]?.species ?? name
    totals[species] = (totals[species] ?? 0) + n
  }
  return totals
}

// Returns a list of problem strings; empty means the deck is match-legal.
// `collection` (name -> owned count) constrains cards to what the player
// owns — null means everything is available (Quick Play / editor default).
// `format` restricts which sets are legal (rotation seam).
export function validateDeck(counts, collection = null, format = DEFAULT_FORMAT) {
  const problems = []
  const size = deckSize(counts)
  if (size !== DECK_SIZE) {
    problems.push(`A deck needs exactly ${DECK_SIZE} cards (currently ${size}).`)
  }
  let hasBasic = false
  for (const [name, n] of Object.entries(counts)) {
    if (n <= 0) continue
    const card = byName[name]
    if (!card) {
      problems.push(`Unknown card: ${name}.`)
      continue
    }
    if (format && !format.sets.includes(card.set)) {
      problems.push(`${name} (${SETS[card.set]?.name ?? card.set}) is not legal in ${format.name}.`)
    }
    // Basic energy is free — collections never track it.
    if (collection && !isBasicEnergy(name) && n > (collection[name] ?? 0)) {
      problems.push(`You only own ${collection[name] ?? 0} × ${name} (deck uses ${n}).`)
    }
    if (card.supertype === 'pokemon' && card.stage === 'basic') hasBasic = true
  }
  for (const [species, total] of Object.entries(speciesTotals(counts))) {
    if (total > MAX_COPIES && !isBasicEnergy(species)) {
      problems.push(`Max ${MAX_COPIES} copies of ${species} across all prints (has ${total}).`)
    }
  }
  if (!hasBasic) problems.push('A deck needs at least 1 Basic Pokémon.')
  return problems
}

// The max number of copies of `name` the deck may currently hold. When
// `counts` is given, other prints of the same species use up the limit too.
export function copyLimit(name, collection = null, counts = null) {
  if (isBasicEnergy(name)) return Infinity
  let rules = MAX_COPIES
  const card = byName[name]
  if (counts && card && rules !== Infinity) {
    const otherPrints = Object.entries(counts).reduce((a, [n, c]) => {
      if (n === name || c <= 0) return a
      return byName[n]?.species === card.species ? a + c : a
    }, 0)
    rules -= otherPrints
  }
  return collection ? Math.min(rules, collection[name] ?? 0) : rules
}

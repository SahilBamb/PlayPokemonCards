// Card set + format registry. Booster packs and the shop build on SETS
// (cards carry `set` and `rarity`); rotations become new FORMATS entries
// with a different `sets` list.
export const SETS = {
  base1: { id: 'base1', name: 'Base Set', label: 'Base', releaseOrder: 1 },
  jungle: { id: 'jungle', name: 'Jungle', label: 'Jungle', releaseOrder: 2 },
  fossil: { id: 'fossil', name: 'Fossil', label: 'Fossil', releaseOrder: 3 },
  // Pre-Rocket Wizards Black Star Promos + Super Energy Retrieval
  promo: { id: 'promo', name: 'Wizards Promos', label: 'Promo', releaseOrder: 4 },
  rocket: { id: 'rocket', name: 'Team Rocket', label: 'Rocket', releaseOrder: 5 },
  gym1: { id: 'gym1', name: 'Gym Heroes', label: 'Heroes', releaseOrder: 6 },
  gym2: { id: 'gym2', name: 'Gym Challenge', label: 'Challenge', releaseOrder: 7 },
  // Japanese vending-machine cards never released in English (Gastly/Haunter
  // from the Original Rules era).
  vending: { id: 'vending', name: 'Japanese Vending', label: 'Vending', releaseOrder: 8 },
}

export const FORMATS = {
  // The Kanto story plays in classic: Base Set through Fossil (+ promos).
  classic: { id: 'classic', name: 'Classic (Base to Fossil)', sets: ['base1', 'jungle', 'fossil', 'promo'] },
  // The Rocket Takeover story: classic plus the Team Rocket expansion.
  rocketClassic: {
    id: 'rocketClassic',
    name: 'Classic + Team Rocket',
    sets: ['base1', 'jungle', 'fossil', 'promo', 'rocket'],
  },
  // The League Reborn story: everything through the Gym sets (no vending).
  gymEra: {
    id: 'gymEra',
    name: 'Gym Era (Base to Gym Challenge)',
    sets: ['base1', 'jungle', 'fossil', 'promo', 'rocket', 'gym1', 'gym2'],
  },
  // Everything through the Gym sets — the current Quick Play / editor default.
  rocketGym: {
    id: 'rocketGym',
    name: 'Rocket to Gym (pre-rotation)',
    sets: ['base1', 'jungle', 'fossil', 'promo', 'rocket', 'gym1', 'gym2', 'vending'],
  },
}

export const DEFAULT_FORMAT = FORMATS.rocketGym

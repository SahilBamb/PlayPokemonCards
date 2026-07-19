// Effect encodings for every Base Set card, expressed on top of the engine's
// effect primitives. Attacks with a plain numeric damage value get a DAMAGE
// effect auto-queued by the engine; entries here only add the extra behavior.
// Lookup order: "CardName:AttackName" then "AttackName".

// --- helpers to keep encodings tiny ---
const D = (amount, o = {}) => ({ type: 'DAMAGE', target: 'defender', amount, ...o })
const SELF = (amount, o = {}) => ({ type: 'DAMAGE', target: 'self', amount, ...o })
const ST = (status, o = {}) => ({ type: 'INFLICT_STATUS', target: 'defender', status, ...o })
const FLIP_ST = (status) => ({ effects: [ST(status, { flip: 1, if: 'heads' })] })
const GUARD_FLIP = { effects: [{ type: 'APPLY_GUARD', target: 'self', kind: 'damage', flip: 1, if: 'heads' }] }
// "Discard N energy in order to use this attack" (cost discards are skipped by Metronome)
const COST_DISCARD = (count, filter) => [
  { type: 'CHOOSE', what: 'energy', from: 'self', count, filter, isCost: true, prompt: `Choose ${count} energy to discard` },
  { type: 'DISCARD_ENERGY', isCost: true },
]
const TIMES = (per, coins = 2) => ({ manual: true, effects: [D({ timesHeads: per }, { flip: coins })] })
const WATER_GUN = (base) => ({ manual: true, effects: [D({ base, perExtraEnergy: { type: 'water', each: 10, max: 2 } })] })
const DISCARD_DEFENDER_ENERGY = {
  effects: [
    { type: 'CHOOSE', what: 'energy', from: 'defender', count: 1, optional: true, prompt: 'Choose 1 energy to discard from the Defending Pokémon' },
    { type: 'DISCARD_ENERGY' },
  ],
}
const RECOVER = (energyType) => ({
  effects: [...COST_DISCARD(1, { energyType }), { type: 'HEAL', target: 'self', amount: 'all' }],
})
const SELFDESTRUCT = (bench, self) => ({
  effects: [
    { type: 'DAMAGE', each: { player: 'both', zone: 'bench' }, amount: bench },
    SELF(self),
  ],
})

export const ATTACK_EFFECTS = {
  // --- holos / rares ---
  'Confuse Ray': FLIP_ST('confused'),
  'Hydro Pump': WATER_GUN(40),
  'Scrunch': GUARD_FLIP,
  'Double-edge': { effects: [SELF(80)] },
  'Fire Spin': { effects: COST_DISCARD(2) },
  'Sing': FLIP_ST('asleep'),
  'Metronome': {
    effects: [
      { type: 'CHOOSE', what: 'attack', of: 'defender', prompt: "Choose one of the Defending Pokémon's attacks to copy" },
      { type: 'COPY_ATTACK', mode: 'metronome' },
    ],
  },
  'Bubblebeam': FLIP_ST('paralyzed'),
  'Thunder Wave': FLIP_ST('paralyzed'),
  'Magneton:Selfdestruct': SELFDESTRUCT(20, 80),
  'Magnemite:Selfdestruct': SELFDESTRUCT(10, 40),
  'Psychic': { manual: true, effects: [D({ base: 10, perEnergyOnDefender: 10 })] },
  'Barrier': { effects: [...COST_DISCARD(1, { energyType: 'psychic' }), { type: 'APPLY_GUARD', target: 'self', kind: 'all' }] },
  'Thrash': { manual: true, effects: [D({ base: 30, perHeads: 10 }, { flip: 1 }), SELF(10, { if: 'tails' })] },
  'Toxic': { effects: [ST('poisoned', { poisonAmount: 20 })] },
  'Lure': {
    effects: [
      { type: 'CHOOSE', what: 'pokemon', player: 'opp', zone: 'bench', optional: true, prompt: 'Choose an opposing Benched Pokémon to switch in' },
      { type: 'SWITCH_ACTIVE', player: 'opp' },
    ],
  },
  'Fire Blast': { effects: COST_DISCARD(1, { energyType: 'fire' }) },
  'Poliwrath:Water Gun': WATER_GUN(30),
  'Poliwag:Water Gun': WATER_GUN(10),
  'Whirlpool': DISCARD_DEFENDER_ENERGY,
  'Agility': { effects: [{ type: 'APPLY_GUARD', target: 'self', kind: 'all', flip: 1, if: 'heads' }] },
  'Thunder': { effects: [SELF(30, { flip: 1, if: 'tails' })] },
  'Thunderbolt': { effects: [{ type: 'DISCARD_ENERGY', from: 'self', count: 'all', isCost: true }] },

  // --- uncommons / commons ---
  'Twineedle': TIMES(30),
  'Slam': TIMES(30),
  'Hyper Beam': DISCARD_DEFENDER_ENERGY,
  'Earthquake': { effects: [{ type: 'DAMAGE', each: { player: 'self', zone: 'bench' }, amount: 10 }] },
  'Thundershock': FLIP_ST('paralyzed'),
  'Thunderpunch': { manual: true, effects: [D({ base: 30, perHeads: 10 }, { flip: 1 }), SELF(10, { if: 'tails' })] },
  'Electric Shock': { effects: [SELF(10, { flip: 1, if: 'tails' })] },
  'Whirlwind': {
    effects: [
      { type: 'CHOOSE', what: 'pokemon', player: 'opp', zone: 'bench', optional: true, chooser: 'opp', prompt: 'Opponent chooses a Benched Pokémon to switch in' },
      { type: 'SWITCH_ACTIVE', player: 'opp' },
    ],
  },
  'Mirror Move': { requires: 'wasAttackedLastTurn', effects: [{ type: 'COPY_ATTACK', mode: 'mirror' }] },
  'Take Down': { effects: [SELF(30)] },
  'Leek Slap': {
    manual: true,
    requires: 'notMarked:leekSlap',
    effects: [{ type: 'SET_MARKER', target: 'self', marker: 'leekSlap' }, D(30, { flip: 1, if: 'heads' })],
  },
  'Dream Eater': { requires: 'defenderAsleep' },
  'Poisonpowder': { effects: [ST('poisoned')] },
  'Kakuna:Poisonpowder': FLIP_ST('poisoned'),
  'Jynx:Doubleslap': TIMES(10),
  'Poliwhirl:Doubleslap': TIMES(30),
  'Meditate': { manual: true, effects: [D({ base: 20, perDcOnDefender: 10 })] },
  'Kadabra:Recover': RECOVER('psychic'),
  'Starmie:Recover': RECOVER('water'),
  'Karate Chop': { manual: true, effects: [D({ base: 50, perDcOnSelf: -10 })] },
  'Submission': { effects: [SELF(20)] },
  'Flail': { manual: true, effects: [D({ perDcOnSelf: 10 })] },
  'Amnesia': {
    effects: [
      { type: 'CHOOSE', what: 'attack', of: 'defender', prompt: 'Choose an attack the Defending Pokémon cannot use next turn' },
      { type: 'ATTACK_LOCK' },
    ],
  },
  'Conversion 1': {
    requires: 'defenderHasWeakness',
    effects: [
      { type: 'CHOOSE', what: 'type', prompt: "Choose the Defending Pokémon's new Weakness" },
      { type: 'MODIFY_CARD', target: 'defender', field: 'weakness', value: 'chosenType' },
    ],
  },
  'Conversion 2': {
    effects: [
      { type: 'CHOOSE', what: 'type', prompt: "Choose Porygon's new Resistance" },
      { type: 'MODIFY_CARD', target: 'self', field: 'resistance', value: 'chosenType' },
    ],
  },
  'Super Fang': { manual: true, effects: [D({ halfDefenderHP: true })] },
  'Sand-attack': { effects: [{ type: 'ACCURACY_DEBUFF', target: 'defender' }] },
  'Leech Seed': { effects: [{ type: 'HEAL', target: 'self', amount: 10, if: 'didDamage' }] },
  'Foul Gas': { effects: [ST('poisoned', { flip: 1, if: 'heads' }), ST('confused', { if: 'tails' })] },
  'Destiny Bond': {
    effects: [...COST_DISCARD(1, { energyType: 'psychic' }), { type: 'SET_MARKER', target: 'self', marker: 'destinyBond', duration: 1 }],
  },
  'Horn Hazard': { manual: true, effects: [D(30, { flip: 1, if: 'heads' })] },
  'Harden': { effects: [{ type: 'APPLY_GUARD', target: 'self', kind: 'threshold', threshold: 30 }] },
  'Thunder Jolt': { effects: [SELF(10, { flip: 1, if: 'tails' })] },
  'Stun Spore': FLIP_ST('paralyzed'),
  'String Shot': FLIP_ST('paralyzed'),
  'Bind': FLIP_ST('paralyzed'),
  'Bubble': FLIP_ST('paralyzed'),
  'Star Freeze': FLIP_ST('paralyzed'),
  'Ice Beam': FLIP_ST('paralyzed'),
  'Psyshock': FLIP_ST('paralyzed'),
  'Fury Attack': TIMES(10),
  'Double Kick': TIMES(30),
  'Sleeping Gas': FLIP_ST('asleep'),
  'Hypnosis': { effects: [ST('asleep')] },
  'Poison Sting': FLIP_ST('poisoned'),
  'Withdraw': GUARD_FLIP,
  'Stiffen': GUARD_FLIP,
  'Flamethrower': { effects: COST_DISCARD(1, { energyType: 'fire' }) },
  'Ember': { effects: COST_DISCARD(1, { energyType: 'fire' }) },
}

// --- Trainers: an effects array that runs when the card is played from hand ---
const CH_CARDS = (o) => ({ type: 'CHOOSE', what: 'cards', ...o })
const CH_POKE = (o) => ({ type: 'CHOOSE', what: 'pokemon', ...o })
const MV = (o) => ({ type: 'MOVE_CARDS', ...o })

export const TRAINER_EFFECTS = {
  'Bill': [MV({ from: 'deck', to: 'hand', count: 2 })],
  'Professor Oak': [MV({ from: 'hand', to: 'discard', count: 'all' }), MV({ from: 'deck', to: 'hand', count: 7 })],
  'Impostor Professor Oak': [
    MV({ player: 'opp', from: 'hand', to: 'deck', count: 'all', shuffle: true }),
    MV({ player: 'opp', from: 'deck', to: 'hand', count: 7 }),
  ],
  'Computer Search': [
    CH_CARDS({ from: 'hand', count: 2, prompt: 'Discard 2 cards from your hand' }),
    MV({ from: 'chosen', to: 'discard' }),
    CH_CARDS({ from: 'deck', count: 1, prompt: 'Choose any card from your deck' }),
    MV({ from: 'chosen', to: 'hand' }),
    { type: 'SHUFFLE_DECK' },
  ],
  'Devolution Spray': [
    CH_POKE({ player: 'self', zone: 'all', filter: { evolved: true }, prompt: 'Choose one of your evolved Pokémon to devolve' }),
    { type: 'DEVOLVE' },
  ],
  'Item Finder': [
    CH_CARDS({ from: 'hand', count: 2, prompt: 'Discard 2 cards from your hand' }),
    MV({ from: 'chosen', to: 'discard' }),
    CH_CARDS({ from: 'discard', count: 1, filter: { supertype: 'trainer' }, prompt: 'Choose a Trainer card from your discard pile' }),
    MV({ from: 'chosen', to: 'hand' }),
  ],
  'Lass': [
    MV({ from: 'hand', to: 'deck', count: 'all', filter: { supertype: 'trainer' }, shuffle: true }),
    MV({ player: 'opp', from: 'hand', to: 'deck', count: 'all', filter: { supertype: 'trainer' }, shuffle: true }),
  ],
  'Pokémon Breeder': [
    // breederUsable: only offer Stage 2s whose matching Basic is in play and
    // legal to evolve right now, so the card can't be wasted on nothing.
    CH_CARDS({ from: 'hand', count: 1, filter: { stage: 'stage2', breederUsable: true }, prompt: 'Choose a Stage 2 card from your hand' }),
    CH_POKE({ player: 'self', zone: 'all', filter: { breederTarget: true }, prompt: 'Choose the matching Basic Pokémon' }),
    { type: 'EVOLVE', useChosenCard: true },
  ],
  'Pokémon Trader': [
    CH_CARDS({ from: 'hand', count: 1, filter: { supertype: 'pokemon' }, prompt: 'Choose a Pokémon card from your hand to trade' }),
    MV({ from: 'chosen', to: 'deck' }),
    CH_CARDS({ from: 'deck', count: 1, filter: { supertype: 'pokemon' }, prompt: 'Choose a Pokémon card from your deck' }),
    MV({ from: 'chosen', to: 'hand' }),
    { type: 'SHUFFLE_DECK' },
  ],
  'Scoop Up': [
    CH_POKE({ player: 'self', zone: 'all', prompt: 'Choose a Pokémon to scoop up' }),
    { type: 'SCOOP_UP' },
  ],
  'Super Energy Removal': [
    CH_POKE({ player: 'self', zone: 'all', filter: { hasEnergy: true }, prompt: 'Choose your Pokémon to discard an energy from' }),
    { type: 'CHOOSE', what: 'energy', from: 'chosen', count: 1, prompt: 'Choose 1 of your energy to discard' },
    { type: 'DISCARD_ENERGY' },
    CH_POKE({ player: 'opp', zone: 'all', filter: { hasEnergy: true }, prompt: "Choose an opponent's Pokémon" }),
    { type: 'CHOOSE', what: 'energy', from: 'chosen', upTo: 2, prompt: 'Choose up to 2 energy to discard' },
    { type: 'DISCARD_ENERGY' },
  ],
  'Defender': [
    CH_POKE({ player: 'self', zone: 'all', prompt: 'Attach Defender to one of your Pokémon' }),
    { type: 'SET_MARKER', target: 'chosen', marker: 'defender', duration: 1 },
  ],
  'Energy Retrieval': [
    CH_CARDS({ from: 'hand', count: 1, prompt: 'Discard 1 card from your hand' }),
    MV({ from: 'chosen', to: 'discard' }),
    // precheck: unplayable unless the discard pile already has basic energy
    CH_CARDS({ from: 'discard', upTo: 2, filter: { basicEnergy: true }, precheck: true, prompt: 'Choose up to 2 basic Energy cards from your discard pile' }),
    MV({ from: 'chosen', to: 'hand' }),
  ],
  'Full Heal': [{ type: 'CURE_STATUS', target: 'active' }],
  'Maintenance': [
    CH_CARDS({ from: 'hand', count: 2, prompt: 'Shuffle 2 cards from your hand into your deck' }),
    MV({ from: 'chosen', to: 'deck', shuffle: true }),
    MV({ from: 'deck', to: 'hand', count: 1 }),
  ],
  'PlusPower': [{ type: 'SET_MARKER', target: 'active', marker: 'plusPower', duration: 0 }],
  'Pokémon Center': [
    { type: 'HEAL', each: { player: 'self', zone: 'all', filter: { damaged: true } }, amount: 'all', discardEnergy: true },
  ],
  'Pokémon Flute': [
    CH_CARDS({ player: 'opp', from: 'discard', count: 1, filter: { basicPokemon: true }, prompt: "Choose a Basic Pokémon from your opponent's discard pile" }),
    MV({ player: 'opp', from: 'chosen', to: 'bench' }),
  ],
  'Pokédex': [
    { type: 'CHOOSE', what: 'order', count: 5, prompt: 'Rearrange the top cards of your deck (click in new order, top first)' },
    { type: 'REORDER_DECK' },
  ],
  'Revive': [
    CH_CARDS({ from: 'discard', count: 1, filter: { basicPokemon: true }, prompt: 'Choose a Basic Pokémon from your discard pile' }),
    MV({ from: 'chosen', to: 'bench', halfHpDc: true }),
  ],
  'Super Potion': [
    CH_POKE({ player: 'self', zone: 'all', filter: { hasEnergy: true }, prompt: 'Choose a Pokémon (it must discard an energy)' }),
    { type: 'CHOOSE', what: 'energy', from: 'chosen', count: 1, prompt: 'Choose 1 energy to discard' },
    { type: 'DISCARD_ENERGY' },
    { type: 'HEAL', target: 'chosen', amount: 40 },
  ],
  'Energy Removal': [
    CH_POKE({ player: 'opp', zone: 'all', filter: { hasEnergy: true }, prompt: "Choose an opponent's Pokémon" }),
    { type: 'CHOOSE', what: 'energy', from: 'chosen', count: 1, prompt: 'Choose 1 energy to discard' },
    { type: 'DISCARD_ENERGY' },
  ],
  'Gust of Wind': [
    CH_POKE({ player: 'opp', zone: 'bench', prompt: "Choose an opponent's Benched Pokémon to switch in" }),
    { type: 'SWITCH_ACTIVE', player: 'opp' },
  ],
  'Potion': [
    CH_POKE({ player: 'self', zone: 'all', filter: { damaged: true }, prompt: 'Choose a Pokémon to heal 20' }),
    { type: 'HEAL', target: 'chosen', amount: 20 },
  ],
  'Switch': [
    CH_POKE({ player: 'self', zone: 'bench', prompt: 'Choose a Benched Pokémon to switch in' }),
    { type: 'SWITCH_ACTIVE', player: 'self' },
  ],
  // Clefairy Doll is played by dragging it onto an empty slot, not by clicking.
}

// --- Pokémon Powers ---
export const POWER_EFFECTS = {
  'Damage Swap': {
    effects: [
      CH_POKE({ player: 'self', zone: 'all', filter: { damaged: true }, prompt: 'Move 1 damage counter from...' }),
      CH_POKE({ player: 'self', zone: 'all', filter: { canTake10: true }, storeAs: 'chosen2', prompt: '...to which Pokémon?' }),
      { type: 'MOVE_DC' },
    ],
  },
  'Energy Trans': {
    effects: [
      CH_POKE({ player: 'self', zone: 'all', filter: { hasEnergyType: 'grass' }, prompt: 'Take a Grass Energy from...' }),
      { type: 'CHOOSE', what: 'energy', from: 'chosen', count: 1, filter: { energyType: 'grass' }, prompt: 'Choose a Grass Energy' },
      CH_POKE({ player: 'self', zone: 'all', storeAs: 'chosen2', prompt: 'Attach it to which Pokémon?' }),
      { type: 'MOVE_ENERGY' },
    ],
  },
  'Buzzap': {
    oncePerTurn: true,
    effects: [
      { type: 'CHOOSE', what: 'type', prompt: 'Choose the energy type Electrode will provide' },
      CH_POKE({ player: 'self', zone: 'all', filter: { notSelf: true }, prompt: 'Attach Electrode to which Pokémon?' }),
      { type: 'BUZZAP' },
    ],
  },
  // Passive powers -- no activated effects:
  // Rain Dance: sandbox has no once-per-turn energy limit, so extra water attachments are already legal.
  // Energy Burn: handled inside costMatch (all attached energy counts as fire).
  // Strikes Back: triggered inside applyDamage.
  'Rain Dance': { passive: true },
  'Energy Burn': { passive: true },
  'Strikes Back': { passive: true },
}

// Effect encodings for every Base Set, Jungle, and Fossil card, expressed on
// top of the engine's effect primitives. Attacks with a plain numeric damage
// value get a DAMAGE effect auto-queued by the engine; entries here only add
// the extra behavior. Lookup order: "CardName:AttackName" then "AttackName".
// (Re-printed cards use their set-qualified name, e.g. "Zapdos (Fossil)".)

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
const CH_CARDS = (o) => ({ type: 'CHOOSE', what: 'cards', ...o })
const CH_POKE = (o) => ({ type: 'CHOOSE', what: 'pokemon', ...o })
const MV = (o) => ({ type: 'MOVE_CARDS', ...o })
// "Search your deck for a Basic Pokémon named X and put it onto your Bench"
const CALL_FOR_FAMILY = (species) => ({
  requires: 'benchSpace',
  effects: [
    CH_CARDS({ from: 'deck', count: 1, filter: { basicPokemon: true, speciesIn: species }, optional: true, prompt: `Choose ${species.join(' or ')} from your deck` }),
    MV({ from: 'chosen', to: 'bench' }),
    { type: 'SHUFFLE_DECK' },
  ],
})
// Tail Wag / Leer approximation: full guard on self next turn on heads
const GUARD_ALL_FLIP = { effects: [{ type: 'APPLY_GUARD', target: 'self', kind: 'all', flip: 1, if: 'heads' }] }
// Spark / Dark Mind / Stretch Kick: pick one opposing benched pokemon, hit it
const BENCH_SNIPE = (amount) => ({
  effects: [
    CH_POKE({ player: 'opp', zone: 'bench', optional: true, prompt: 'Choose an opposing Benched Pokémon' }),
    { type: 'DAMAGE', target: 'chosen', amount },
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

  // --- Wizards Black Star Promos (pre-Rocket) ---
  // Growl: the defender's attacks do 10 less to Pikachu next turn
  'Growl': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'reduceDamage', value: 10, duration: 1 }] },
  // Light Screen: attacks do half damage to Electabuzz next turn
  'Light Screen': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'halveDamage', duration: 1 }] },
  'Energy Absorption': {
    effects: [
      CH_CARDS({ from: 'discard', upTo: 2, filter: { supertype: 'energy' }, precheck: true, prompt: 'Choose up to 2 Energy cards from your discard pile' }),
      { type: 'ATTACH_ENERGY' },
    ],
  },
  'Recharge': {
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { energyOfType: 'lightning' }, optional: true, prompt: 'Choose a Lightning Energy card from your deck' }),
      { type: 'ATTACH_ENERGY' },
      { type: 'SHUFFLE_DECK' },
    ],
  },
  'Supersonic Flight': { manual: true, effects: [D(60, { flip: 1, if: 'heads' })] },
  'Flames of Rage': {
    manual: true,
    effects: [...COST_DISCARD(2, { energyType: 'fire' }), D({ base: 40, perDcOnSelf: 10 })],
  },
  'First Aid': { effects: [{ type: 'HEAL', target: 'self', amount: 10 }] },
  'Jigglypuff (Promo 7):Double-edge': { effects: [SELF(20)] },
  'Psywave': { manual: true, effects: [D({ perEnergyOnDefender: 10 })] },
  'Devolution Beam': {
    effects: [
      CH_POKE({ player: 'both', zone: 'all', filter: { evolved: true }, optional: true, prompt: 'Choose an evolved Pokémon to devolve' }),
      { type: 'DEVOLVE', toHand: true },
    ],
  },
  // Cat Punch: heads hits the defender; tails lets the opponent pick a benched
  // pokemon to take the hit (no bench: nothing happens on tails).
  'Cat Punch': {
    manual: true,
    effects: [
      D(20, { flip: 1, if: 'heads' }),
      CH_POKE({ player: 'opp', zone: 'bench', optional: true, chooser: 'opp', if: 'tails', prompt: 'Opponent: choose a Benched Pokémon to take 20 damage' }),
      { type: 'DAMAGE', target: 'chosen', amount: 20, if: 'tails' },
    ],
  },
  'Energy Control': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'all', filter: { hasEnergy: true }, flip: 1, if: 'heads', prompt: "Take a basic Energy from which of your opponent's Pokémon?" }),
      { type: 'CHOOSE', what: 'energy', from: 'chosen', count: 1, if: 'heads', prompt: 'Choose an Energy card to move' },
      CH_POKE({ player: 'opp', zone: 'all', filter: { notChosen: true }, storeAs: 'chosen2', if: 'heads', prompt: "Attach it to which of your opponent's Pokémon?" }),
      { type: 'MOVE_ENERGY', if: 'heads' },
    ],
  },
  'Telekinesis': {
    manual: true,
    effects: [
      CH_POKE({ player: 'opp', zone: 'all', prompt: "Choose 1 of your opponent's Pokémon" }),
      { type: 'DAMAGE', target: 'chosen', amount: 30 },
    ],
  },
  'Texture Magic': {
    effects: [
      { type: 'CHOOSE', what: 'type', prompt: "Choose Cool Porygon's new Resistance" },
      { type: 'MODIFY_CARD', target: 'self', field: 'resistance', value: 'chosenType' },
      { type: 'CHOOSE', what: 'type', if: 'defenderHasWeakness', prompt: "Choose the Defending Pokémon's new Weakness" },
      { type: 'MODIFY_CARD', target: 'defender', field: 'weakness', value: 'chosenType', if: 'defenderHasWeakness' },
    ],
  },
  '3-D Attack': TIMES(20, 3),
  // Hyper Flame: 60, then heads discards 1 fire / tails discards everything
  'Hyper Flame': {
    effects: [
      { type: 'CHOOSE', what: 'energy', from: 'self', count: 1, filter: { energyType: 'fire' }, flip: 1, if: 'heads', prompt: 'Discard 1 Fire Energy from Moltres' },
      { type: 'DISCARD_ENERGY', if: 'heads' },
      { type: 'DISCARD_ENERGY', from: 'self', count: 'all', if: 'tails' },
    ],
  },
  'Diamond Dust': {
    effects: [
      ST('paralyzed', { flip: 1, if: 'heads' }),
      { type: 'DAMAGE', each: { player: 'opp', zone: 'bench' }, amount: 10, if: 'heads' },
    ],
  },
  // Lightning Burn: heads redirects the 30 to a chosen benched pokemon
  // (defender when there's no bench); tails hits the defender and Zapdos.
  'Lightning Burn': {
    manual: true,
    effects: [
      CH_POKE({ player: 'opp', zone: 'bench', optional: true, flip: 1, if: 'heads', prompt: 'Choose an opposing Benched Pokémon to take the 30 damage' }),
      { type: 'DAMAGE', target: 'chosen', amount: 30, fallback: 'defender', if: 'heads' },
      D(30, { if: 'tails' }),
      SELF(30, { if: 'tails' }),
    ],
  },
  'Kakuna:Poisonpowder': FLIP_ST('poisoned'),
  'Jynx:Doubleslap': TIMES(10),
  'Poliwhirl:Doubleslap': TIMES(30),
  'Jynx:Meditate': { manual: true, effects: [D({ base: 20, perDcOnDefender: 10 })] },
  'Mr. Mime:Meditate': { manual: true, effects: [D({ base: 10, perDcOnDefender: 10 })] },
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

  // =========================================================== Jungle ===
  'Quick Attack': { manual: true, effects: [D({ base: 10, perHeads: 20 }, { flip: 1 })] },
  'Stomp': { manual: true, effects: [D({ base: 20, perHeads: 10 }, { flip: 1 })] },
  'Rage': { manual: true, effects: [D({ base: 10, perDcOnSelf: 10 })] }, // Dodrio & Cubone
  'Pin Missile': TIMES(20, 4),
  'Comet Punch': TIMES(20, 4),
  'Bonemerang': TIMES(30, 2),
  'Fury Swipes': TIMES(20, 3), // Primeape / Sandslash
  'Nidoran ♀:Fury Swipes': TIMES(10, 3),
  'Psyduck:Fury Swipes': TIMES(10, 3),
  'Chain Lightning': {
    effects: [{ type: 'DAMAGE', each: { player: 'both', zone: 'bench', filter: { sameTypeAsDefender: true } }, amount: 10 }],
  },
  'Fetch': { effects: [MV({ from: 'deck', to: 'hand', count: 1 })] },
  'Boyfriends': { manual: true, effects: [D({ base: 20, perInPlay: { species: 'Nidoking', each: 20 } })] },
  'Hurricane': { effects: [{ type: 'BOUNCE', target: 'defender' }] },
  'Swords Dance': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'swordsDance', duration: 2 }] },
  'Scyther:Slash': { manual: true, effects: [D({ base: 30, plusIfMarker: { marker: 'swordsDance', plus: 30 } })] },
  'Minimize': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'reduceDamage', value: 20, duration: 1 }] },
  'Pounce': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'reduceDamage', value: 10, duration: 1 }] },
  'Snivel': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'reduceDamage', value: 20, duration: 1 }] },
  'Body Slam': FLIP_ST('paralyzed'),
  'Pinsir:Irongrip': FLIP_ST('paralyzed'),
  'Tongue Wrap': FLIP_ST('paralyzed'),
  'Venom Powder': { effects: [ST('confused', { flip: 1, if: 'heads' }), ST('poisoned', { if: 'heads' })] },
  'Weepinbell:Poisonpowder': FLIP_ST('poisoned'), // flip variant of the base auto-poison
  'Victreebel:Acid': { effects: [{ type: 'SET_MARKER', target: 'defender', marker: 'noRetreat', duration: 1 }] },
  'Petal Dance': {
    manual: true,
    effects: [D({ timesHeads: 40 }, { flip: 3 }), { type: 'INFLICT_STATUS', target: 'self', status: 'confused' }],
  },
  'Lullaby': { effects: [ST('asleep')] },
  'Spore': { effects: [ST('asleep')] },
  'Do the Wave': { manual: true, effects: [D({ base: 10, perBench: 10 })] },
  'Mega Drain': { effects: [{ type: 'HEAL', target: 'self', amount: 'halfDealt' }] },
  'Teleport': {
    effects: [
      { type: 'CHOOSE', what: 'pokemon', player: 'self', zone: 'bench', prompt: 'Switch with which Benched Pokémon?' },
      { type: 'SWITCH_ACTIVE', player: 'self' },
    ],
  },
  'Big Eggsplosion': { manual: true, effects: [D({ timesHeads: 20 }, { flip: 'perEnergy' })] },
  'Foul Odor': { effects: [ST('confused'), { type: 'INFLICT_STATUS', target: 'self', status: 'confused' }] },
  'Supersonic': FLIP_ST('confused'),
  'Marowak:Call for Friend': {
    requires: 'benchSpace',
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { basicPokemon: true, pokemonType: 'fighting' }, optional: true, prompt: 'Choose a Fighting Basic Pokémon from your deck' }),
      MV({ from: 'chosen', to: 'bench' }),
      { type: 'SHUFFLE_DECK' },
    ],
  },
  'Bellsprout:Call for Family': CALL_FOR_FAMILY(['Bellsprout']),
  'Nidoran ♀:Call for Family': CALL_FOR_FAMILY(['Nidoran ♂', 'Nidoran ♀']),
  'Krabby:Call for Family': CALL_FOR_FAMILY(['Krabby']),
  'Sprout': CALL_FOR_FAMILY(['Oddish']),
  'Tantrum': { effects: [{ type: 'INFLICT_STATUS', target: 'self', status: 'confused', flip: 1, if: 'tails' }] },
  'Rampage': {
    manual: true,
    effects: [D({ base: 20, perDcOnSelf: 10 }), { type: 'INFLICT_STATUS', target: 'self', status: 'confused', flip: 1, if: 'tails' }],
  },
  'Tail Wag': GUARD_ALL_FLIP, // approximation: defender can't hurt Eevee next turn
  'Leer': GUARD_ALL_FLIP,
  'Leech Life': { effects: [{ type: 'HEAL', target: 'self', amount: 'dealt' }] },
  'Pay Day': { effects: [MV({ from: 'deck', to: 'hand', count: 1, flip: 1, if: 'heads' })] },
  'Spark': BENCH_SNIPE(10),
  'Rhydon:Ram': {
    effects: [
      SELF(20),
      { type: 'CHOOSE', what: 'pokemon', player: 'opp', zone: 'bench', optional: true, chooser: 'opp', prompt: 'Opponent chooses a Benched Pokémon to switch in' },
      { type: 'SWITCH_ACTIVE', player: 'opp' },
    ],
  },
  'Vaporeon:Water Gun': WATER_GUN(30),

  // =========================================================== Fossil ===
  'Freeze Dry': FLIP_ST('paralyzed'),
  'Blizzard': {
    effects: [
      { type: 'DAMAGE', each: { player: 'opp', zone: 'bench' }, amount: 10, flip: 1, if: 'heads' },
      { type: 'DAMAGE', each: { player: 'self', zone: 'bench' }, amount: 10, if: 'tails' },
    ],
  },
  'Dark Mind': BENCH_SNIPE(10),
  'Stretch Kick': BENCH_SNIPE(20),
  'Prophecy': {
    effects: [
      { type: 'CHOOSE', what: 'option', options: [{ id: 'myDeck', label: 'Your deck' }, { id: 'oppDeck', label: "Your opponent's deck" }], prompt: 'Look at the top 3 cards of which deck?' },
      { type: 'CHOOSE', what: 'order', count: 3, deck: 'fromOption', prompt: 'Rearrange the top 3 cards (click in new order, top first)' },
      { type: 'REORDER_DECK', deck: 'fromOption' },
    ],
  },
  'Absorb': { effects: [{ type: 'HEAL', target: 'self', amount: 'halfDealt' }] },
  'Lapras:Water Gun': WATER_GUN(10),
  'Omanyte:Water Gun': WATER_GUN(10),
  'Omastar:Water Gun': WATER_GUN(20),
  'Seadra:Water Gun': WATER_GUN(20),
  'Lapras:Confuse Ray': FLIP_ST('confused'),
  'Sonicboom': { manual: true, effects: [D(20, { noWR: true })] },
  'Magneton (Fossil):Selfdestruct': SELFDESTRUCT(20, 100),
  'Golem:Selfdestruct': SELFDESTRUCT(20, 100),
  'Weezing:Selfdestruct': SELFDESTRUCT(10, 60),
  'Wildfire': {
    manual: true,
    effects: [
      { type: 'CHOOSE', what: 'energy', from: 'self', upTo: 99, filter: { energyType: 'fire' }, optional: true, isCost: true, prompt: 'Discard any number of Fire Energy from Moltres' },
      { type: 'DISCARD_ENERGY', isCost: true },
      MV({ player: 'opp', from: 'deck', to: 'discard', count: 'lastDiscarded' }),
    ],
  },
  'Dive Bomb': { manual: true, effects: [D(80, { flip: 1, if: 'heads' })] },
  'Sludge': FLIP_ST('poisoned'),
  'Smog': FLIP_ST('poisoned'),
  'Spit Poison': FLIP_ST('poisoned'),
  'Gigashock': { effects: [{ type: 'DAMAGE', each: { player: 'opp', zone: 'bench', limit: 3 }, amount: 10 }] },
  'Thunderstorm': {
    manual: true,
    effects: [D(40), { type: 'DAMAGE_PER_FLIP', each: { player: 'opp', zone: 'bench' }, amount: 20, selfPerTails: 10 }],
  },
  'Terror Strike': {
    effects: [
      { type: 'CHOOSE', what: 'pokemon', player: 'opp', zone: 'bench', optional: true, chooser: 'opp', flip: 1, if: 'heads', prompt: 'Opponent chooses a Benched Pokémon to switch in' },
      { type: 'SWITCH_ACTIVE', player: 'opp', if: 'heads' },
    ],
  },
  'Poison Fang': { effects: [ST('poisoned')] },
  'Jellyfish Sting': { effects: [ST('poisoned')] },
  'Clamp': { manual: true, effects: [D(30, { flip: 1, if: 'heads' }), ST('paralyzed', { if: 'heads' })] },
  'Spike Cannon': TIMES(30, 2),
  'Dragonite:Slam': TIMES(40, 2),
  'Lick': FLIP_ST('paralyzed'),
  'Energy Conversion': {
    effects: [
      CH_CARDS({ from: 'discard', upTo: 2, filter: { supertype: 'energy' }, prompt: 'Choose up to 2 Energy cards from your discard pile' }),
      MV({ from: 'chosen', to: 'hand' }),
      SELF(10),
    ],
  },
  'Nightmare': { effects: [ST('asleep')] },
  'Nasty Goo': FLIP_ST('paralyzed'),
  'Smokescreen': { effects: [{ type: 'ACCURACY_DEBUFF', target: 'defender' }] },
  'Stone Barrage': { manual: true, effects: [D({ timesHeads: 10 }, { flip: 'untilTails' })] },
  'Headache': { effects: [{ type: 'TRAINER_BLOCK' }] },
  'Hide in Shell': GUARD_FLIP,
  'Spacing Out': { requires: 'selfDamaged', effects: [{ type: 'HEAL', target: 'self', amount: 10, flip: 1, if: 'heads' }] },
  'Scavenge': {
    effects: [
      ...COST_DISCARD(1, { energyType: 'psychic' }),
      CH_CARDS({ from: 'discard', count: 1, filter: { supertype: 'trainer' }, precheck: true, prompt: 'Choose a Trainer card from your discard pile' }),
      MV({ from: 'chosen', to: 'hand' }),
    ],
  },
  'Wrap': FLIP_ST('paralyzed'),

  // ====================================================== Team Rocket ===
  'Dark Alakazam:Teleport Blast': {
    effects: [
      CH_POKE({ player: 'self', zone: 'bench', optional: true, prompt: 'Switch Dark Alakazam with a Benched Pokémon?' }),
      { type: 'SWITCH_ACTIVE', player: 'self' },
    ],
  },
  // Mind Shock ignores W/R (per-card damage values)
  'Dark Alakazam:Mind Shock': { manual: true, effects: [D(40, { noWR: true })] },
  'Dark Kadabra:Mind Shock': { manual: true, effects: [D(30, { noWR: true })] },
  "Sabrina's Drowzee (Challenge):Mind Shock": { manual: true, effects: [D(20, { noWR: true })] },
  // Stare: snipe 10 (no W/R) and shut that pokemon's power off for a turn
  'Stare': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'all', prompt: "Choose 1 of your opponent's Pokémon" }),
      { type: 'SET_MARKER', target: 'chosen', marker: 'powerOff', duration: 1 },
      { type: 'DAMAGE', target: 'chosen', amount: 10 },
    ],
  },
  'Poison Vapor': {
    effects: [ST('poisoned'), { type: 'DAMAGE', each: { player: 'opp', zone: 'bench' }, amount: 10 }],
  },
  'Hydrocannon': { manual: true, effects: [D({ base: 30, perExtraEnergy: { type: 'water', each: 20, max: 2 } })] },
  'Rocket Tackle': {
    effects: [SELF(10), { type: 'APPLY_GUARD', target: 'self', kind: 'damage', flip: 1, if: 'heads' }],
  },
  'Continuous Fireball': {
    manual: true,
    effects: [
      D({ timesHeads: 50 }, { flip: { count: 'selfEnergyType', energyType: 'fire' } }),
      { type: 'DISCARD_ENERGY', from: 'self', count: 'heads', filter: { energyType: 'fire' } },
    ],
  },
  'Giant Tail': { manual: true, effects: [D(70, { flip: 1, if: 'heads' })] },
  'Knock Down': { manual: true, effects: [D({ base: 20, timesTails: 20 }, { flip: 1 })] },
  'Flitter': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'all', prompt: "Choose 1 of your opponent's Pokémon" }),
      { type: 'DAMAGE', target: 'chosen', amount: 20 },
    ],
  },
  'Fickle Attack': { manual: true, effects: [D(40, { flip: 1, if: 'heads' })] },
  'Hyper Fang': { manual: true, effects: [D(50, { flip: 1, if: 'heads' })] },
  'Bench Manipulation': {
    manual: true,
    effects: [D({ timesTails: 20 }, { flip: { count: 'oppBench' }, noWR: true })],
  },
  'Fling': { requires: 'oppBench', effects: [{ type: 'SHUFFLE_INTO_DECK', target: 'defender' }] },
  'Magnetic Lines': {
    effects: [
      { type: 'CHOOSE', what: 'energy', from: 'defender', count: 1, optional: true, prompt: 'Choose an Energy on the Defending Pokémon' },
      CH_POKE({ player: 'opp', zone: 'bench', optional: true, prompt: 'Attach it to which opposing Benched Pokémon?' }),
      { type: 'MOVE_ENERGY', fromDefender: true },
    ],
  },
  'Petal Whirlwind': {
    manual: true,
    effects: [
      D({ timesHeads: 30 }, { flip: 3 }),
      { type: 'INFLICT_STATUS', target: 'self', status: 'confused', if: 'headsEq2' },
      { type: 'INFLICT_STATUS', target: 'self', status: 'confused', if: 'headsEq3' },
    ],
  },
  'Mass Explosion': {
    manual: true,
    effects: [
      D({ perInPlay: { speciesIn: ['Koffing', 'Weezing', 'Dark Weezing'], player: 'both', each: 20 } }),
      { type: 'DAMAGE', each: { player: 'both', zone: 'all', filter: { speciesIn: ['Koffing', 'Weezing', 'Dark Weezing'] } }, amount: 20 },
    ],
  },
  'Stun Gas': { effects: [ST('poisoned', { flip: 1, if: 'heads' }), ST('paralyzed', { if: 'tails' })] },
  'Fireball': {
    manual: true,
    requires: 'hasEnergyType:fire',
    effects: [
      D(70, { flip: 1, if: 'heads' }),
      { type: 'CHOOSE', what: 'energy', from: 'self', count: 1, filter: { energyType: 'fire' }, if: 'heads', prompt: 'Discard 1 Fire Energy' },
      { type: 'DISCARD_ENERGY', if: 'heads' },
    ],
  },
  'Dark Dragonair:Tail Strike': { manual: true, effects: [D({ base: 20, perHeads: 20 }, { flip: 1 })] },
  "Erika's Dratini:Tail Strike": { manual: true, effects: [D({ base: 10, perHeads: 20 }, { flip: 1 })] },
  // Energy Bomb: everything moves to a benched pokemon (simplified to one
  // target); no bench means it all hits the discard pile
  'Energy Bomb': {
    effects: [
      CH_POKE({ player: 'self', zone: 'bench', optional: true, prompt: 'Move all Energy to which Benched Pokémon?' }),
      { type: 'MOVE_ENERGY', fromSource: true, all: true },
      { type: 'DISCARD_ENERGY', from: 'self', count: 'all', if: 'noSelfBench' },
    ],
  },
  'Playing with Fire': {
    manual: true,
    requires: 'hasEnergyType:fire',
    effects: [
      D({ base: 30, perHeads: 20 }, { flip: 1 }),
      { type: 'CHOOSE', what: 'energy', from: 'self', count: 1, filter: { energyType: 'fire' }, if: 'heads', prompt: 'Discard 1 Fire Energy' },
      { type: 'DISCARD_ENERGY', if: 'heads' },
    ],
  },
  'Third Eye': { effects: [...COST_DISCARD(1), MV({ from: 'deck', to: 'hand', count: 3 })] },
  'Lightning Flash': { effects: [{ type: 'ACCURACY_DEBUFF', target: 'defender' }] },
  'Thunder Attack': { effects: [ST('paralyzed', { flip: 1, if: 'heads' }), SELF(10, { if: 'tails' })] },
  'Drag Off': {
    manual: true,
    requires: 'oppBench',
    effects: [
      CH_POKE({ player: 'opp', zone: 'bench', prompt: 'Drag in which Benched Pokémon?' }),
      { type: 'SWITCH_ACTIVE', player: 'opp' },
      D(20),
    ],
  },
  'Knock Back': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'bench', optional: true, chooser: 'opp', prompt: 'Opponent chooses a Benched Pokémon to switch in' }),
      { type: 'SWITCH_ACTIVE', player: 'opp' },
    ],
  },
  'Sludge Punch': { effects: [ST('poisoned')] },
  'Fascinate': {
    requires: 'oppBench',
    effects: [
      CH_POKE({ player: 'opp', zone: 'bench', flip: 1, if: 'heads', prompt: 'Choose the opposing Benched Pokémon to switch in' }),
      { type: 'SWITCH_ACTIVE', player: 'opp', if: 'heads' },
    ],
  },
  'Poison Claws': FLIP_ST('poisoned'),
  'Frenzied Attack': { effects: [{ type: 'INFLICT_STATUS', target: 'self', status: 'confused' }] },
  'Flame Pillar': {
    effects: [
      { type: 'CHOOSE', what: 'energy', from: 'self', count: 1, filter: { energyType: 'fire' }, optional: true, prompt: 'Discard 1 Fire Energy to hit the Bench?' },
      { type: 'DISCARD_ENERGY' },
      CH_POKE({ player: 'opp', zone: 'bench', optional: true, if: 'discardedEnergy', prompt: 'Choose an opposing Benched Pokémon' }),
      { type: 'DAMAGE', target: 'chosen', amount: 10, if: 'discardedEnergy' },
    ],
  },
  'Dark Wartortle:Doubleslap': TIMES(10),
  'Mirror Shell': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'reflectEqual', duration: 1 }] },
  'Rapid Evolution': {
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { evolvesFrom: 'Magikarp' }, optional: true, prompt: 'Choose Gyarados or Dark Gyarados from your deck' }),
      { type: 'EVOLVE', useSource: true },
      { type: 'SHUFFLE_DECK' },
    ],
  },
  // Vanish: attached cards technically discard; simplified to Mr. Fuji-style
  'Vanish': { effects: [{ type: 'SHUFFLE_INTO_DECK', target: 'self' }] },
  'Dig Under': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'all', prompt: "Choose 1 of your opponent's Pokémon" }),
      { type: 'DAMAGE', target: 'chosen', amount: 10 },
    ],
  },
  'Grimer (Rocket):Poison Gas': { effects: [ST('asleep')] },
  'Koffing (Rocket):Poison Gas': FLIP_ST('poisoned'),
  'Sticky Hands': { manual: true, effects: [D({ base: 10, perHeads: 20 }, { flip: 1 }), ST('paralyzed', { if: 'heads' })] },
  'Magnetism': {
    manual: true,
    effects: [D({ base: 10, perInPlay: { speciesIn: ['Magnemite', 'Magneton', 'Dark Magneton'], zone: 'bench', each: 10 } })],
  },
  'Mischief': { effects: [{ type: 'SHUFFLE_DECK', player: 'opp' }] },
  'Anger': { manual: true, effects: [D({ base: 20, perHeads: 20 }, { flip: 1 })] },
  'Coin Hurl': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'all', prompt: "Choose 1 of your opponent's Pokémon" }),
      { type: 'DAMAGE', target: 'chosen', amount: 20, flip: 1, if: 'heads' },
    ],
  },
  'Sleep Powder': { effects: [ST('asleep')] },
  'Dizziness': { effects: [MV({ from: 'deck', to: 'hand', count: 1 })] },
  'Psyduck (Rocket):Water Gun': WATER_GUN(20),
  'Rattata (Rocket):Quick Attack': { manual: true, effects: [D({ base: 10, perHeads: 10 }, { flip: 1 })] },
  'Afternoon Nap': {
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { energyOfType: 'psychic' }, optional: true, prompt: 'Choose a Psychic Energy from your deck' }),
      { type: 'ATTACH_ENERGY' },
      { type: 'SHUFFLE_DECK' },
    ],
  },
  // Surprise Thunder: heads -> a second coin decides 20 or 10 to the bench
  'Surprise Thunder': {
    effects: [
      {
        type: 'CHAIN', flip: 1, if: 'heads',
        effects: [{ type: 'DAMAGE', each: { player: 'opp', zone: 'bench' }, amount: { base: 10, perHeads: 10 }, flip: 1 }],
      },
    ],
  },

  // ======================================================= Gym Heroes ===
  'Phoenix Flame': { effects: [{ type: 'SHUFFLE_INTO_DECK', target: 'self', flip: 1, if: 'tails' }] },
  'Lariat': { manual: true, effects: [D(70, { flip: 1, if: 'heads' })] },
  'Fairy Power': {
    effects: [
      CH_POKE({ player: 'self', zone: 'all', optional: true, flip: 1, if: 'heads', prompt: 'Return which of your Pokémon to your hand?' }),
      { type: 'BOUNCE', target: 'chosen', if: 'heads' },
    ],
  },
  'Take Away': {
    manual: true,
    effects: [{ type: 'SHUFFLE_INTO_DECK', target: 'defender' }, { type: 'SHUFFLE_INTO_DECK', target: 'self' }],
  },
  'Charge': {
    effects: [
      CH_CARDS({ from: 'discard', upTo: 2, filter: { energyOfType: 'lightning' }, prompt: 'Choose up to 2 Lightning Energy from your discard pile' }),
      { type: 'ATTACH_ENERGY' },
    ],
  },
  "Lt. Surge's Pikachu:Charge": {
    effects: [
      CH_CARDS({ from: 'discard', count: 1, filter: { energyOfType: 'lightning' }, prompt: 'Choose a Lightning Energy from your discard pile' }),
      { type: 'ATTACH_ENERGY' },
    ],
  },
  'Discharge': {
    manual: true,
    effects: [
      { type: 'DISCARD_ENERGY', from: 'self', count: 'all', filter: { energyType: 'lightning' }, isCost: true },
      D({ timesHeads: 30 }, { flip: { count: 'lastDiscarded' } }),
    ],
  },
  'Repeating Drill': TIMES(10, 5),
  'Clutch': { effects: [{ type: 'SET_MARKER', target: 'defender', marker: 'noRetreat', duration: 1 }] },
  'Mega Shock': { effects: [SELF(20, { flip: 1, if: 'tails' })] },
  'Knockout Needle': { manual: true, effects: [D(90, { flip: 2, if: 'allHeads' }), D(30, { if: 'notAllHeads' })] },
  'Jellyfish Poison': { effects: [ST('poisoned', { flip: 1, if: 'heads' }), ST('confused', { if: 'tails' })] },
  'Crosscounter': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'reflectDouble', duration: 1 }] },
  'Fire Wall': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'reflect10', duration: 1 }] },
  'Shadow Images': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'shadowImages' }] },
  'Pain Amplifier': {
    effects: [{ type: 'DAMAGE', each: { player: 'opp', zone: 'all', filter: { damaged: true } }, amount: 10 }],
  },
  'Call of the Night': {
    effects: [{ type: 'CHAIN', flip: 2, if: 'allHeads', effects: [{ type: 'SHUFFLE_INTO_DECK', target: 'defender' }] }],
  },
  'Rock Slide': { effects: [{ type: 'DAMAGE', each: { player: 'opp', zone: 'bench', limit: 3 }, amount: 10 }] },
  'Tunneling': {
    requires: 'oppBench',
    effects: [
      { type: 'DAMAGE', each: { player: 'opp', zone: 'bench', limit: 2 }, amount: 20 },
      { type: 'ATTACK_LOCK', self: true, all: true },
    ],
  },
  'Horn Toss': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'bench', optional: true, chooser: 'opp', prompt: 'Opponent chooses a Benched Pokémon to switch in' }),
      { type: 'SWITCH_ACTIVE', player: 'opp' },
    ],
  },
  "Brock's Rhyhorn:Take Down": { effects: [SELF(10)] },
  'Needles': { effects: [ST('paralyzed', { flip: 1, if: 'heads' }), ST('poisoned', { if: 'heads' })] },
  'Sandstorm': { effects: [{ type: 'ACCURACY_DEBUFF', target: 'defender' }] },
  'Alert': {
    requires: 'selfBench',
    effects: [
      MV({ from: 'deck', to: 'hand', count: 1 }),
      CH_POKE({ player: 'self', zone: 'bench', prompt: 'Switch with which Benched Pokémon?' }),
      { type: 'SWITCH_ACTIVE', player: 'self' },
    ],
  },
  'Moonwatching': {
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { basicEnergy: true }, optional: true, prompt: 'Choose a basic Energy from your deck' }),
      MV({ from: 'chosen', to: 'hand' }),
      { type: 'SHUFFLE_DECK' },
    ],
  },
  'Comet Slap': TIMES(10, 3),
  'Electric Current': {
    effects: [
      { type: 'CHOOSE', what: 'energy', from: 'self', count: 1, filter: { energyType: 'lightning' }, prompt: 'Choose a Lightning Energy to move' },
      CH_POKE({ player: 'self', zone: 'bench', optional: true, prompt: 'Attach it to which Benched Pokémon?' }),
      { type: 'MOVE_ENERGY', fromSource: true },
      { type: 'DISCARD_ENERGY', from: 'self', count: 1, filter: { energyType: 'lightning' }, if: 'noChosen' },
    ],
  },
  'Triple Cannon': TIMES(20, 3),
  'Water Ring': {
    effects: [{ type: 'DAMAGE', each: { player: 'both', zone: 'bench', filter: { notType: 'water' } }, amount: 10 }],
  },
  'Mysterious Light': FLIP_ST('asleep'),
  'Jellyfish Pod': {
    effects: [
      CH_CARDS({ from: 'deck', upTo: 4, filter: { speciesIn: ['Tentacool', 'Tentacruel', "Misty's Tentacool", "Misty's Tentacruel"] }, optional: true, prompt: 'Choose Tentacool/Tentacruel cards from your deck' }),
      MV({ from: 'chosen', to: 'hand' }),
      { type: 'SHUFFLE_DECK' },
    ],
  },
  'Collapse': { effects: [{ type: 'INFLICT_STATUS', target: 'self', status: 'asleep' }] },
  "Sabrina's Venomoth:Healing Pollen": {
    effects: [{ type: 'HEAL', each: { player: 'self', zone: 'all', filter: { damaged: true } }, amount: { perHeads: 10 }, flip: 3 }],
  },
  'Sonic Distortion': { effects: [ST('confused', { flip: 2, if: 'heads' })] },
  'Shake': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'bench', optional: true, chooser: 'opp', prompt: 'Opponent chooses a Benched Pokémon to switch in' }),
      { type: 'SWITCH_ACTIVE', player: 'opp' },
    ],
  },
  'Fire Tackle': { effects: [SELF(10)] },
  "Child's Punch": { manual: true, effects: [D(10, { flip: 1, if: 'heads' })] },
  'One-Two Punch': { manual: true, effects: [D({ base: 30, perHeads: 10 }, { flip: 1 })] },
  'Firebreathing': { manual: true, effects: [D({ base: 10, perHeads: 10 }, { flip: 1 })] },
  'Lava Burst': {
    manual: true,
    effects: [
      MV({ from: 'deck', to: 'discard', count: 5 }),
      D({ perLastMovedEnergy: { type: 'fire', each: 20 } }),
    ],
  },
  'Lucky Shot': {
    requires: 'oppBench',
    effects: [
      CH_POKE({ player: 'opp', zone: 'bench', prompt: 'Choose an opposing Benched Pokémon' }),
      { type: 'DAMAGE', target: 'chosen', amount: 30, flip: 1, if: 'heads' },
    ],
  },
  'Spiral Dive': { effects: [{ type: 'DAMAGE', each: { player: 'opp', zone: 'all' }, amount: 10 }] },
  "Brock's Graveler:Rock Toss": TIMES(20, 3),
  "Brock's Geodude (Challenge):Rock Toss": TIMES(10, 3),
  'Deflector': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'halveDamage', duration: 1 }] },
  'Egg Bomb': { manual: true, effects: [D(40, { flip: 1, if: 'heads' }), SELF(20, { if: 'tails' })] },
  'Psychic Exchange': {
    effects: [MV({ from: 'hand', to: 'deck', count: 'all', shuffle: true }), MV({ from: 'deck', to: 'hand', count: 5 })],
  },
  "Erika's Exeggutor:Stomp": { manual: true, effects: [D({ base: 30, perHeads: 10 }, { flip: 1 })] },
  "Erika's Gloom:Healing Pollen": { effects: [{ type: 'HEAL', target: 'self', amount: 40, flip: 1, if: 'heads' }] },
  'Magic Pollen': {
    effects: [
      {
        type: 'CHOOSE', what: 'option', flip: 1, if: 'heads',
        options: [
          { id: 'asleep', label: 'Asleep' },
          { id: 'confused', label: 'Confused' },
          { id: 'paralyzed', label: 'Paralyzed' },
          { id: 'poisoned', label: 'Poisoned' },
        ],
        prompt: 'Choose a special condition',
      },
      ST('fromOption', { if: 'heads' }),
    ],
  },
  'Dream Dance': { effects: [ST('asleep'), { type: 'INFLICT_STATUS', target: 'self', status: 'asleep' }] },
  'Vile Smell': { effects: [ST('confused'), { type: 'INFLICT_STATUS', target: 'self', status: 'confused' }] },
  "Erika's Oddish:Poisonpowder": FLIP_ST('poisoned'),
  'Flytrap': {
    manual: true,
    requires: 'oppBench',
    effects: [
      CH_POKE({ player: 'opp', zone: 'bench', prompt: 'Switch in which opposing Benched Pokémon?' }),
      { type: 'SWITCH_ACTIVE', player: 'opp' },
      D(20),
    ],
  },
  'Sleep Poison': { effects: [ST('asleep'), ST('poisoned')] },
  'Removal Pulse': {
    effects: [
      { type: 'CHOOSE', what: 'energy', from: 'defender', count: 1, flip: 1, if: 'heads', prompt: 'Choose an Energy to discard' },
      { type: 'DISCARD_ENERGY', if: 'heads' },
    ],
  },
  'Confusion Pulse': FLIP_ST('confused'),
  'Rapids': {
    effects: [
      { type: 'CHOOSE', what: 'energy', from: 'defender', count: 1, flip: 1, if: 'heads', prompt: 'Choose an Energy to discard' },
      { type: 'DISCARD_ENERGY', if: 'heads' },
    ],
  },
  'Water Punch': {
    manual: true,
    effects: [D({ base: 30, perHeads: 10 }, { flip: { count: 'selfEnergyType', energyType: 'water' } })],
  },
  "Misty's Psyduck:Call for Friend": {
    requires: 'benchSpace',
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { basicPokemon: true, nameIncludes: 'Misty' }, optional: true, flip: 1, if: 'heads', prompt: 'Choose a Misty Basic Pokémon from your deck' }),
      MV({ from: 'chosen', to: 'bench' }),
      { type: 'SHUFFLE_DECK' },
    ],
  },
  "Brock's Geodude (Heroes 66):Call for Friend": {
    requires: 'benchSpace',
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { basicPokemon: true, nameIncludes: 'Brock' }, optional: true, flip: 1, if: 'heads', prompt: 'Choose a Brock Basic Pokémon from your deck' }),
      MV({ from: 'chosen', to: 'bench' }),
      { type: 'SHUFFLE_DECK' },
    ],
  },
  'Mud Splash': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'bench', optional: true, prompt: 'Choose an opposing Benched Pokémon' }),
      { type: 'DAMAGE', target: 'chosen', amount: 10, flip: 1, if: 'heads' },
    ],
  },
  "Misty's Starmie:Water Gun": WATER_GUN(10),
  'Crystal Beam': { effects: [{ type: 'ENERGY_BLOCK', flip: 1, if: 'heads' }] },
  'Night Spirits': {
    manual: true,
    effects: [D({ timesHeads: 30 }, { flip: { count: 'speciesInPlay', species: ["Sabrina's Gastly", "Sabrina's Haunter", "Sabrina's Gengar"] } })],
  },
  'Good Night': { effects: [ST('asleep')] },
  'Good Morning': { effects: [{ type: 'CURE_STATUS', target: 'defender', only: 'asleep' }] },
  'Naptime': {
    effects: [
      {
        type: 'CHAIN', flip: 1, if: 'heads',
        effects: [
          { type: 'HEAL', target: 'self', amount: 30 },
          { type: 'INFLICT_STATUS', target: 'self', status: 'asleep' },
        ],
      },
    ],
  },
  'Screaming Headbutt': { effects: [{ type: 'ATTACK_LOCK', self: true }] },
  'Kindle': {
    effects: [
      ...COST_DISCARD(1),
      { type: 'CHOOSE', what: 'energy', from: 'defender', count: 1, optional: true, prompt: 'Choose an Energy to discard from the Defending Pokémon' },
      { type: 'DISCARD_ENERGY' },
    ],
  },
  'Blaze': { effects: [{ type: 'DAMAGE', each: { player: 'opp', zone: 'bench', filter: { typeIs: 'grass' } }, amount: 10 }] },
  '3-Pronged Tail': TIMES(10, 3),
  'Full Speed Charge': { manual: true, effects: [D({ timesHeads: 20 }, { flip: 4 }), SELF({ timesTails: 20 })] },
  'Tail Fan': FLIP_ST('confused'),
  // Hook Shot only ignores Resistance; approximated as no W/R
  'Hook Shot': { manual: true, effects: [D(20, { noWR: true })] },
  'Taunt': {
    requires: 'oppBench',
    effects: [
      CH_POKE({ player: 'opp', zone: 'bench', prompt: 'Switch in which opposing Benched Pokémon?' }),
      { type: 'SWITCH_ACTIVE', player: 'opp' },
    ],
  },
  'Fidget': { effects: [{ type: 'SHUFFLE_DECK' }] },
  "Brock's Mankey (Heroes 68):Karate Chop": { manual: true, effects: [D({ base: 40, perDcOnSelf: -10 })] },
  'Bellow': FLIP_ST('paralyzed'),
  'Drill Tackle': { manual: true, effects: [D(70, { flip: 2, if: 'allHeads' })] },
  'Defense Curl': GUARD_FLIP,
  'Sand Pit': { effects: [{ type: 'SET_MARKER', target: 'defender', marker: 'noRetreat', duration: 1 }] },
  "Brock's Zubat (Heroes 74):Poison Fang": FLIP_ST('poisoned'),
  'Poison Vine': FLIP_ST('poisoned'),
  'Careless Tackle': { effects: [SELF(10)] },
  'Eggsplosion': { manual: true, effects: [D({ timesHeads: 10 }, { flip: 'perEnergy' })] },
  "Erika's Exeggcute (Heroes 77):Psychic": { manual: true, effects: [D({ base: 10, perEnergyOnDefender: 10 })] },
  'Blot': { effects: [{ type: 'HEAL', target: 'self', amount: 10 }] },
  'Sporadic Sponging': { effects: [{ type: 'HEAL', target: 'self', amount: 10, flip: 1, if: 'heads' }] },
  "Erika's Tangela:Stretch Vine": BENCH_SNIPE(20),
  "Erika's Bellsprout (Challenge):Stretch Vine": BENCH_SNIPE(10),
  'Lightning Tail': FLIP_ST('paralyzed'),
  // Focus Energy: doubles a specific next-turn attack (paired with the
  // plusIfMarker entries on those attacks)
  'Focus Energy': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'focusEnergy', duration: 2 }] },
  "Lt. Surge's Rattata:Gnaw": { manual: true, effects: [D({ base: 20, plusIfMarker: { marker: 'focusEnergy', plus: 20 } })] },
  'Spin Ball': TIMES(20, 1),
  'Double Spin': TIMES(20, 2),
  'Hypnotic Stare': { effects: [ST('paralyzed', { flip: 1, if: 'heads' }), ST('asleep', { if: 'tails' })] },
  'Tail Rap': TIMES(20, 2),
  "Misty's Shellder:Clamp": { manual: true, effects: [D(20, { flip: 1, if: 'heads' }), ST('paralyzed', { if: 'heads' })] },
  'Swift': { manual: true, effects: [D(20, { pierce: true })] },
  'Energy Loop': {
    effects: [
      { type: 'CHOOSE', what: 'energy', from: 'self', count: 1, filter: { energyType: 'psychic' }, isCost: true, prompt: 'Return a Psychic Energy to your hand' },
      { type: 'ENERGY_TO_HAND', fromSource: true, isCost: true },
    ],
  },
  'Suggestion': { effects: [{ type: 'ATTACK_LOCK', all: true, flip: 1, if: 'heads' }] },
  'Spook': { effects: [{ type: 'SET_MARKER', target: 'defender', marker: 'noRetreat', duration: 1 }] },
  'Sleight of Hand': {
    effects: [
      CH_CARDS({ from: 'hand', upTo: 3, optional: true, prompt: 'Put up to 3 cards on top of your deck' }),
      MV({ from: 'chosen', to: 'deck', top: true }),
      CH_CARDS({ from: 'deck', count: 'lastMoved', filter: { basicEnergy: true }, optional: true, prompt: 'Choose that many basic Energy cards' }),
      MV({ from: 'chosen', to: 'hand' }),
      { type: 'SHUFFLE_DECK' },
    ],
  },
  'Lazy Attack': { effects: [{ type: 'INFLICT_STATUS', target: 'self', status: 'asleep' }] },
  'Poison Antennae': { effects: [ST('poisoned')] },
  'Removal Beam': {
    effects: [
      { type: 'CHOOSE', what: 'energy', from: 'defender', count: 1, flip: 1, if: 'heads', prompt: 'Choose an Energy to discard' },
      { type: 'DISCARD_ENERGY', if: 'heads' },
    ],
  },

  // ==================================================== Gym Challenge ===
  'Heat Tackle': { effects: [SELF(10)] },
  'Firestorm': { effects: COST_DISCARD(3, { energyType: 'fire' }) },
  'Roaring Flames': {
    manual: true,
    effects: [
      { type: 'DISCARD_ENERGY', from: 'self', count: 'all', filter: { energyType: 'fire' }, isCost: true },
      D({ base: 20, perLastDiscarded: 20 }),
    ],
  },
  'Flame Jet': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'all', flip: 1, if: 'heads', prompt: "Choose 1 of your opponent's Pokémon" }),
      { type: 'DAMAGE', target: 'chosen', amount: 40, if: 'heads' },
    ],
  },
  'Growth': {
    effects: [
      CH_CARDS({ from: 'hand', upTo: 2, filter: { energyOfType: 'grass' }, optional: true, flip: 1, if: 'heads', prompt: 'Attach up to 2 Grass Energy from your hand' }),
      { type: 'ATTACH_ENERGY', if: 'heads' },
    ],
  },
  'Wide Solarbeam': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'bench', optional: true, prompt: 'Choose the first opposing Benched Pokémon' }),
      { type: 'DAMAGE', target: 'chosen', amount: 20 },
      CH_POKE({ player: 'opp', zone: 'bench', optional: true, filter: { notChosen: true }, storeAs: 'chosen2', prompt: 'Choose the second opposing Benched Pokémon' }),
      { type: 'DAMAGE', target: 'chosen2', amount: 20 },
    ],
  },
  'Summon Storm': {
    effects: [
      {
        type: 'CHAIN', flip: 2, if: 'allHeads',
        effects: [{ type: 'DAMAGE', each: { player: 'both', zone: 'all', filter: { notSelf: true } }, amount: 20 }],
      },
    ],
  },
  'Dragon Tornado': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'bench', optional: true, prompt: 'Switch in which opposing Benched Pokémon?' }),
      { type: 'SWITCH_ACTIVE', player: 'opp' },
    ],
  },
  'Hurricane Punch': TIMES(30, 4),
  'Intimidate': { effects: [{ type: 'ATTACK_LOCK', all: true, if: 'defenderMaxHp50' }] },
  'Tumbling Attack': { manual: true, effects: [D({ base: 40, perHeads: 30 }, { flip: 1 })] },
  'Ambush': { manual: true, effects: [D({ base: 20, perHeads: 20 }, { flip: 1 })] },
  'Nerve Poison': { effects: [ST('paralyzed', { flip: 1, if: 'heads' }), ST('poisoned', { if: 'heads' })] },
  // Hyper Needle / Ancestral Memory: once per stay-in-play
  'Hyper Needle': {
    manual: true,
    requires: 'notMarked:hyperNeedle',
    effects: [{ type: 'SET_MARKER', target: 'self', marker: 'hyperNeedle' }, D(70, { flip: 1, if: 'heads' })],
  },
  'Ancestral Memory': {
    manual: true,
    requires: 'notMarked:ancestralMemory',
    effects: [{ type: 'SET_MARKER', target: 'self', marker: 'ancestralMemory' }, D(40, { flip: 1, if: 'heads' })],
  },
  'Giant Growth': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'giantGrowth', flip: 1, if: 'heads' }] },
  "Koga's Ditto:Pound": { manual: true, effects: [D({ base: 10, plusIfMarker: { marker: 'giantGrowth', plus: 20 } })] },
  'Kerzap': {
    manual: true,
    effects: [
      D({ base: 20, perHeads: 30 }, { flip: 1 }),
      { type: 'DISCARD_ENERGY', from: 'self', count: 'all', filter: { energyType: 'lightning' }, if: 'heads' },
    ],
  },
  'Thundertackle': { effects: [ST('paralyzed', { flip: 1, if: 'heads' }), SELF(20, { if: 'tails' })] },
  'Electro Beam': { effects: [{ type: 'DISCARD_ENERGY', from: 'self', count: 'all', flip: 1, if: 'tails' }] },
  'Super Removal': { effects: [{ type: 'DISCARD_ENERGY_EACH', player: 'opp', flip: 1, if: 'heads' }] },
  'Juxtapose': { effects: [{ type: 'JUXTAPOSE', flip: 1, if: 'heads' }] },
  'Hypnoblast': FLIP_ST('asleep'),
  'Plasma': {
    effects: [
      CH_CARDS({ from: 'discard', count: 1, filter: { energyOfType: 'lightning' }, prompt: 'Choose a Lightning Energy from your discard pile' }),
      { type: 'ATTACH_ENERGY' },
    ],
  },
  'Electroburn': { effects: [SELF({ perEnergyTypeOnSelf: { type: 'lightning', each: 10 } })] },
  'Mega Burn': { effects: [{ type: 'ATTACK_LOCK', self: true }] },
  'Burn Up': { effects: [{ type: 'DISCARD_ENERGY', from: 'self', count: 'all', filter: { energyType: 'fire' }, flip: 1, if: 'tails' }] },
  'Lie Low': {
    effects: [
      { type: 'SET_MARKER', target: 'self', marker: 'reduceDamage', value: 20, duration: 1 },
      { type: 'SET_MARKER', target: 'self', marker: 'lieLow', duration: 2 },
    ],
  },
  'Earthdrill': { requires: 'marked:lieLow' },
  'Love Lariat': {
    manual: true,
    effects: [D({ base: 50, plusIfInPlay: { speciesIn: ["Giovanni's Nidoking"], zone: 'bench', plus: 50 } }, { flip: 1, if: 'heads' })],
  },
  'Snapping Pincers': { manual: true, effects: [D({ base: 10, perHeads: 10 }, { flip: 1 })] },
  'Overhead Toss': {
    effects: [
      {
        type: 'CHAIN', flip: 1, if: 'tails',
        effects: [
          CH_POKE({ player: 'self', zone: 'bench', prompt: 'Choose 1 of your Benched Pokémon to take 20' }),
          { type: 'DAMAGE', target: 'chosen', amount: 20 },
        ],
      },
    ],
  },
  'Poison Buildup': { effects: [{ type: 'INFLICT_STATUS', target: 'self', status: 'poisoned' }] },
  'Poison Power': {
    manual: true,
    effects: [D({ base: 20, plusIfSelfPoisoned: 20 }), ST('poisoned', { if: 'selfPoisoned' })],
  },
  'Quick Turn': TIMES(30, 2),
  'Aerial Maneuvers': {
    manual: true,
    effects: [D({ base: 10, perHeads: 30 }, { flip: 1 }), { type: 'APPLY_GUARD', target: 'self', kind: 'all', if: 'heads' }],
  },
  'High Voltage': { effects: [{ type: 'TRAINER_BLOCK', flip: 1, if: 'heads' }] },
  'Thunder Flare': {
    manual: true,
    effects: [D({ base: 30, perDcOnSelf: 10 }), SELF(30, { flip: 1, if: 'tails' })],
  },
  'Dark Wave': { effects: [{ type: 'POWERS_OFF' }] },
  'Shadow Bind': { effects: [{ type: 'SET_MARKER', target: 'defender', marker: 'noRetreat', duration: 1 }] },
  'Damage Shift': { effects: [{ type: 'DAMAGE_SHIFT' }] },
  'Water Spray': { manual: true, effects: [D({ base: 20, perHeads: 20 }, { flip: 1 })] },
  'Bonfire': {
    requires: 'hasEnergyType:fire',
    effects: [
      { type: 'DISCARD_ENERGY', from: 'self', count: 'heads', filter: { energyType: 'fire' }, flip: 3 },
      { type: 'DAMAGE', each: { player: 'opp', zone: 'all' }, amount: { timesHeads: 10 }, if: 'discardedEnergy' },
    ],
  },
  'Mega Peck': { manual: true, effects: [D(50, { flip: 1, if: 'heads' })] },
  "Blaine's Rapidash:Stamp": {
    manual: true,
    effects: [
      D({ base: 30, perHeads: 10 }, { flip: 1 }),
      { type: 'DAMAGE', each: { player: 'opp', zone: 'bench' }, amount: 10, if: 'heads' },
    ],
  },
  'Detonate': {
    effects: [
      { type: 'DAMAGE', each: { player: 'both', zone: 'bench' }, amount: 10 },
      SELF(50),
      { type: 'DISCARD_STADIUM' },
    ],
  },
  'Mega Thrash': { effects: [SELF(20), { type: 'DISCARD_STADIUM' }] },
  'Needle Ball': FLIP_ST('poisoned'),
  'Hypnotic Gaze': { effects: [ST('asleep')] },
  'Fire Ring': BENCH_SNIPE(10),
  'Sleep Seed': { effects: [ST('asleep')] },
  'Errand-Running': {
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { supertype: 'trainer' }, optional: true, flip: 1, if: 'heads', prompt: 'Choose a Trainer card from your deck' }),
      MV({ from: 'chosen', to: 'hand' }),
      { type: 'SHUFFLE_DECK' },
    ],
  },
  'Lunar Power': {
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { evolvesFromBenched: true }, optional: true, flip: 1, if: 'heads', prompt: 'Choose a card that evolves from one of your Benched Pokémon' }),
      CH_POKE({ player: 'self', zone: 'bench', filter: { evolvesFromChosenCard: true }, if: 'heads', prompt: 'Evolve which Benched Pokémon?' }),
      { type: 'EVOLVE', if: 'heads' },
      { type: 'SHUFFLE_DECK' },
    ],
  },
  'Double Razor Leaf': TIMES(40, 2),
  'Risky Attack': { manual: true, effects: [D(60, { flip: 1, if: 'heads' }), SELF(100, { if: 'tails' })] },
  'Headlock': { manual: true, effects: [D({ base: 20, perHeads: 20 }, { flip: 1 }), ST('paralyzed', { if: 'heads' })] },
  'False Charity': {
    effects: [{ type: 'DECK_TOP_SORT', player: 'opp', look: 1, filter: { supertype: 'trainer' }, matchTo: 'discard', restTo: 'hand', flip: 1, if: 'heads' }],
  },
  'Double Scratch': TIMES(20, 2),
  'Poison Sting Tackle': { effects: [SELF(20), ST('poisoned', { flip: 1, if: 'heads' })] },
  'Rend': { manual: true, effects: [D({ base: 20, plusIfDefenderDamaged: 20 })] },
  'Sonic Scream': FLIP_ST('confused'),
  'Toxic Secretion': { effects: [ST('poisoned', { poisonAmount: 20, flip: 1, if: 'heads' })] },
  'Toxic Cloud': { effects: [ST('poisoned', { poisonAmount: 20, flip: 1, if: 'heads' })] },
  'Obscuring Gas': { effects: [{ type: 'SHUFFLE_INTO_DECK', target: 'self', flip: 1, if: 'heads' }] },
  // Messenger: "top of deck" simplified to a shuffle-in plus the search
  'Messenger': {
    effects: [
      { type: 'SHUFFLE_INTO_DECK', target: 'self' },
      CH_CARDS({ from: 'deck', count: 1, filter: { supertype: 'pokemon' }, optional: true, prompt: 'Choose a Pokémon card from your deck' }),
      MV({ from: 'chosen', to: 'hand' }),
      { type: 'SHUFFLE_DECK' },
    ],
  },
  'Spontaneous Explosion': {
    manual: true,
    effects: [D({ base: 10, perHeads: 30 }, { flip: 1 }), SELF(30, { if: 'heads' })],
  },
  'Surprise': {
    effects: [MV({ player: 'opp', from: 'handRandom', to: 'deck' }), { type: 'SHUFFLE_DECK', player: 'opp' }],
  },
  'Power Ball': { manual: true, effects: [D({ base: 30, perHeads: 10 }, { flip: 3 })] },
  "Lt. Surge's Raticate (Challenge):Double-edge": {
    manual: true,
    effects: [
      D({ base: 40, plusIfMarker: { marker: 'focusEnergy', plus: 40 } }),
      SELF({ base: 20, plusIfMarker: { marker: 'focusEnergy', plus: 20 } }),
    ],
  },
  "Lt. Surge's Rattata (Challenge):Quick Attack": {
    manual: true,
    effects: [D({ base: 10, perHeads: 20, plusIfMarker: { marker: 'focusEnergy', plus: 10 } }, { flip: 1 })],
  },
  'Ice Throw': { manual: true, effects: [D({ base: 20, plusIfDefenderType: { type: 'fighting', plus: 20 } })] },
  "Misty's Dewgong:Take Down": { effects: [SELF(20)] },
  'Shadow Attack': {
    effects: [
      {
        type: 'CHAIN', flip: 1, if: 'heads',
        effects: [
          CH_POKE({ player: 'opp', zone: 'bench', optional: true, prompt: 'Choose an opposing Benched Pokémon' }),
          { type: 'DAMAGE', target: 'chosen', amount: 30 },
        ],
      },
    ],
  },
  // Invigorate simplified to your own discard pile (the useful case)
  'Invigorate': {
    effects: [
      CH_CARDS({ from: 'discard', count: 1, filter: { basicPokemon: true }, prompt: 'Choose a Basic Pokémon from your discard pile' }),
      MV({ from: 'chosen', to: 'bench', halfHpDc: true }),
    ],
  },
  'Pendulum Curse': { manual: true, effects: [D({ timesHeads: 20 }, { flip: { count: 'defenderDc' } })] },
  // Helping Hand: heal-any-number simplified to healing everything
  'Helping Hand': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'all', filter: { damaged: true }, prompt: "Choose 1 of your opponent's damaged Pokémon" }),
      { type: 'HEAL', target: 'chosen', amount: 'all' },
      MV({ from: 'deck', to: 'hand', count: 'lastHealed' }),
    ],
  },
  'Hug': { effects: [{ type: 'SET_MARKER', target: 'defender', marker: 'noRetreat', duration: 1, flip: 1, if: 'heads' }] },
  'Life Drain': { effects: [D({ leaveDefenderAt: 10 }, { noWR: true, flip: 1, if: 'heads' })] },
  'Magic Darts': {
    effects: [
      CH_POKE({ player: 'opp', zone: 'all', prompt: "Choose 1 of your opponent's Pokémon" }),
      { type: 'DAMAGE', target: 'chosen', amount: { timesHeads: 10 }, flip: 3 },
    ],
  },
  'Synchronize': { requires: 'sameEnergyCount' },
  'Psyscan': { effects: [{ type: 'REVEAL', show: 'oppHand' }] },
  'Energy Support': {
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { energyOfType: 'psychic' }, optional: true, prompt: 'Choose a Psychic Energy from your deck' }),
      MV({ from: 'chosen', to: 'hand' }),
      { type: 'SHUFFLE_DECK' },
    ],
  },
  // Fade Out: energy should return to hand, the rest discard; approximated
  // with a full bounce
  'Fade Out': { effects: [{ type: 'BOUNCE', target: 'self' }] },
  'Barrier Attack': { effects: [{ type: 'SET_MARKER', target: 'self', marker: 'reduceDamage', value: 10, duration: 1 }] },
  'Random ESP': {
    manual: true,
    effects: [
      D(20, { flip: 1, if: 'heads' }),
      ST('confused', { if: 'heads' }),
      { type: 'INFLICT_STATUS', target: 'self', status: 'confused', if: 'tails' },
    ],
  },
  'Fire Tail Slap': {
    requires: 'hasEnergyType:fire',
    effects: [
      { type: 'CHOOSE', what: 'energy', from: 'self', count: 1, filter: { energyType: 'fire' }, flip: 1, if: 'tails', prompt: 'Discard 1 Fire Energy' },
      { type: 'DISCARD_ENERGY', if: 'tails' },
    ],
  },
  'Wild Kick': { manual: true, effects: [D(20, { flip: 1, if: 'heads' })] },
  'Retaliate': { manual: true, effects: [D({ perDcOnSelf: 10 })] },
  'Stoke': {
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { energyOfType: 'fire' }, optional: true, prompt: 'Choose a Fire Energy from your deck' }),
      { type: 'ATTACH_ENERGY' },
      { type: 'SHUFFLE_DECK' },
    ],
  },
  'Pranks': {
    effects: [
      CH_CARDS({ player: 'opp', from: 'discard', count: 1, optional: true, flip: 1, if: 'heads', prompt: "Choose a card from your opponent's discard pile" }),
      MV({ player: 'opp', from: 'chosen', to: 'deck', top: true }),
    ],
  },
  "Blaine's Mankey:Fury Swipes": TIMES(10, 3),
  'Hind Kick': {
    effects: [
      CH_POKE({ player: 'self', zone: 'bench', optional: true, flip: 1, if: 'heads', prompt: 'Switch with which Benched Pokémon?' }),
      { type: 'SWITCH_ACTIVE', player: 'self', if: 'heads' },
    ],
  },
  'Horn Charge': { manual: true, effects: [D(30, { flip: 1, if: 'heads' })] },
  'Overrun': {
    effects: [
      {
        type: 'CHAIN', flip: 1, if: 'heads',
        effects: [
          CH_POKE({ player: 'opp', zone: 'bench', optional: true, prompt: 'Choose an opposing Benched Pokémon' }),
          { type: 'DAMAGE', target: 'chosen', amount: 20 },
        ],
      },
    ],
  },
  "Call Will-o'-the-wisp": {
    effects: [MV({ from: 'discard', to: 'hand', filter: { basicEnergy: true, energyType: 'fire' }, count: 'heads', flip: 3 })],
  },
  'Surprise Attack': { manual: true, effects: [D(20, { flip: 1, if: 'heads' })] },
  'Tremor': { effects: [{ type: 'DAMAGE', each: { player: 'self', zone: 'bench' }, amount: 10 }] },
  'Group Therapy': {
    effects: [{ type: 'HEAL', each: { player: 'both', zone: 'all', filter: { damaged: true } }, amount: 10 }],
  },
  'Pulled Punch': { manual: true, effects: [D({ base: 10, plusIfDefenderUndamaged: 30 })] },
  'Strange Powder': { effects: [ST('confused', { flip: 1, if: 'heads' }), ST('asleep', { if: 'tails' })] },
  'Poison Spore': {
    effects: [
      {
        type: 'CHAIN', flip: 1, if: 'heads',
        effects: [ST('poisoned'), { type: 'DAMAGE', each: { player: 'opp', zone: 'bench' }, amount: 10 }],
      },
    ],
  },
  'Fury Punch': { manual: true, effects: [D({ perDcOnSelf: 20 }, { flip: 1, if: 'heads' })] },
  'Flail Around': TIMES(10, 3),
  'Cat Fleas': FLIP_ST('confused'),
  'Horn Thrust': { manual: true, effects: [D(20, { flip: 1, if: 'heads' })] },
  "Giovanni's Nidoran ♀:Double-edge": { effects: [SELF(20)] },
  "Giovanni's Nidoran ♂:Double Kick": TIMES(10, 2),
  'Retaliation': { requires: 'selfDamaged2' },
  'Fast-Acting Poison': {
    effects: [{ type: 'CHAIN', flip: 2, if: 'allHeads', effects: [ST('confused'), ST('poisoned')] }],
  },
  'Sludge Grip': {
    requires: 'oppBench',
    effects: [
      {
        type: 'CHAIN', flip: 1, if: 'heads',
        effects: [
          CH_POKE({ player: 'opp', zone: 'bench', prompt: 'Switch in which opposing Benched Pokémon?' }),
          { type: 'SWITCH_ACTIVE', player: 'opp' },
          ST('poisoned'),
        ],
      },
    ],
  },
  'Smelly Gas': { effects: [{ type: 'DAMAGE', each: { player: 'both', zone: 'bench' }, amount: 10, flip: 1, if: 'heads' }] },
  'Grasping Vine': { effects: [MV({ from: 'deck', to: 'hand', count: 2, flip: 1, if: 'heads' })] },
  'Sharp Stinger': { effects: [ST('poisoned', { flip: 1, if: 'heads' }), ST('paralyzed', { if: 'tails' })] },
  'Group Attack': {
    manual: true,
    effects: [
      CH_CARDS({ from: 'deck', upTo: 3, filter: { speciesIn: ["Koga's Zubat"] }, optional: true, prompt: "Put any number of Koga's Zubat onto your Bench" }),
      MV({ from: 'chosen', to: 'bench' }),
      { type: 'SHUFFLE_DECK' },
      D({ perInPlay: { speciesIn: ["Koga's Zubat"], each: 10 } }),
    ],
  },
  'Bouncing Ball': { effects: [SELF(10, { flip: 1, if: 'tails' })] },
  'Ink Spurt': { effects: [{ type: 'ACCURACY_DEBUFF', target: 'defender' }] },
  'Play Dead': { effects: [{ type: 'APPLY_GUARD', target: 'self', kind: 'all', flip: 1, if: 'heads' }] },
  'Bubbles': { effects: [{ type: 'ATTACK_LOCK', self: true, flip: 1, if: 'tails' }] },
  'ESP': {
    manual: true,
    effects: [
      MV({ from: 'deck', to: 'hand', count: 1, flip: 3, if: 'headsEq1' }),
      D(20, { if: 'headsEq2' }),
      {
        type: 'CHAIN', if: 'headsEq3',
        effects: [
          { type: 'CHOOSE', what: 'attack', of: 'defender', prompt: "Choose one of the Defending Pokémon's attacks to copy" },
          { type: 'COPY_ATTACK', mode: 'metronome' },
        ],
      },
    ],
  },
  'Frostbite': { effects: [{ type: 'SET_MARKER', target: 'defender', marker: 'noRetreat', duration: 1 }] },
  'Mirage': { effects: [{ type: 'ACCURACY_DEBUFF', target: 'defender' }] },
  'Star Boomerang': { effects: [{ type: 'BOUNCE', target: 'self', flip: 1, if: 'heads' }] },
  'Psybeam': FLIP_ST('confused'),
  "Lt. Surge's Spearow (Heroes 83):Razor Wind": { manual: true, effects: [D(40, { flip: 1, if: 'heads' })] },

  // --- Japanese vending-machine cards ---
  'Spookify': { effects: [{ type: 'TRAINER_BLOCK' }] },
  'Fade to Black': FLIP_ST('confused'),
  'Poltergeist': {
    manual: true,
    effects: [{ type: 'REVEAL', show: 'oppHand' }, D({ perOppHandTrainers: 10 })],
  },
  'Bad Dreams': { effects: [ST('asleep', { flip: 1, if: 'heads' }), ST('confused', { if: 'tails' })] },
}

// --- Trainers: an effects array that runs when the card is played from hand ---
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

  // --- Jungle / Fossil trainers ---
  'Poké Ball': [
    CH_CARDS({ from: 'deck', count: 1, filter: { supertype: 'pokemon' }, optional: true, flip: 1, if: 'heads', prompt: 'Choose any Pokémon card from your deck' }),
    MV({ from: 'chosen', to: 'hand' }),
    { type: 'SHUFFLE_DECK' },
  ],
  'Energy Search': [
    CH_CARDS({ from: 'deck', count: 1, filter: { basicEnergy: true }, prompt: 'Choose a basic Energy card from your deck' }),
    MV({ from: 'chosen', to: 'hand' }),
    { type: 'SHUFFLE_DECK' },
  ],
  'Gambler': [
    MV({ from: 'hand', to: 'deck', count: 'all', shuffle: true }),
    MV({ from: 'deck', to: 'hand', count: 8, flip: 1, if: 'heads' }),
    MV({ from: 'deck', to: 'hand', count: 1, if: 'tails' }),
  ],
  'Recycle': [
    CH_CARDS({ from: 'discard', count: 1, optional: true, flip: 1, if: 'heads', prompt: 'Choose a card to put on top of your deck' }),
    MV({ from: 'chosen', to: 'deck', top: true }),
  ],
  'Mr. Fuji': [
    CH_POKE({ player: 'self', zone: 'bench', prompt: 'Choose a Benched Pokémon to shuffle into your deck' }),
    { type: 'SHUFFLE_INTO_DECK' },
  ],

  // --- Promo trainers ---
  // "Draw up to 5" simplified to drawing the full 5 for both players.
  'Computer Error': [
    MV({ from: 'deck', to: 'hand', count: 5 }),
    MV({ player: 'opp', from: 'deck', to: 'hand', count: 5 }),
    { type: 'END_TURN' },
  ],
  'Super Energy Retrieval': [
    CH_CARDS({ from: 'hand', count: 2, prompt: 'Discard 2 cards from your hand' }),
    MV({ from: 'chosen', to: 'discard' }),
    CH_CARDS({ from: 'discard', upTo: 4, filter: { basicEnergy: true }, precheck: true, prompt: 'Choose up to 4 basic Energy cards from your discard pile' }),
    MV({ from: 'chosen', to: 'hand' }),
  ],
  // Clefairy Doll / Mysterious Fossil are played by dragging onto an empty
  // slot, not by clicking.

  // --- Team Rocket trainers ---
  'Here Comes Team Rocket!': [{ type: 'PRIZES_FACE_UP' }],
  "Rocket's Sneak Attack": [
    { type: 'REVEAL', show: 'oppHand' },
    CH_CARDS({ player: 'opp', from: 'hand', count: 1, filter: { supertype: 'trainer' }, optional: true, prompt: "Choose a Trainer card from your opponent's hand" }),
    MV({ player: 'opp', from: 'chosen', to: 'deck', shuffle: true }),
  ],
  "The Boss's Way": [
    CH_CARDS({ from: 'deck', count: 1, filter: { evolution: true, nameIncludes: 'Dark' }, prompt: 'Choose an Evolution card with Dark in its name' }),
    MV({ from: 'chosen', to: 'hand' }),
    { type: 'SHUFFLE_DECK' },
  ],
  'Challenge!': [
    {
      type: 'CHOOSE', what: 'option', chooser: 'opp',
      options: [
        { id: 'accept', label: 'Accept the challenge (both fill Benches)' },
        { id: 'decline', label: 'Decline (they draw 2 cards)' },
      ],
      prompt: 'Your opponent challenges you!',
    },
    MV({ from: 'deck', to: 'hand', count: 2, if: 'option:decline' }),
    {
      type: 'CHAIN', if: 'option:accept',
      effects: [
        CH_CARDS({ from: 'deck', upTo: 5, filter: { basicPokemon: true }, optional: true, prompt: 'Choose Basic Pokémon for your Bench' }),
        MV({ from: 'chosen', to: 'bench' }),
        { type: 'SHUFFLE_DECK' },
        CH_CARDS({ player: 'opp', chooser: 'opp', from: 'deck', upTo: 5, filter: { basicPokemon: true }, optional: true, prompt: 'Choose Basic Pokémon for your Bench' }),
        MV({ player: 'opp', from: 'chosen', to: 'bench' }),
        { type: 'SHUFFLE_DECK', player: 'opp' },
      ],
    },
  ],
  'Digger': [{ type: 'DIGGER' }],
  "Imposter Oak's Revenge": [
    CH_CARDS({ from: 'hand', count: 1, prompt: 'Discard a card from your hand' }),
    MV({ from: 'chosen', to: 'discard' }),
    MV({ player: 'opp', from: 'hand', to: 'deck', count: 'all', shuffle: true }),
    MV({ player: 'opp', from: 'deck', to: 'hand', count: 4 }),
  ],
  'Nightly Garbage Run': [
    CH_CARDS({ from: 'discard', upTo: 3, filter: { pokemonOrBasicEnergy: true }, prompt: 'Choose up to 3 Pokémon and/or basic Energy cards' }),
    MV({ from: 'chosen', to: 'deck', shuffle: true }),
  ],
  'Goop Gas Attack': [{ type: 'POWERS_OFF' }],
  'Sleep!': [ST('asleep', { flip: 1, if: 'heads' })],

  // --- Gym Heroes trainers ---
  'Brock': [{ type: 'HEAL', each: { player: 'self', zone: 'all', filter: { damaged: true } }, amount: 10 }],
  // "Up to 3" simplified to the full 3 for both players
  'Erika': [
    MV({ from: 'deck', to: 'hand', count: 3 }),
    MV({ player: 'opp', from: 'deck', to: 'hand', count: 3 }),
  ],
  'Lt. Surge': [
    CH_CARDS({ from: 'hand', count: 1, filter: { basicPokemon: true }, prompt: 'Choose the Basic Pokémon that jumps in as Active' }),
    { type: 'NEW_ACTIVE_FROM_HAND' },
  ],
  'Misty': [
    CH_CARDS({ from: 'hand', count: 2, prompt: 'Discard 2 other cards from your hand' }),
    MV({ from: 'chosen', to: 'discard' }),
    { type: 'SET_TURNFLAG', flag: 'attackBoost', value: { nameIncludes: 'Misty', amount: 20, label: 'Misty' }, log: 'Misty Pokémon attacks do 20 more damage this turn.' },
  ],
  "The Rocket's Trap": [
    {
      type: 'CHAIN', flip: 1, if: 'heads',
      effects: [
        MV({ player: 'opp', from: 'handRandom', to: 'deck' }),
        MV({ player: 'opp', from: 'handRandom', to: 'deck' }),
        MV({ player: 'opp', from: 'handRandom', to: 'deck' }),
        { type: 'SHUFFLE_DECK', player: 'opp' },
      ],
    },
  ],
  // The quiz minigames reduce to a fair coin: heads you win the draw, tails
  // your opponent does.
  "Blaine's Quiz #1": [
    MV({ from: 'deck', to: 'hand', count: 2, flip: 1, if: 'heads' }),
    MV({ player: 'opp', from: 'deck', to: 'hand', count: 2, if: 'tails' }),
  ],
  'Charity': [
    { type: 'SET_TURNFLAG', flag: 'attackReduce', value: 10, log: 'Charity: your attacks do 10 less damage this turn.' },
  ],
  "Blaine's Last Resort": Object.assign(
    [MV({ from: 'deck', to: 'hand', count: 5 })],
    { gate: 'emptyHand' }),
  "Brock's Training Method": [
    CH_CARDS({ from: 'deck', count: 1, filter: { supertype: 'pokemon', nameIncludes: 'Brock' }, prompt: 'Choose a Pokémon card with Brock in its name' }),
    MV({ from: 'chosen', to: 'hand' }),
    { type: 'SHUFFLE_DECK' },
  ],
  "Erika's Maids": [
    CH_CARDS({ from: 'hand', count: 2, prompt: 'Trade 2 cards from your hand' }),
    MV({ from: 'chosen', to: 'discard' }),
    CH_CARDS({ from: 'deck', upTo: 2, filter: { supertype: 'pokemon', nameIncludes: 'Erika' }, optional: true, prompt: 'Choose up to 2 Erika Pokémon from your deck' }),
    MV({ from: 'chosen', to: 'hand' }),
    { type: 'SHUFFLE_DECK' },
  ],
  "Erika's Perfume": [
    { type: 'REVEAL', show: 'oppHand' },
    CH_CARDS({ player: 'opp', from: 'hand', upTo: 5, filter: { basicPokemon: true }, optional: true, prompt: "Put Basic Pokémon onto your opponent's Bench" }),
    MV({ player: 'opp', from: 'chosen', to: 'bench' }),
  ],
  'Good Manners': Object.assign(
    [
      CH_CARDS({ from: 'deck', count: 1, filter: { basicPokemon: true }, optional: true, prompt: 'Choose a Basic Pokémon from your deck' }),
      MV({ from: 'chosen', to: 'hand' }),
      { type: 'SHUFFLE_DECK' },
    ],
    { gate: 'noBasics' }),
  "Lt. Surge's Treaty": [
    {
      type: 'CHOOSE', what: 'option', chooser: 'opp',
      options: [
        { id: 'prize', label: 'Everyone takes a Prize into their hand' },
        { id: 'draw', label: 'They draw a card' },
      ],
      prompt: "Lt. Surge's Treaty: choose one",
    },
    { type: 'TAKE_PRIZE_BOTH', if: 'option:prize' },
    MV({ from: 'deck', to: 'hand', count: 1, if: 'option:draw' }),
  ],
  'Minion of Team Rocket': [
    CH_POKE({ player: 'opp', zone: 'bench', flip: 2, if: 'allHeads', prompt: "Return which of your opponent's Benched Pokémon to their hand?" }),
    { type: 'BOUNCE', target: 'chosen', if: 'allHeads' },
    { type: 'END_TURN', if: 'notAllHeads' },
  ],
  "Misty's Wrath": [
    CH_CARDS({ from: 'deckTop', look: 7, count: 2, prompt: 'Choose 2 of the top 7 cards to keep' }),
    MV({ from: 'chosen', to: 'hand' }),
    // the unchosen 5 (still on top of the deck) are discarded
    { type: 'DECK_TOP_SORT', look: 5, filter: {}, matchTo: 'discard', restTo: 'discard' },
  ],
  'Recall': [
    CH_POKE({ player: 'self', zone: 'active', filter: { evolved: true }, prompt: 'Recall: your Active Pokémon remembers its old attacks' }),
    { type: 'RECALL' },
  ],
  "Sabrina's ESP": [
    CH_POKE({ player: 'self', zone: 'all', filter: { nameIncludes: 'Sabrina' }, prompt: 'Attach ESP to which Sabrina Pokémon?' }),
    { type: 'SET_MARKER', target: 'chosen', marker: 'esp', duration: 1 },
  ],
  'Secret Mission': [
    { type: 'REVEAL', show: 'oppHand' },
    CH_CARDS({ from: 'hand', upTo: 60, optional: true, prompt: 'Discard any number of cards to draw that many' }),
    MV({ from: 'chosen', to: 'discard' }),
    MV({ from: 'deck', to: 'hand', count: 'lastMoved' }),
  ],
  'Tickling Machine': [
    { type: 'HAND_BLOCK', flip: 1, if: 'heads' },
    { type: 'END_TURN', if: 'tails' },
  ],
  "Blaine's Gamble": [
    CH_CARDS({ from: 'hand', upTo: 60, optional: true, prompt: 'Discard any number of cards from your hand' }),
    MV({ from: 'chosen', to: 'discard' }),
    MV({ from: 'deck', to: 'hand', count: 'lastMovedTimes2', flip: 1, if: 'heads' }),
  ],
  // "Any number per pokemon" simplified to all energy on one pokemon
  'Energy Flow': [
    CH_POKE({ player: 'self', zone: 'all', filter: { hasEnergy: true }, prompt: 'Return which Pokémon\u2019s Energy to your hand?' }),
    { type: 'ENERGY_TO_HAND', all: true },
  ],
  // Rock-Paper-Scissors resolves as the printed fallback coin flip
  "Misty's Duel": [
    {
      type: 'CHAIN', flip: 1, if: 'heads',
      effects: [
        MV({ from: 'hand', to: 'deck', count: 'all', shuffle: true }),
        MV({ from: 'deck', to: 'hand', count: 5 }),
      ],
    },
    {
      type: 'CHAIN', if: 'tails',
      effects: [
        MV({ player: 'opp', from: 'hand', to: 'deck', count: 'all', shuffle: true }),
        MV({ player: 'opp', from: 'deck', to: 'hand', count: 5 }),
      ],
    },
  ],
  "Sabrina's Gaze": [
    MV({ from: 'hand', to: 'deck', count: 'all', shuffle: true }),
    MV({ from: 'deck', to: 'hand', count: 'lastMoved' }),
    MV({ player: 'opp', from: 'hand', to: 'deck', count: 'all', shuffle: true }),
    MV({ player: 'opp', from: 'deck', to: 'hand', count: 'lastMoved' }),
  ],
  'Trash Exchange': [{ type: 'TRASH_EXCHANGE' }],

  // --- Gym Challenge trainers ---
  'Blaine': [
    CH_CARDS({ from: 'hand', upTo: 2, filter: { energyOfType: 'fire' }, prompt: 'Choose up to 2 Fire Energy from your hand' }),
    CH_POKE({ player: 'self', zone: 'all', filter: { nameIncludes: 'Blaine' }, prompt: 'Attach them to which Blaine Pokémon?' }),
    { type: 'ATTACH_ENERGY' },
    { type: 'SET_TURNFLAG', flag: 'energyAttached', value: true },
  ],
  'Giovanni': [
    CH_POKE({ player: 'self', zone: 'all', filter: { nameIncludes: 'Giovanni' }, prompt: 'Choose a Giovanni Pokémon: it can evolve without timing limits this turn' }),
    { type: 'SET_MARKER', target: 'chosen', marker: 'giovanni', duration: 1 },
  ],
  'Koga': [
    { type: 'SET_TURNFLAG', flag: 'attackPoison', value: true, log: 'Koga: damaging attacks by Koga Pokémon poison this turn.' },
  ],
  'Sabrina': [
    CH_POKE({ player: 'self', zone: 'all', filter: { nameIncludes: 'Sabrina', hasEnergy: true }, prompt: 'Take all Energy from which Sabrina Pokémon?' }),
    CH_POKE({ player: 'self', zone: 'all', filter: { nameIncludes: 'Sabrina', notChosen: true }, storeAs: 'chosen2', prompt: 'Attach it all to which Sabrina Pokémon?' }),
    { type: 'MOVE_ENERGY', all: true },
  ],
  "Brock's Protection": [
    CH_POKE({ player: 'self', zone: 'all', filter: { nameIncludes: 'Brock' }, prompt: 'Protect which Brock Pokémon?' }),
    { type: 'SET_MARKER', target: 'chosen', marker: 'energyProtect' },
  ],
  "Erika's Kindness": [
    { type: 'HEAL', each: { player: 'both', zone: 'all', filter: { damaged: true } }, amount: 20 },
  ],
  "Giovanni's Last Resort": [
    CH_POKE({ player: 'self', zone: 'all', filter: { nameIncludes: 'Giovanni', damaged: true }, prompt: 'Fully heal which Giovanni Pokémon?' }),
    { type: 'HEAL', target: 'chosen', amount: 'all' },
    MV({ from: 'hand', to: 'discard', count: 'all' }),
  ],
  // Face-down bluffing isn't modeled; simplified to benching a Basic.
  "Lt. Surge's Secret Plan": [
    CH_CARDS({ from: 'hand', count: 1, filter: { basicPokemon: true }, prompt: 'Put which Basic Pokémon onto your Bench?' }),
    MV({ from: 'chosen', to: 'bench' }),
  ],
  "Misty's Wish": [
    {
      type: 'CHOOSE', what: 'option', chooser: 'opp',
      options: [
        { id: 'accept', label: 'Allow the prize swap' },
        { id: 'decline', label: 'Decline (they draw a card)' },
      ],
      prompt: "Misty's Wish: may they swap a prize with a hand card?",
    },
    {
      type: 'CHAIN', if: 'option:accept',
      effects: [
        CH_CARDS({ from: 'hand', count: 1, prompt: 'Swap which card with your Prize?' }),
        { type: 'PRIZE_SWAP' },
      ],
    },
    MV({ from: 'deck', to: 'hand', count: 1, if: 'option:decline' }),
  ],
  "Blaine's Quiz #2": [
    MV({ from: 'deck', to: 'hand', count: 2, flip: 1, if: 'heads' }),
    MV({ player: 'opp', from: 'deck', to: 'hand', count: 2, if: 'tails' }),
  ],
  "Blaine's Quiz #3": [
    MV({ from: 'deck', to: 'hand', count: 3, flip: 1, if: 'heads' }),
    MV({ player: 'opp', from: 'deck', to: 'hand', count: 3, if: 'tails' }),
  ],
  "Koga's Ninja Trick": [
    CH_POKE({ player: 'self', zone: 'active', filter: { nameIncludes: 'Koga' }, prompt: 'Attach Ninja Trick to your Active Koga Pokémon' }),
    { type: 'SET_MARKER', target: 'chosen', marker: 'ninjaTrick' },
  ],
  'Master Ball': [
    CH_CARDS({ from: 'deckTop', look: 7, count: 1, filter: { supertype: 'pokemon' }, optional: true, prompt: 'Choose a Pokémon from the top 7 cards' }),
    MV({ from: 'chosen', to: 'hand' }),
    { type: 'SHUFFLE_DECK' },
  ],
  'Max Revive': [
    CH_CARDS({ from: 'hand', count: 2, filter: { supertype: 'energy' }, prompt: 'Discard 2 Energy cards from your hand' }),
    MV({ from: 'chosen', to: 'discard' }),
    CH_CARDS({ from: 'discard', count: 1, filter: { basicPokemon: true }, precheck: true, prompt: 'Choose a Basic Pokémon from your discard pile' }),
    MV({ from: 'chosen', to: 'bench' }),
  ],
  "Misty's Tears": [
    CH_CARDS({ from: 'hand', count: 1, prompt: 'Discard a card from your hand' }),
    MV({ from: 'chosen', to: 'discard' }),
    CH_CARDS({ from: 'deck', upTo: 2, filter: { energyOfType: 'water' }, optional: true, prompt: 'Choose up to 2 Water Energy from your deck' }),
    MV({ from: 'chosen', to: 'hand' }),
    { type: 'SHUFFLE_DECK' },
  ],
  "Rocket's Secret Experiment": [
    {
      type: 'CHAIN', flip: 1, if: 'heads',
      effects: [
        CH_CARDS({ from: 'deck', count: 1, prompt: 'Choose any card from your deck' }),
        MV({ from: 'chosen', to: 'hand' }),
        { type: 'SHUFFLE_DECK' },
      ],
    },
    { type: 'TRAINER_BLOCK', self: true, turns: 2, if: 'tails' },
  ],
  "Sabrina's Psychic Control": [
    CH_CARDS({ player: 'opp', from: 'discard', count: 1, filter: { supertype: 'trainer' }, flip: 1, if: 'heads', prompt: "Use which Trainer from your opponent's discard pile?" }),
    { type: 'COPY_TRAINER', if: 'heads' },
  ],
  'Fervor': [
    { type: 'DECK_TOP_SORT', look: 3, filter: { energyOfType: 'fire' }, matchTo: 'hand', restTo: 'discard' },
  ],
  'Transparent Walls': [{ type: 'BENCH_GUARD' }],
  'Warp Point': [
    CH_POKE({ player: 'opp', zone: 'bench', optional: true, chooser: 'opp', prompt: 'Opponent chooses a Benched Pokémon to switch in' }),
    { type: 'SWITCH_ACTIVE', player: 'opp' },
    CH_POKE({ player: 'self', zone: 'bench', optional: true, prompt: 'Switch with which of your Benched Pokémon?' }),
    { type: 'SWITCH_ACTIVE', player: 'self' },
  ],

  // Stadium cards: playTrainer short-circuits before consulting these — their
  // passive rules live in the engine (retreatCostOf, applyDamage, playTrainer,
  // handleDrop) and per-turn actions in STADIUM_ACTIONS below.
  'No Removal Gym': [],
  "The Rocket's Training Gym": [],
  'Celadon City Gym': [],
  'Cerulean City Gym': [],
  'Pewter City Gym': [],
  'Vermilion City Gym': [],
  'Narrow Gym': [],
  'Chaos Gym': [],
  'Resistance Gym': [],
  'Cinnabar City Gym': [],
  'Fuchsia City Gym': [],
  "Rocket's Minefield Gym": [],
  'Saffron City Gym': [],
  'Viridian City Gym': [],
}

// Stadiums with a per-turn player action (triggered via the use-stadium action).
export const STADIUM_ACTIONS = {
  'Celadon City Gym': {
    oncePerTurn: true,
    effects: [
      CH_POKE({ player: 'self', zone: 'all', filter: { nameIncludes: 'Erika', hasEnergy: true, statused: true }, prompt: 'Cure which Erika Pokémon?' }),
      { type: 'CHOOSE', what: 'energy', from: 'chosen', count: 1, prompt: 'Discard which Energy?' },
      { type: 'DISCARD_ENERGY' },
      { type: 'CURE_STATUS', target: 'chosen' },
    ],
  },
  'Saffron City Gym': {
    oncePerTurn: false,
    effects: [
      CH_POKE({ player: 'self', zone: 'all', filter: { nameIncludes: 'Sabrina', hasEnergy: true }, prompt: 'Return Energy from which Sabrina Pokémon?' }),
      { type: 'CHOOSE', what: 'energy', from: 'chosen', count: 1, prompt: 'Return which basic Energy to your hand?' },
      { type: 'ENERGY_TO_HAND' },
    ],
  },
  'Fuchsia City Gym': {
    oncePerTurn: true,
    effects: [
      CH_POKE({ player: 'self', zone: 'all', filter: { nameIncludes: 'Koga' }, flip: 1, if: 'heads', prompt: 'Shuffle which Koga Pokémon into your deck?' }),
      { type: 'SHUFFLE_INTO_DECK', if: 'heads' },
    ],
  },
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
  // --- Jungle / Fossil activated powers ---
  'Shift': {
    oncePerTurn: true,
    effects: [
      { type: 'CHOOSE', what: 'type', prompt: "Choose Venomoth's new type" },
      { type: 'MODIFY_CARD', target: 'self', field: 'type', value: 'chosenType' },
    ],
  },
  'Heal': {
    oncePerTurn: true,
    effects: [
      CH_POKE({ player: 'self', zone: 'all', filter: { damaged: true }, flip: 1, if: 'heads', prompt: 'Remove a damage counter from which Pokémon?' }),
      { type: 'HEAL', target: 'chosen', amount: 10, if: 'heads' },
    ],
  },
  'Peek': {
    oncePerTurn: true,
    effects: [
      {
        type: 'CHOOSE',
        what: 'option',
        options: [
          { id: 'myDeck', label: 'Top card of your deck' },
          { id: 'oppDeck', label: "Top card of your opponent's deck" },
          { id: 'oppHand', label: "A random card from your opponent's hand" },
          { id: 'oppPrize', label: "One of your opponent's Prizes" },
        ],
        prompt: 'Peek at which hidden card?',
      },
      { type: 'REVEAL' },
    ],
  },
  'Curse': {
    oncePerTurn: true,
    effects: [
      CH_POKE({ player: 'opp', zone: 'all', filter: { damaged: true }, prompt: 'Move 1 damage counter from...' }),
      CH_POKE({ player: 'opp', zone: 'all', filter: { notChosen: true }, storeAs: 'chosen2', prompt: "...to which of your opponent's Pokémon?" }),
      { type: 'MOVE_DC', allowKo: true },
    ],
  },
  'Strange Behavior': {
    // "As often as you like during your turn" — not once per turn.
    effects: [
      CH_POKE({ player: 'self', zone: 'all', filter: { damaged: true, notSelf: true }, prompt: 'Move 1 damage counter from which Pokémon?' }),
      { type: 'MOVE_DC', toSource: true, noKo: true },
    ],
  },
  'Step In': {
    oncePerTurn: true,
    benchOnly: true,
    effects: [{ type: 'SWITCH_ACTIVE', useSource: true }],
  },
  'Cowardice': {
    notTurnPlayed: true,
    effects: [{ type: 'SCOOP_UP', useSource: true }],
  },

  // --- Promo activated powers ---
  'Special Delivery': {
    oncePerTurn: true,
    effects: [
      MV({ from: 'deck', to: 'hand', count: 1 }),
      CH_CARDS({ from: 'hand', count: 1, prompt: 'Put a card from your hand on top of your deck' }),
      MV({ from: 'chosen', to: 'deck', top: true }),
    ],
  },
  // Chain Reaction really triggers "when a Pokémon evolves"; simplified to a
  // once-per-turn activated search-and-evolve.
  'Chain Reaction': {
    oncePerTurn: true,
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { evolvesFrom: 'Eevee' }, optional: true, prompt: 'Choose a card that evolves from Eevee' }),
      { type: 'EVOLVE', useSource: true },
      { type: 'SHUFFLE_DECK' },
    ],
  },
  'Solar Power': {
    oncePerTurn: true,
    effects: [{ type: 'CURE_STATUS', each: { player: 'both', zone: 'active' } }],
  },

  // Passive powers -- no activated effects:
  // Rain Dance: sandbox has no once-per-turn energy limit, so extra water attachments are already legal.
  // Energy Burn: handled inside costMatch (all attached energy counts as fire).
  // Strikes Back: triggered inside applyDamage.
  // Jungle/Fossil passives are wired through src/engine/powers.js:
  //   Thick Skinned (INFLICT_STATUS), Invisible Wall + Kabuto Armor (applyDamage),
  //   Transparency (doAttack), Prehistoric Power (canEvolveTarget/Breeder),
  //   Retreat Aid (retreatCostOf), Clairvoyance (maskStateFor),
  //   Toxic Gas (powerActive everywhere), Transform (combatView).
  'Rain Dance': { passive: true },
  'Energy Burn': { passive: true },
  'Strikes Back': { passive: true },
  'Thick Skinned': { passive: true },
  'Invisible Wall': { passive: true },
  'Kabuto Armor': { passive: true },
  'Transparency': { passive: true },
  'Prehistoric Power': { passive: true },
  'Retreat Aid': { passive: true },
  'Clairvoyance': { passive: true },
  'Toxic Gas': { passive: true },
  'Transform': { passive: true },

  // --- Team Rocket / Gym activated powers ---
  // "When you play this Pokémon from your hand" powers (reducer's whenPlayedPower)
  'Summon Minions': {
    whenPlayed: true,
    effects: [
      CH_CARDS({ from: 'deck', upTo: 2, filter: { basicPokemon: true }, optional: true, prompt: 'Choose up to 2 Basic Pokémon to put onto your Bench' }),
      MV({ from: 'chosen', to: 'bench' }),
      { type: 'SHUFFLE_DECK' },
    ],
  },
  'Sneak Attack': {
    whenPlayed: true,
    effects: [
      CH_POKE({ player: 'opp', zone: 'all', optional: true, prompt: "Sneak Attack: choose 1 of your opponent's Pokémon" }),
      { type: 'DAMAGE', target: 'chosen', amount: 10 },
    ],
  },
  'Reel In': {
    whenPlayed: true,
    effects: [
      CH_CARDS({ from: 'discard', upTo: 3, filter: { supertype: 'pokemon' }, optional: true, prompt: 'Choose up to 3 Pokémon cards from your discard pile' }),
      MV({ from: 'chosen', to: 'hand' }),
    ],
  },
  'Call the Boss': {
    whenPlayed: true,
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { nameIs: 'Giovanni' }, optional: true, prompt: 'Search your deck for Giovanni' }),
      MV({ from: 'chosen', to: 'hand' }),
      { type: 'SHUFFLE_DECK' },
    ],
  },

  'Evolutionary Light': {
    oncePerTurn: true,
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { evolution: true }, optional: true, prompt: 'Choose an Evolution card from your deck' }),
      MV({ from: 'chosen', to: 'hand' }),
      { type: 'SHUFFLE_DECK' },
    ],
  },
  'Pollen Stench': {
    oncePerTurn: true,
    effects: [
      ST('confused', { flip: 1, if: 'heads' }),
      { type: 'INFLICT_STATUS', target: 'active', status: 'confused', if: 'tails' },
    ],
  },
  'Matter Exchange': {
    oncePerTurn: true,
    effects: [
      CH_CARDS({ from: 'hand', count: 1, prompt: 'Discard a card from your hand' }),
      MV({ from: 'chosen', to: 'discard' }),
      MV({ from: 'deck', to: 'hand', count: 1 }),
    ],
  },
  'Gather Fire': {
    oncePerTurn: true,
    effects: [
      CH_POKE({ player: 'self', zone: 'all', filter: { hasEnergyType: 'fire', notSelf: true }, prompt: 'Take a Fire Energy from which Pokémon?' }),
      { type: 'CHOOSE', what: 'energy', from: 'chosen', count: 1, filter: { energyType: 'fire' }, prompt: 'Choose a Fire Energy' },
      { type: 'MOVE_ENERGY', toSource: true },
    ],
  },
  'Long-Distance Hypnosis': {
    oncePerTurn: true,
    effects: [
      ST('asleep', { flip: 1, if: 'heads' }),
      { type: 'INFLICT_STATUS', target: 'active', status: 'asleep', if: 'tails' },
    ],
  },
  'Trickery': {
    oncePerTurn: true,
    effects: [{ type: 'SWAP_PRIZE_TOPDECK' }],
  },
  // Energy Charge: "as often as you like" — no oncePerTurn flag
  'Energy Charge': {
    activeOnly: true,
    effects: [
      CH_POKE({ player: 'self', zone: 'all', filter: { hasEnergyType: 'lightning', notSelf: true }, prompt: 'Take a Lightning Energy from which Pokémon?' }),
      { type: 'CHOOSE', what: 'energy', from: 'chosen', count: 1, filter: { energyType: 'lightning' }, prompt: 'Choose a Lightning Energy' },
      { type: 'MOVE_ENERGY', toSource: true },
    ],
  },
  'Fragrance Trap': {
    oncePerTurn: true,
    effects: [
      CH_POKE({ player: 'opp', zone: 'bench', flip: 1, if: 'heads', prompt: 'Switch in which opposing Benched Pokémon?' }),
      { type: 'SWITCH_ACTIVE', player: 'opp', if: 'heads' },
    ],
  },
  'Natural Healing': {
    oncePerTurn: true,
    effects: [{ type: 'HEAL', target: 'self', amount: 10 }],
  },
  'Shapeshift': {
    oncePerTurn: true,
    effects: [
      CH_CARDS({ from: 'hand', count: 1, filter: { evolution: true }, prompt: 'Attach which Evolution card?' }),
      { type: 'SHAPESHIFT' },
    ],
  },
  'Soak Up': {
    oncePerTurn: true,
    effects: [
      CH_POKE({ player: 'self', zone: 'all', filter: { hasEnergyType: 'grass', notSelf: true }, prompt: 'Take Grass Energy from which Pokémon?' }),
      { type: 'CHOOSE', what: 'energy', from: 'chosen', upTo: 2, filter: { energyType: 'grass' }, prompt: 'Choose up to 2 Grass Energy' },
      { type: 'MOVE_ENERGY', toSource: true },
    ],
  },
  'Emerge': {
    oncePerTurn: true,
    effects: [
      CH_CARDS({ from: 'deck', count: 1, filter: { nameIs: "Koga's Beedrill" }, optional: true, flip: 1, if: 'heads', prompt: "Search your deck for Koga's Beedrill" }),
      { type: 'EVOLVE', useSource: true, if: 'heads' },
      { type: 'SHUFFLE_DECK' },
    ],
  },
  // Flee really triggers when damaged; relaxed to a free once-per-turn switch.
  'Flee': {
    oncePerTurn: true,
    activeOnly: true,
    effects: [
      CH_POKE({ player: 'self', zone: 'bench', prompt: 'Switch with which Benched Pokémon?' }),
      { type: 'SWITCH_ACTIVE', player: 'self' },
    ],
  },

  // Rocket/Gym passives wired through the engine:
  //   Sinkhole (SINKHOLE_CHECK after retreat), Final Beam + Rebirth + Fortitude (knockOut),
  //   Hay Fever (trainerBlocked), Sticky Goo (retreatCostOf), Frenzy (applyDamage),
  //   Bench Guard + Shell Armor + Strange Barrier + Relaxing Scent (applyDamage),
  //   Restless Sleep + Pollen Defense + Shock Blast + Energy Drain (applyDamage retaliation),
  //   Photosynthesis (burn check in doAttack), Rebellion (doAttack),
  //   Psylink (combatView), Healing Fire (handleDrop), Scram (checkScram),
  //   Gaseous Form + Giant Growth (maxHpOf).
  'Sinkhole': { passive: true },
  'Final Beam': { passive: true },
  'Rebirth': { passive: true },
  'Fortitude': { passive: true },
  'Hay Fever': { passive: true },
  'Sticky Goo': { passive: true },
  'Frenzy': { passive: true },
  'Bench Guard': { passive: true },
  'Shell Armor': { passive: true },
  'Strange Barrier': { passive: true },
  'Relaxing Scent': { passive: true },
  'Restless Sleep': { passive: true },
  'Pollen Defense': { passive: true },
  'Shock Blast': { passive: true },
  'Energy Drain': { passive: true },
  'Photosynthesis': { passive: true },
  'Rebellion': { passive: true },
  'Psylink': { passive: true },
  'Healing Fire': { passive: true },
  'Scram': { passive: true },
  'Gaseous Form': { passive: true },
}

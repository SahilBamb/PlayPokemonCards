// Opponent decks for Story Mode: hand-authored boss/rival lists plus a
// deterministic generator for regular trainer nodes. Everything returns
// name->count maps; use deckToList/countsToList to expand for a match.
import CARD_STATS from './cardStats.js'
import { FORMATS } from './sets.js'

const byName = Object.fromEntries(CARD_STATS.map((c) => [c.name, c]))

// Fill a counts map up to 60 with the given basic energy.
function fill(counts, energyName) {
  const size = Object.values(counts).reduce((a, b) => a + b, 0)
  if (size > 60) throw new Error(`Story deck overflows 60 cards (${size})`)
  return size < 60 ? { ...counts, [energyName]: (counts[energyName] ?? 0) + (60 - size) } : counts
}

export const countsToList = (counts) => Object.entries(counts).flatMap(([name, n]) => Array(n).fill(name))

// --- Gym Leaders -------------------------------------------------------------
export const BOSS_DECKS = {
  brock: fill({
    Onix: 3, Geodude: 4, Graveler: 3, Golem: 1, Machop: 4, Machoke: 2, Sandshrew: 2,
    Bill: 3, Potion: 3, Switch: 2, 'Energy Search': 2, 'Poké Ball': 2,
  }, 'Fighting Energy'),
  misty: fill({
    Squirtle: 4, Wartortle: 3, Blastoise: 1, Staryu: 4, Starmie: 3, Seel: 3, Dewgong: 2,
    Bill: 3, 'Super Potion': 2, Potion: 2, Switch: 2, 'Gust of Wind': 2, 'Energy Retrieval': 2,
  }, 'Water Energy'),
  surge: fill({
    Voltorb: 4, 'Electrode (Jungle)': 2, Magnemite: 4, Magneton: 2, Pikachu: 4, Raichu: 2, Electabuzz: 2,
    Bill: 3, PlusPower: 2, 'Energy Removal': 3, Switch: 2, Potion: 2, 'Gust of Wind': 2,
  }, 'Lightning Energy'),
  erika: fill({
    Oddish: 4, Gloom: 3, Vileplume: 2, Bellsprout: 4, Weepinbell: 3, Victreebel: 2, Tangela: 2, Exeggcute: 2,
    Bill: 2, 'Pokémon Center': 2, Potion: 2, Switch: 2, 'Poké Ball': 2, 'Professor Oak': 2,
  }, 'Grass Energy'),
  koga: fill({
    Grimer: 3, Muk: 2, Ekans: 3, Arbok: 2, Zubat: 4, Golbat: 3, Koffing: 3, Weezing: 2,
    Bill: 3, Potion: 2, Switch: 2, 'Energy Removal': 3, 'Professor Oak': 2,
  }, 'Grass Energy'),
  sabrina: fill({
    Abra: 4, Kadabra: 3, Alakazam: 2, Drowzee: 3, Hypno: 2, Mewtwo: 2, 'Mr. Mime': 1, Gastly: 2,
    'Professor Oak': 3, Bill: 2, 'Super Potion': 2, Switch: 2, 'Energy Removal': 2, 'Gust of Wind': 2,
  }, 'Psychic Energy'),
  blaine: fill({
    Growlithe: 4, Arcanine: 2, Ponyta: 3, Rapidash: 2, Vulpix: 3, Ninetales: 2, 'Magmar (Fossil)': 3,
    Bill: 3, 'Professor Oak': 2, 'Energy Retrieval': 3, Potion: 2, Switch: 2, PlusPower: 2,
  }, 'Fire Energy'),
  giovanni: fill({
    Rhyhorn: 4, Rhydon: 3, Cubone: 3, Marowak: 2, Diglett: 3, Dugtrio: 2, Hitmonchan: 2, Onix: 1,
    'Professor Oak': 3, Bill: 2, 'Super Energy Removal': 2, 'Energy Removal': 2, 'Gust of Wind': 2, PlusPower: 2, 'Super Potion': 2,
  }, 'Fighting Energy'),

  // --- Elite Four + Champion -------------------------------------------------
  lorelei: fill({
    Lapras: 3, Articuno: 2, Seel: 3, Dewgong: 2, Shellder: 3, Cloyster: 2, Psyduck: 3, Golduck: 2,
    'Professor Oak': 3, Bill: 2, 'Super Potion': 3, Switch: 2, 'Gust of Wind': 2, 'Energy Retrieval': 2,
  }, 'Water Energy'),
  bruno: fill({
    Hitmonlee: 3, Hitmonchan: 3, Machop: 4, Machoke: 3, Machamp: 2, Mankey: 3, Primeape: 2,
    'Professor Oak': 3, Bill: 2, PlusPower: 3, Potion: 2, Switch: 2, 'Gust of Wind': 2,
  }, 'Fighting Energy'),
  agatha: fill({
    'Gastly (Fossil)': 4, 'Haunter (Fossil)': 3, Gengar: 2, Drowzee: 3, Hypno: 2, Slowpoke: 3, Slowbro: 2,
    'Professor Oak': 3, Bill: 2, 'Energy Removal': 3, 'Super Potion': 2, Switch: 2, 'Gust of Wind': 2,
  }, 'Psychic Energy'),
  lance: fill({
    Dratini: 4, Dragonair: 3, Dragonite: 1, 'Dragonite (Promo 5)': 1, Magikarp: 3, Gyarados: 2, Kangaskhan: 2, Snorlax: 2,
    'Professor Oak': 3, Bill: 2, 'Super Energy Removal': 2, Switch: 2, 'Super Potion': 2, 'Gust of Wind': 2,
    'Double Colorless Energy': 4,
  }, 'Water Energy'),
  champion: {
    Eevee: 4, Jolteon: 2, Flareon: 2, Vaporeon: 2, Pidgey: 3, Pidgeotto: 2, Pidgeot: 2, Scyther: 2,
    'Professor Oak': 3, Bill: 2, PlusPower: 2, 'Super Energy Removal': 2, 'Gust of Wind': 2, Switch: 2, 'Scoop Up': 2, 'Super Potion': 2,
    'Lightning Energy': 8, 'Fire Energy': 8, 'Water Energy': 8,
  },

  // --- Rocket Takeover story ---------------------------------------------------
  // Rebels (training matches early in the story)
  rebelSurge: fill({
    'Voltorb (Rocket)': 4, 'Dark Electrode': 2, 'Magnemite (Rocket)': 3, 'Dark Magneton': 2, Pikachu: 3, Raichu: 1, Electabuzz: 2,
    Bill: 3, Switch: 2, Potion: 2, 'Energy Removal': 2,
  }, 'Lightning Energy'),
  rebelClair: fill({
    'Dratini (Rocket)': 4, 'Dark Dragonair': 3, 'Dark Dragonite': 1, 'Magikarp (Rocket)': 3, 'Dark Gyarados': 2, Lapras: 2,
    Bill: 3, 'Professor Oak': 2, Switch: 2, 'Super Potion': 2,
    'Double Colorless Energy': 3,
  }, 'Water Energy'),
  rebelGiovanni: fill({
    'Machop (Rocket)': 4, 'Dark Machoke': 3, 'Dark Machamp': 1, 'Diglett (Rocket)': 3, 'Dark Dugtrio': 2, 'Mankey (Rocket)': 3, 'Dark Primeape': 2, Rhyhorn: 2,
    'Professor Oak': 2, Bill: 2, Switch: 2, PlusPower: 2, 'Gust of Wind': 2,
  }, 'Fighting Energy'),
  zinnia: fill({
    'Dratini (Rocket)': 4, 'Dark Dragonair': 2, 'Eevee (Rocket)': 3, 'Dark Vaporeon': 2, 'Magikarp (Rocket)': 2, 'Dark Gyarados': 1, 'Meowth (Rocket)': 3,
    Bill: 2, Potion: 2, Switch: 2, 'Energy Search': 2,
  }, 'Water Energy'),

  // Team Rocket bosses
  execMisty: fill({
    'Psyduck (Rocket)': 4, 'Dark Golduck': 3, 'Squirtle (Rocket)': 4, 'Dark Wartortle': 3, 'Dark Blastoise': 1, 'Magikarp (Rocket)': 2, 'Dark Gyarados': 2,
    Bill: 3, 'Super Potion': 2, Switch: 2, 'Gust of Wind': 2, "Rocket's Sneak Attack": 2,
  }, 'Water Energy'),
  bossErika: fill({
    'Oddish (Rocket)': 4, 'Dark Gloom': 3, 'Dark Vileplume': 2, 'Ekans (Rocket)': 3, 'Dark Arbok': 2, 'Zubat (Rocket)': 3, 'Dark Golbat': 2,
    Bill: 2, Potion: 2, Switch: 2, 'Sleep!': 2, 'Nightly Garbage Run': 2,
  }, 'Grass Energy'),
  rocketBlaine: fill({
    'Charmander (Rocket)': 4, 'Dark Charmeleon': 3, 'Dark Charizard': 1, 'Ponyta (Rocket)': 3, 'Dark Rapidash': 2, Growlithe: 3, Arcanine: 1, 'Eevee (Rocket)': 2, 'Dark Flareon': 2,
    'Professor Oak': 2, Bill: 2, 'Energy Retrieval': 2, Switch: 2, Potion: 2,
  }, 'Fire Energy'),
  rocketManager: fill({
    'Drowzee (Rocket)': 4, 'Dark Hypno': 3, 'Slowpoke (Rocket)': 3, 'Dark Slowbro': 2, 'Grimer (Rocket)': 3, 'Dark Muk': 2,
    "The Boss's Way": 2, "Rocket's Sneak Attack": 2, "Imposter Oak's Revenge": 2, Bill: 2, Switch: 2, Digger: 2,
    'Grass Energy': 14,
  }, 'Psychic Energy'),
  bossNorman: fill({
    'Meowth (Rocket)': 4, 'Dark Persian': 3, 'Rattata (Rocket)': 4, 'Dark Raticate': 3, 'Eevee (Rocket)': 3, 'Dark Jolteon': 2, Kangaskhan: 2, Snorlax: 1,
    'Professor Oak': 2, Bill: 2, 'Super Potion': 2, 'Gust of Wind': 2, 'Energy Removal': 2,
    'Double Colorless Energy': 4,
  }, 'Lightning Energy'),
  rocketMaster: {
    'Eevee (Rocket)': 4, 'Dark Flareon': 2, 'Dark Jolteon': 2, 'Dark Vaporeon': 2, 'Porygon (Rocket)': 2, 'Meowth (Rocket)': 2, 'Dark Persian': 2, Scyther: 2,
    'Professor Oak': 3, "Rocket's Sneak Attack": 2, 'Challenge!': 2, 'Here Comes Team Rocket!': 1, 'Super Energy Removal': 2, 'Gust of Wind': 2,
    'Rainbow Energy': 4, 'Fire Energy': 9, 'Lightning Energy': 9, 'Water Energy': 8,
  },
  oldLance: fill({
    'Dratini (Rocket)': 4, 'Dark Dragonair': 3, 'Dark Dragonite': 2, 'Magikarp (Rocket)': 3, 'Dark Gyarados': 3, Kangaskhan: 2,
    'Professor Oak': 3, Bill: 2, 'Super Energy Removal': 2, 'Gust of Wind': 2, Switch: 2,
    'Double Colorless Energy': 4, 'Rainbow Energy': 3,
  }, 'Water Energy'),
  champSabrina: fill({
    'Abra (Rocket)': 4, 'Dark Kadabra': 3, 'Dark Alakazam': 2, 'Drowzee (Rocket)': 3, 'Dark Hypno': 2, Mewtwo: 2, 'Mr. Mime': 1,
    'Professor Oak': 3, "Rocket's Sneak Attack": 3, "Imposter Oak's Revenge": 2, 'Goop Gas Attack': 2, 'Super Energy Removal': 2, 'Gust of Wind': 2,
  }, 'Psychic Energy'),

  // --- League Reborn story -------------------------------------------------------
  // Gym Leaders back at their gyms, fighting with their signature Gym-set decks.
  gymBrock: fill({
    "Brock's Rhyhorn (Heroes 70)": 3, "Brock's Rhydon": 2, "Brock's Onix (Heroes 69)": 2,
    "Brock's Geodude (Heroes 66)": 3, "Brock's Graveler": 2, "Brock's Golem": 1,
    "Brock's Sandshrew (Heroes 72)": 2, "Brock's Sandslash": 2, "Brock's Lickitung": 2,
    Brock: 2, "Brock's Training Method": 2, 'Pewter City Gym': 2, Bill: 2, Potion: 2, Switch: 1,
  }, 'Fighting Energy'),
  gymMisty: fill({
    "Misty's Horsea": 3, "Misty's Seadra": 2, "Misty's Staryu": 3, "Misty's Starmie": 2,
    "Misty's Tentacool (Heroes 57)": 3, "Misty's Tentacruel": 2,
    "Misty's Poliwag": 2, "Misty's Poliwhirl": 1, "Misty's Poliwrath": 1,
    Misty: 2, "Misty's Wrath": 2, 'Cerulean City Gym': 2, Bill: 2, 'Super Potion': 2,
  }, 'Water Energy'),
  gymSurge: fill({
    "Lt. Surge's Pikachu": 3, "Lt. Surge's Raichu": 2, "Lt. Surge's Magnemite (Heroes 80)": 3, "Lt. Surge's Magneton": 2,
    "Lt. Surge's Electabuzz": 2, "Lt. Surge's Voltorb": 2, "Lt. Surge's Electrode": 2,
    "Lt. Surge's Spearow (Heroes 83)": 2, "Lt. Surge's Fearow": 1,
    'Lt. Surge': 2, "Lt. Surge's Treaty": 2, 'Vermilion City Gym': 2, Bill: 2, 'Energy Removal': 2,
  }, 'Lightning Energy'),
  gymErika: fill({
    "Erika's Oddish (Heroes 78)": 4, "Erika's Gloom (Heroes 46)": 2, "Erika's Vileplume": 2,
    "Erika's Bellsprout (Heroes 76)": 3, "Erika's Weepinbell (Heroes 49)": 2, "Erika's Victreebel": 1,
    "Erika's Tangela": 2, "Erika's Exeggcute": 2, "Erika's Exeggutor": 1,
    Erika: 2, "Erika's Perfume": 2, 'Celadon City Gym': 2, Bill: 2, 'Pokémon Center': 2,
  }, 'Grass Energy'),
  gymKoga: fill({
    "Koga's Weedle": 3, "Koga's Kakuna": 2, "Koga's Beedrill": 2, "Koga's Ekans": 3, "Koga's Arbok": 2,
    "Koga's Koffing (Challenge 79)": 3, "Koga's Weezing": 2, "Koga's Zubat": 2, "Koga's Golbat": 1,
    Koga: 2, "Koga's Ninja Trick": 2, 'Fuchsia City Gym': 2, Bill: 2, Switch: 2,
  }, 'Grass Energy'),
  gymSabrina: fill({
    "Sabrina's Abra": 4, "Sabrina's Kadabra": 3, "Sabrina's Alakazam": 2,
    "Sabrina's Gastly": 3, "Sabrina's Haunter": 2, "Sabrina's Gengar (Challenge)": 2,
    "Sabrina's Drowzee": 2, "Sabrina's Hypno": 1,
    Sabrina: 2, "Sabrina's ESP": 2, 'Saffron City Gym': 2, "Sabrina's Gaze": 2, Bill: 2,
  }, 'Psychic Energy'),
  gymBlaine: fill({
    "Blaine's Charmander": 3, "Blaine's Charmeleon": 2, "Blaine's Charizard": 1,
    "Blaine's Growlithe": 3, "Blaine's Arcanine": 2, "Blaine's Ponyta": 3, "Blaine's Rapidash": 2,
    "Blaine's Vulpix": 2, "Blaine's Ninetales": 1,
    Blaine: 2, "Blaine's Quiz #1": 1, "Blaine's Gamble": 2, 'Cinnabar City Gym': 2, 'Energy Retrieval': 2, Bill: 1,
  }, 'Fire Energy'),
  gymGiovanni: {
    "Giovanni's Nidoran ♂": 3, "Giovanni's Nidorino": 2, "Giovanni's Nidoking": 2,
    "Giovanni's Nidoran ♀": 2, "Giovanni's Nidorina": 1, "Giovanni's Nidoqueen": 1,
    "Giovanni's Machop": 3, "Giovanni's Machoke": 2, "Giovanni's Machamp": 1,
    "Giovanni's Meowth (Challenge 74)": 2, "Giovanni's Persian": 2,
    Giovanni: 3, "Giovanni's Last Resort": 2, 'Viridian City Gym': 2, 'Professor Oak': 2, 'Gust of Wind': 2,
    'Grass Energy': 16, 'Fighting Energy': 12,
  },

  // Rocket remnants (the minor Team Rocket presence) + the rogue experiment
  remnantGrunt: fill({
    'Rattata (Rocket)': 4, 'Dark Raticate': 2, 'Zubat (Rocket)': 4, 'Dark Golbat': 2,
    'Ekans (Rocket)': 3, 'Grimer (Rocket)': 3,
    Bill: 2, Potion: 2, Switch: 2,
  }, 'Grass Energy'),
  remnantOfficer: fill({
    'Machop (Rocket)': 3, 'Dark Machoke': 2, "Rocket's Hitmonchan": 2, "Rocket's Scyther": 2, "Rocket's Snorlax": 2,
    'Mankey (Rocket)': 3, 'Dark Primeape': 2,
    'Minion of Team Rocket': 2, "The Rocket's Trap": 1, "Rocket's Sneak Attack": 2, Bill: 2, Switch: 2, "The Rocket's Training Gym": 2,
    'Grass Energy': 11,
  }, 'Fighting Energy'),
  rocketExperiment: fill({
    "Rocket's Mewtwo": 3, "Sabrina's Abra (Challenge)": 3, "Sabrina's Kadabra": 2,
    "Sabrina's Drowzee (Challenge)": 2, "Sabrina's Hypno": 1, "Sabrina's Mr. Mime": 2, "Sabrina's Porygon": 2,
    "Rocket's Secret Experiment": 2, "Sabrina's Psychic Control": 2, Bill: 2, 'Super Potion': 2, "Rocket's Minefield Gym": 2,
  }, 'Psychic Energy'),
  rocketElite: fill({
    "Rocket's Zapdos": 2, "Rocket's Moltres": 2, "Rocket's Scyther": 2, "Rocket's Hitmonchan": 2, "Rocket's Snorlax": 2,
    'Eevee (Rocket)': 3, 'Dark Jolteon': 2, 'Dark Flareon': 2,
    'Professor Oak': 2, "Rocket's Sneak Attack": 2, 'Gust of Wind': 2, 'Super Energy Removal': 2, "The Rocket's Trap": 1,
    'Fire Energy': 12, 'Grass Energy': 8,
  }, 'Lightning Energy'),

  // Rival Blue, investigating the same trail
  rivalBlue: fill({
    Eevee: 4, Jolteon: 2, Vaporeon: 1, Pidgey: 3, Pidgeotto: 2, Scyther: 2, Kangaskhan: 2, Snorlax: 1,
    'Professor Oak': 2, Bill: 2, 'Energy Removal': 2, Switch: 2,
    'Water Energy': 12,
  }, 'Lightning Energy'),
  rivalBlue2: {
    Eevee: 4, Jolteon: 2, Flareon: 2, Vaporeon: 2, Pidgey: 3, Pidgeotto: 2, Pidgeot: 2, Scyther: 2,
    'Professor Oak': 3, Bill: 2, PlusPower: 2, 'Super Energy Removal': 2, 'Gust of Wind': 2, 'Scoop Up': 1,
    'Fire Energy': 10, 'Lightning Energy': 10, 'Water Energy': 9,
  },

  // --- Rival encounters --------------------------------------------------------
  rival1: fill({
    Eevee: 3, Meowth: 3, Rattata: 3, Spearow: 3, Pidgey: 3, Machop: 2, Doduo: 3, Mankey: 2,
    Bill: 2, Potion: 3, Switch: 2, 'Poké Ball': 2, 'Energy Search': 2,
  }, 'Fighting Energy'),
  rival2: fill({
    Squirtle: 3, Wartortle: 2, Eevee: 3, Vaporeon: 1, Fearow: 2, Spearow: 2, Raticate: 2, Rattata: 3, Meowth: 2, Persian: 1,
    Bill: 3, Potion: 2, Switch: 2, 'Gust of Wind': 2, 'Energy Removal': 2,
  }, 'Water Energy'),
  rival3: fill({
    Squirtle: 3, Wartortle: 2, Blastoise: 1, Vaporeon: 2, Eevee: 3, Fearow: 2, Spearow: 1, Persian: 2, Meowth: 2, Kangaskhan: 1,
    'Professor Oak': 2, Bill: 2, 'Super Potion': 2, 'Energy Removal': 2, Switch: 2, 'Gust of Wind': 2,
  }, 'Water Energy'),
}

// --- Generated trainer decks --------------------------------------------------

// mulberry32 seeded by a string, so each node always plays the same deck.
function rngFor(seed) {
  let h = 1779033703
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ENERGY_FOR_TYPE = {
  grass: 'Grass Energy',
  fire: 'Fire Energy',
  water: 'Water Energy',
  lightning: 'Lightning Energy',
  psychic: 'Psychic Energy',
  fighting: 'Fighting Energy',
  colorless: 'Fighting Energy', // colorless attacks accept any energy
}

// Cards the generator should never pick (fossil evolutions need the trainer,
// promo trainers are situational).
const GENERATOR_SKIP = new Set(['Mysterious Fossil', 'Clefairy Doll'])
const skipCard = (c) => GENERATOR_SKIP.has(c.name) || c.evolvesFrom === 'Mysterious Fossil'

const TRAINERS_BY_TIER = {
  1: { Bill: 2, Potion: 2 },
  2: { Bill: 2, Potion: 2, Switch: 2, 'Energy Removal': 2 },
  3: { 'Professor Oak': 2, Bill: 2, Potion: 2, Switch: 2, 'Energy Removal': 2, 'Gust of Wind': 2, PlusPower: 2 },
}

// Build a legal 60-card deck for a regular trainer node. `types` picks the
// energy/pokemon pools, `tier` (1-3) controls rarity and evolution depth, and
// `seed` makes it deterministic. Reusable by future stories: pass the story's
// format so only its sets are drawn from.
export function generateTrainerDeck(types, tier = 1, seed = 'trainer', format = FORMATS.classic) {
  const rng = rngFor(`${seed}|${types.join('+')}|${tier}`)
  const pool = CARD_STATS.filter(
    (c) => c.supertype === 'pokemon' && format.sets.includes(c.set) && types.includes(c.type) && !skipCard(c)
  )
  const rarityOk = (c) =>
    tier >= 3 ? true : tier === 2 ? c.rarity !== 'Rare Holo' : c.rarity === 'Common' || c.rarity === 'Uncommon'
  const basics = pool.filter((c) => c.stage === 'basic' && rarityOk(c))
  const evoOf = (species) => pool.find((c) => c.evolvesFrom === species && rarityOk(c))

  const counts = {}
  const usedSpecies = new Set()
  const addCard = (card, n) => {
    counts[card.name] = (counts[card.name] ?? 0) + n
    usedSpecies.add(card.species)
  }

  const pokemonTarget = tier >= 3 ? 20 : tier === 2 ? 18 : 16
  let total = 0
  let guard = 0
  while (total < pokemonTarget && guard++ < 60) {
    const basic = basics[Math.floor(rng() * basics.length)]
    if (!basic || usedSpecies.has(basic.species)) continue
    const line = Math.min(tier >= 2 ? 3 : 4, pokemonTarget - total) // leave room for evolutions
    if (line < 2) break
    addCard(basic, line)
    total += line
    const stage1 = tier >= 2 ? evoOf(basic.species) : null
    if (stage1 && !usedSpecies.has(stage1.species) && total + 2 <= pokemonTarget) {
      addCard(stage1, 2)
      total += 2
      const stage2 = tier >= 3 ? evoOf(stage1.species) : null
      if (stage2 && !usedSpecies.has(stage2.species) && total + 1 <= pokemonTarget) {
        addCard(stage2, 1)
        total += 1
      }
    }
  }
  // Pathological pools (shouldn't happen for real types): pad with any basic
  if (total === 0) addCard(basics[0] ?? byName['Rattata'], 4)

  for (const [name, n] of Object.entries(TRAINERS_BY_TIER[tier] ?? TRAINERS_BY_TIER[1])) {
    counts[name] = n
  }

  // Split the remaining slots across the deck's energy types.
  const energies = [...new Set(types.map((t) => ENERGY_FOR_TYPE[t]).filter(Boolean))]
  const size = Object.values(counts).reduce((a, b) => a + b, 0)
  const room = 60 - size
  energies.forEach((name, i) => {
    const share = Math.floor(room / energies.length) + (i < room % energies.length ? 1 : 0)
    if (share > 0) counts[name] = (counts[name] ?? 0) + share
  })
  return counts
}

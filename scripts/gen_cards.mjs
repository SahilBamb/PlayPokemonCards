// Generates src/data/cardStats.js from the raw pokemontcg.io dumps
// (scripts/{base1,jungle,fossil,basep,neo1,rocket,gym1,gym2}_raw.json).
// Run: node scripts/gen_cards.mjs
//
// Each output card gets:
//   set     - 'base1' | 'jungle' | 'fossil' | 'promo' | 'rocket' | 'gym1' | 'gym2'
//   rarity  - 'Rare Holo' | 'Rare' | 'Uncommon' | 'Common' | 'Promo' | null
//   species - the printed card name (evolution matching + shared copy limits)
//   name    - unique across all sets; re-prints get a " (Jungle)"/" (Rocket)"
//             suffix so the name-keyed engine can tell prints apart. Same-name
//             but *different* cards inside one set (three promo Mewtwo, two
//             distinct Brock's Sandshrew...) get " (<Label> <number>)".
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))

// The 'promo' set is the pre-Rocket Wizards Black Star Promos (WBSP #1-16 and
// the movie birds #21-23; Dark Persian onward belongs to the Rocket era) plus
// Super Energy Retrieval — a Japanese promo of the era that the Game Boy game
// included, printed internationally in Neo Genesis (#89).
// gym1/gym2 reprint the six basic energies; skipEnergy drops those.
const SETS = [
  { id: 'base1', label: 'Base', file: 'base1_raw.json' },
  { id: 'jungle', label: 'Jungle', file: 'jungle_raw.json' },
  { id: 'fossil', label: 'Fossil', file: 'fossil_raw.json' },
  {
    id: 'promo', label: 'Promo', file: 'basep_raw.json', dedupe: false, numberedSuffix: true,
    numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 21, 22, 23],
  },
  { id: 'promo', label: 'Promo', file: 'neo1_raw.json', numbers: [89], rarity: 'Promo' },
  // rocket #30 is the non-holo Dark Vileplume with the famous "Fighting
  // weakness" misprint — same card as #13, so skip it.
  { id: 'rocket', label: 'Rocket', file: 'rocket_raw.json', exclude: [30] },
  { id: 'gym1', label: 'Heroes', file: 'gym1_raw.json', skipEnergy: true },
  { id: 'gym2', label: 'Challenge', file: 'gym2_raw.json', skipEnergy: true },
]

// Team Rocket's special energies (everything else is basic or DCE).
const SPECIAL_ENERGY = {
  'Rainbow Energy': { energy: 'rainbow', special: 'rainbow' },
  'Full Heal Energy': { energy: 'colorless', special: 'fullheal' },
  'Potion Energy': { energy: 'colorless', special: 'potion' },
}

const t = (s) => s.toLowerCase()
const costObj = (arr) => {
  const o = {}
  for (const c of arr || []) {
    const k = t(c)
    o[k] = (o[k] || 0) + 1
  }
  return o
}

function convert(c, setId) {
  const base = {
    name: c.name,
    species: c.name,
    set: setId,
    rarity: c.rarity || null,
    number: +c.number,
    image: c.images?.small || null,
  }
  if (c.supertype === 'Pokémon') {
    return {
      ...base,
      supertype: 'pokemon',
      stage: c.subtypes.includes('Stage 2') ? 'stage2' : c.subtypes.includes('Stage 1') ? 'stage1' : 'basic',
      hp: +c.hp,
      type: t(c.types[0]),
      evolvesFrom: c.evolvesFrom || null,
      weakness: c.weaknesses ? t(c.weaknesses[0].type) : null,
      resistance: c.resistances ? t(c.resistances[0].type) : null,
      retreatCost: c.convertedRetreatCost || 0,
      power: c.abilities ? { name: c.abilities[0].name, text: c.abilities[0].text } : null,
      attacks: (c.attacks || []).map((a) => ({
        name: a.name,
        cost: costObj(a.cost),
        damage: a.damage || '',
        text: a.text || '',
      })),
    }
  }
  if (c.supertype === 'Trainer') {
    const card = { ...base, supertype: 'trainer', text: (c.rules || []).join(' ') }
    if ((c.subtypes || []).includes('Stadium')) card.subtype = 'stadium'
    return card
  }
  const special = SPECIAL_ENERGY[c.name]
  return {
    ...base,
    supertype: 'energy',
    energy: special ? special.energy : c.name === 'Double Colorless Energy' ? 'doublecolorless' : t(c.name.split(' ')[0]),
    ...(special ? { special: special.special } : {}),
    text: (c.rules || []).join(' '),
  }
}

const BASIC_ENERGY = new Set(['Fighting Energy', 'Fire Energy', 'Grass Energy', 'Lightning Energy', 'Psychic Energy', 'Water Energy'])

// Signature ignoring print-specific fields, so holo/non-holo re-prints inside
// one set collapse while genuinely different same-name cards survive.
const sigOf = (card) => JSON.stringify({ ...card, number: 0, image: null, rarity: null })

const all = []
const seenNames = new Set()
for (const { id, label, file, dedupe = true, numbers = null, numberedSuffix = false, rarity, skipEnergy = false, exclude = [] } of SETS) {
  const raw = JSON.parse(fs.readFileSync(path.join(here, file), 'utf8'))
  const data = raw.data ?? raw
  const seenSigs = new Set()
  const namesInSet = new Set()
  for (const c of data) {
    if (numbers && !numbers.includes(+c.number)) continue
    if (exclude.includes(+c.number)) continue
    if (skipEnergy && c.supertype === 'Energy' && BASIC_ENERGY.has(c.name)) continue // reprints of Base energies
    const card = convert(c, id)
    if (rarity) card.rarity = rarity
    if (dedupe) {
      const sig = sigOf(card)
      if (seenSigs.has(sig)) continue // holo/non-holo duplicate within the set
      seenSigs.add(sig)
    }
    if (seenNames.has(card.name)) {
      // Same-set collisions are different cards sharing a name → number them.
      // Cross-set collisions are re-prints → tag with the set label.
      if (numberedSuffix || namesInSet.has(card.name)) {
        card.name = `${card.species} (${label} ${card.number})`
      } else {
        const labeled = `${card.species} (${label})`
        card.name = seenNames.has(labeled) ? `${card.species} (${label} ${card.number})` : labeled
      }
    }
    namesInSet.add(card.species)
    seenNames.add(card.name)
    all.push(card)
  }
}

// Cards with no pokemontcg.io dump: the Japanese vending-machine Gastly and
// Haunter (never released in English; the "most broken deck of all time"
// Original Rules list uses them). Images live in public/cards/.
const EXTRA_CARDS = [
  {
    name: 'Gastly (Vending)', species: 'Gastly', set: 'vending', rarity: 'Common', number: 92,
    image: '/cards/gastly-vending.png',
    supertype: 'pokemon', stage: 'basic', hp: 40, type: 'psychic', evolvesFrom: null,
    weakness: null, resistance: 'fighting', retreatCost: 1, power: null,
    attacks: [
      {
        name: 'Spookify', cost: { colorless: 1 }, damage: '',
        text: "Your opponent can't play Trainer cards from his or her hand during his or her next turn.",
      },
      {
        name: 'Fade to Black', cost: { psychic: 1, colorless: 1 }, damage: '10',
        text: 'Flip a coin. If heads, the Defending Pokémon is now Confused.',
      },
    ],
  },
  {
    name: 'Haunter (Vending)', species: 'Haunter', set: 'vending', rarity: 'Rare', number: 93,
    image: '/cards/haunter-vending.png',
    supertype: 'pokemon', stage: 'stage1', hp: 70, type: 'psychic', evolvesFrom: 'Gastly',
    weakness: null, resistance: 'fighting', retreatCost: 1, power: null,
    attacks: [
      {
        name: 'Poltergeist', cost: { psychic: 1 }, damage: '10x',
        text: "Look at your opponent's hand. This attack does 10 damage times the number of Trainer cards your opponent has in his or her hand.",
      },
      {
        name: 'Bad Dreams', cost: { psychic: 2 }, damage: '20',
        text: 'Flip a coin. If heads, the Defending Pokémon is now Asleep. If tails, the Defending Pokémon is now Confused.',
      },
    ],
  },
]
all.push(...EXTRA_CARDS)

const out = '// Auto-generated by scripts/gen_cards.mjs — do not edit by hand.\nconst CARD_STATS = ' +
  JSON.stringify(all, null, 1) + '\n\nexport default CARD_STATS\n'
fs.writeFileSync(path.join(here, '..', 'src', 'data', 'cardStats.js'), out)
const ids = [...new Set(SETS.map((s) => s.id))]
const counts = ids.map((id) => `${id}: ${all.filter((c) => c.set === id).length}`).join(', ')
console.log(`Wrote ${all.length} cards (${counts}) to src/data/cardStats.js`)

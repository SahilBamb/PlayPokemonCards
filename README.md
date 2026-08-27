# PlayPokemonCards

A full implementation of the classic Pokémon TCG — every card from Base Set
through Gym Challenge (530 cards, plus Wizards promos and two Japanese vending
cards) — built on a small library of composable effect primitives.

## Game modes

- **Quick Play** — rule-enforced match against an AI (multiple personalities),
  with 70+ historical preset decks or your own.
- **Story Mode** — three campaigns (Kanto Challenge, Rocket Takeover, League
  Reborn) with booster packs, a card collection, currency, and boss battles.
- **Sandbox** — free-form two-sided board for testing cards and interactions.
- **Deck Editor** — build and save decks; the same editor is reused (with
  collection constraints) inside Story Mode.

The game is local-first: matches, story progress, and decks all run in the
browser. Online multiplayer lives on the `feature/multiplayer` branch and is
not part of this mainline.

## Run it

```bash
npm install
npm run dev           # web client on http://localhost:5173
```

Headless test suites:

```bash
npm run test:engine   # engine unit tests
npm run test:match    # AI-vs-AI full matches
npm run test:story    # story data + progression tests
```

## Architecture

```
src/
  data/
    cardStats.js     # auto-generated card stats for all sets (scripts/gen_cards.mjs)
    cardEffects.js   # hand-authored effect encodings for every card
    presetDecks.js   # Quick Play decks; sets.js defines sets/formats
    stories/         # story mode campaigns (kanto, rocket, league)
  engine/
    utils.js         # coin flips, costMatch, energy accounting
    state.js         # immutable update helpers, target resolution
    damage.js        # applyDamage pipeline + KO handling
    targets.js       # CHOOSE validation (pokemon/card/energy filters)
    powers.js        # passive Pokémon Power hooks (HP, retreat, bench size…)
    primitives.js    # the effect primitive registry
    reducer.js       # actions, effect queue runner, turn tick
    match.js         # match rules: turn order, guards, win conditions
    actions.js       # enumerateActions: every legal action for a player
    view.js          # maskStateFor: what each player is allowed to see
  ai/                # AI policies (basic, aggro, stall, random)
  components/        # React UI (board, modals, story mode)
  lib/               # localStorage stores (decks, profile, settings)
```

### Effect model

Every attack, Trainer, and Power is an array of effect objects processed
through a queue. Three modifiers compose with any effect:

- `flip: N` — flip N coins once, store heads/tails in context
- `if: 'heads' | 'tails' | 'didDamage' | …` — condition gate
- `amount: {...}` — calculators for scaling damage (per heads, per energy,
  per damage counter, half remaining HP, ...)

`CHOOSE` is the interrupt primitive: it pauses the queue and prompts the user
(board click or modal), stores the result in context, and the queue resumes.
Primitives read prior choices from context, so "pick a Pokémon, pick an
energy, discard it" is just three effects in a row.

### Adding a card

Add stats to the generator (`scripts/gen_cards.mjs`) and an encoding to
`cardEffects.js`. Most cards need one line, e.g.:

```js
'Stun Spore': FLIP_ST('paralyzed'),
'Fire Blast': { effects: COST_DISCARD(1, { energyType: 'fire' }) },
```

Attacks with plain numeric damage need no encoding at all — the engine
auto-queues the damage effect.

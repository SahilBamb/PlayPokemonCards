# Pokémon TCG — Base Set Sandbox

A data-driven implementation of the original Base Set (all 102 cards) built on a small
library of composable effect primitives. Runs as a two-sided sandbox: no turn
enforcement, but full battle mechanics (weakness/resistance, statuses, guards,
KOs, evolution, retreat, Trainers, Pokémon Powers).

## Run it

```bash
npm install
npm run dev          # play in the browser
npm run test:engine  # headless engine tests (45 scenarios)
```

## How to play the sandbox

- Drag Basic Pokémon from your hand onto the Active/Bench spots.
- Drag Energy onto a Pokémon to attach it; drag an evolution card onto its
  pre-evolution to evolve.
- Click an attack row on a Pokémon in play to attack (cost is enforced).
- Click a Trainer card in hand to play it. Click the deck to draw, the discard
  pile to browse it.
- **End Turn** runs between-turn effects: poison ticks, sleep checks, paralysis
  and guard/marker expiry.
- Yellow-highlighted cards are valid targets when an effect asks you to choose.
- Console helper: `window.__game.spawn('Charizard')` puts any card in p1's hand.

## Architecture

```
src/
  data/
    baseStats.js     # auto-generated card stats (scripts/gen_cards.mjs)
    cardEffects.js   # hand-authored effect encodings for every card
  engine/
    utils.js         # coin flips, costMatch, energy accounting
    state.js         # immutable update helpers, target resolution
    damage.js        # applyDamage pipeline + KO handling
    targets.js       # CHOOSE validation (pokemon/card/energy filters)
    primitives.js    # the effect primitive registry (~20 primitives)
    reducer.js       # actions, effect queue runner, turn tick
  components/        # React UI (cards, zones, modals, log)
```

### Effect model

Every attack, Trainer, and Power is an array of effect objects processed
through a queue. Three modifiers compose with any effect:

- `flip: N` — flip N coins once, store heads/tails in context
- `if: 'heads' | 'tails' | 'didDamage'` — condition gate
- `amount: {...}` — calculators for scaling damage (per heads, per energy,
  per damage counter, half remaining HP, extra water energy, ...)

`CHOOSE` is the interrupt primitive: it pauses the queue and prompts the user
(board click or modal), stores the result in context, and the queue resumes.
Primitives read prior choices from context, so "pick a Pokémon, pick an energy,
discard it" is just three effects in a row.

### Adding a card

Add stats to the generator (or `baseStats.js`) and an encoding to
`cardEffects.js`. Most cards need one line, e.g.:

```js
'Stun Spore': FLIP_ST('paralyzed'),
'Fire Blast': { effects: COST_DISCARD(1, { energyType: 'fire' }) },
```

Attacks with plain numeric damage need no encoding at all — the engine
auto-queues the damage effect.

## Deferred (not yet implemented)

Turn/phase enforcement, once-per-turn limits (energy attach, powers), prizes
and win conditions, mulligans, first-turn/evolution timing rules, AI opponent.

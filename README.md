# PlayPokemonCards

A full implementation of the classic Pokémon TCG — every card from Base Set
through Gym Challenge (530 cards, plus Wizards promos and two Japanese vending
cards) — built on a small library of composable effect primitives.

## Game modes

- **Quick Play** — rule-enforced match against an AI (multiple personalities),
  with 70+ historical preset decks or your own.
- **Multiplayer** — online play against real people: private matches by share
  code, ranked matches with Elo, and a leaderboard. See below.
- **Story Mode** — three campaigns (Kanto Challenge, Rocket Takeover, League
  Reborn) with booster packs, a card collection, currency, and boss battles.
- **Sandbox** — free-form two-sided board for testing cards and interactions.
- **Deck Editor** — build and save decks; the same editor is reused (with
  collection constraints) inside Story Mode.

## Run it

```bash
npm install
npm run dev           # web client on http://localhost:5173
npm run server        # multiplayer server on :2567 (only needed for Multiplayer)
```

Headless test suites:

```bash
npm run test:engine   # engine unit tests
npm run test:match    # AI-vs-AI full matches
npm run test:story    # story data + progression tests
npm run test:online   # multiplayer server: private + ranked games over websockets
npm run test:ui:online  # two real browsers play each other (needs dev server on :5199)
```

## Multiplayer

The multiplayer server ([`server/`](server/)) is built on
[Colyseus](https://colyseus.io/) and reuses the exact same game engine as
single-player. It is fully server-authoritative:

- The complete game state lives only on the server; each client receives a
  `maskStateFor` view (opponent hand, decks, and prizes hidden).
- Clients send plain reducer actions; the server checks identity and the
  engine's own `matchGuard` validates legality.
- Each client is always addressed as "p1" — the server perspective-swaps
  views and actions for the second seat, so the entire single-player board UI
  is reused unchanged.

**Modes** (one format for now: everything through Gym Challenge, the same
pool the Deck Editor builds against):

- **Private match** — create a room, share the 6-letter code, a friend joins
  with it. No rating changes.
- **Ranked match** — a queue pairs you with the next player waiting. Winners
  take Elo (K=32) from losers; forfeits and disconnects (after a 60s
  reconnection grace) count as losses.
- **Leaderboard** — `GET /leaderboard` powers the in-game screen showing the
  best (and worst) rated players.

Player identity is a generated id + secret token stored in the browser's
localStorage — no accounts or passwords. Ratings are persisted to a JSON file
(`DATA_DIR`, default `server/data/`).

### Configuration

| Variable | Where | Meaning |
|---|---|---|
| `PORT` | server | Listen port (default `2567`) |
| `DATA_DIR` | server | Directory for `players.json` (point at a persistent volume) |
| `VITE_ONLINE_URL` | client build | Server URL, e.g. `wss://your-app.up.railway.app`. Defaults to same-origin in production builds and `ws://localhost:2567` in dev. |

## Deploying to Railway

The Express app also serves the built web client from `dist/`, so a single
Railway service hosts both the game and the multiplayer server. From the repo
root:

```bash
# 0. One-time: install the CLI and log in (opens a browser)
npm install -g @railway/cli
railway login

# 1. Build the client so the server can serve it
npm run build

# 2. Create the project and deploy (Railpack detects Node and runs `npm start`)
railway init --name playpokemoncards
railway up --detach

# 3. Persistent volume for Elo ratings + point DATA_DIR at it
railway volume add --mount-path /data
railway variable set DATA_DIR=/data

# 4. Expose it to the internet (prints your public URL)
railway domain
```

That's it — open the printed URL, the game loads and Multiplayer connects to
the same origin automatically (wss). Subsequent deploys are just
`npm run build && railway up --detach`.

Notes:

- `railway variable set` and `railway volume add` trigger a redeploy on their
  own; order them before your final `railway up` if you want fewer deploys.
- To host the web client elsewhere (e.g. Vercel/Netlify), set
  `VITE_ONLINE_URL=wss://<your-railway-domain>` when building it, and deploy
  only the server to Railway.
- `GET /health` is a readiness probe you can point Railway's healthcheck at.

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
  components/        # React UI (board, modals, story mode, online lobby)
  lib/               # localStorage stores + online session plumbing
server/
  index.mjs          # Colyseus + Express bootstrap, /leaderboard, static dist/
  rooms.mjs          # server-authoritative match rooms (private + ranked)
  players.mjs        # identity, Elo, JSON persistence
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

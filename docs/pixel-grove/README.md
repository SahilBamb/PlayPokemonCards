# Pocket Grove experiment

Branch: `experiment/pixel-grove`

Separate checkout: `/Users/sahil/Projects/playpokemoncards-pixel-grove`.
The existing checkout and its unrelated local modifications are preserved.

## Run

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5187
npm run test:pixel-grove
npm run test:pixel-grove:ui
npm run build
```

On this branch `/` is the new forest demo. `/classic` runs the original game.
The experiment uses the existing React/Vite project, local font, and deployment
infrastructure, with a separate small reducer instead of modifying the full TCG
engine.

## Play

Pikachu ex begins asleep with two Lightning Energy. Flip the silver coin to
try to wake it up. Pick a card from hand, then a Pokémon or empty bench patch.
Electrode evolves from Voltorb. Attach one Energy per turn, heal with Potion,
pay one Energy to retreat, and attack to end the turn. The AI uses Jigglypuff,
Koffing, and Weezing. Take three prizes or defeat the opposing field to win.

This is a deliberately relaxed six-species ruleset, not the full classic TCG.
Evolution is allowed immediately; the hand, deck, starting field, and AI are
curated for demonstrating the visual concept. Pikachu ex is worth two prizes.
Sleep and poison resolve between turns, and a once-per-turn wake-up coin is
available as a demo affordance. There is no persistence or multiplayer.

## Asset status

The user-provided Pinterest reference is retained as `reference.jpg`.
Generated with the built-in image tool:

- `public/pixel-grove/assets/forest-board.png`
- `public/pixel-grove/assets/card-objects.png` (2 × 2 atlas)
- `public/pixel-grove/assets/energy-coins.png` (2 × 2 transparent atlas)

**Pending:** the image service repeatedly rejected the Pokémon sprite atlas,
six-character card art, and an individual awake Pikachu in its output safety
check. No specific reason was provided. The user has been asked whether to use
reference cutouts plus existing pixel sprites for missing views. The two
character atlas paths are currently reserved but are not complete.

Prompts and results are recorded in [ASSET-PROMPTS.md](ASSET-PROMPTS.md).
Validation inventory: [QA.md](QA.md).

## Branch preview deployment

After completing the art, build and deploy **only the branch preview**, preserving
the production `main` deployment:

```sh
npm run build
CLOUDFLARE_ACCOUNT_ID=77965546ba0ef6c4f1741d7d8a04039e \
  /Users/sahil/dndsurvivor/node_modules/.bin/wrangler pages deploy dist \
  --project-name playpokemoncards --branch pixel-grove
```

The intended preview alias is `https://pixel-grove.playpokemoncards.pages.dev`.
Verify the actual deployment URL returned by Wrangler, plus all asset requests
and the same browser flows, before recording it as live. Do not deploy this
experiment with `--branch main` or merge it into `master` without user direction.

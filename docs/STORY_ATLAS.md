# Story atlas UI plan

Target: the approved `01-kanto-atlas-hub.png` concept in
`~/Pictures/PlayPokemonCards-Story-UI-Concepts-2026-10-28/`.

## Asset inventory

| Asset | Production use | Method |
| --- | --- | --- |
| Kanto landscape atlas | Interactive journey map, campaign covers, regional postcard crops | Generate a clean illustration matching the approved concept, with no labels or controls |
| Pewter Gym interior | Gym encounters and the story battle environment | Generate a separate scene in the same cel painted style |
| Collector shop interior | Story Poké Mart backdrop | Generate a separate quiet shop scene with space for real UI |
| Professor's lab | Starter selection and introductory conversations | Generate a separate daylight lab scene |
| Trainer portraits | Encounter cards, dialogue speakers, campaign covers | Reuse the current character artwork and retain meaningful image fallbacks |
| Cards and booster wrappers | Starter covers, deck dock, editor, shop and battle | Reuse authentic card art and existing pack images |
| Gym badges, trophy and Poké Ball | Badge case, earned state, campaign identity | Reuse current assets |
| Routes, markers, locks, coin and navigation icons | Dynamic progress and accessible controls | SVG/CSS and existing icon library, not text baked into artwork |

Only scenic backgrounds require image generation. UI type, rewards, deck counts,
card faces, names and unlock state stay real and data driven. A common atlas
provides consistent geography; campaign specific color treatments distinguish
Rocket Takeover and League Reborn. Regional postcards crop their appropriate
landmark from that atlas. New images are saved with generation prompts and
converted to WebP for the site; originals remain in the concept folder.

## Implementation order

1. Create a scoped ivory, ink navy, teal and vermilion design system. Keep the
   existing rounded body type and use a warm editorial heading face.
2. Replace the all-city grid with an illustrated, selectable region map,
   next encounter panel, sequential trainer steps, badge case and deck dock.
   Preserve unknown opponents, locks, legal decks and all three campaigns.
3. Apply the system to campaign and starter selection, conversations, story
   shop, pack reveals and the collection constrained deck editor.
4. Style story battles as a readable tabletop in the same world, with active
   Pokémon directly across from each other. Keep engine actions, target
   selection, card inspection and Quick Play behavior intact.
5. Run progression tests, scoped lint and a production build. Exercise a fresh
   adventure, resumed progress, locked regions, invalid decks, shop purchase,
   pack reveals, editor constraints, dialogue and battle return on desktop and
   phone. Inspect every central visual state and reduced motion behavior.
6. Commit, push and deploy the clean branch, then verify the actual production
   host and preserve the final screenshots and asset manifest.

## Constraints

No save migration or reset. Coins remain the existing Story Mode currency,
separate from Card Opener simulated dollars. No new combat, reward, deck legality
or campaign unlock rules. The approved illustration supplies the look; region
names, trainers, rewards and collection counts come from current game data.
New styles are scoped to Story Mode so the landing page, Card Opener and ordinary
Quick Play keep their behavior. Support touch, keyboard, smaller screens and
reduced motion. Preserve unrelated changes in the original checkout.

## Delivered

The four environments are in `public/story-atlas/`, totaling about 1.38 MB.
`manifest.json` records dimensions, sizes and generation prompts. The illustrated
journey, campaign picker, starter selection, dialogue, shop, pack reveal, deck
editor and story battle theme are implemented. The map and regional postcards
reuse one atlas; all gyms currently share the painted Pewter interior. This keeps
the initial asset set cohesive without generating redundant per-town scenes.

Existing trainer portraits, badges, card scans and wrappers remain authentic
assets. Trainer portraits have a named placeholder if a remote image fails.
Selectable regions, trainer locks, route completion, rewards and deck readiness
are live controls. Story battles additionally support selecting a hand card and
then tapping or pressing Enter on its destination, through the existing drop
action and engine validation.

## Verification on October 29, 2026

- Engine checks passed; match checks 24 passed; story checks 19 passed; Card
  Opener checks 26 passed. Scoped ESLint and the production build passed.
- Browser checks covered fresh starters and introductions, all three campaigns,
  locked regions, hidden opponents, shop preview, purchase and five-card reveal,
  collection constraints, invalid 59-card decks, save and reload, keyboard setup,
  energy attachment, concession rewards and a forfeit without rewards.
- A completed campaign fixture rendered 8/8 badges, the trophy, cleared routes
  and replayable trainers. The fixture was confined to an isolated test profile.
- Visual checks covered 1600 by 950, 1366 by 768 and 390 by 844, with no horizontal
  page overflow. Phone battles scroll their own board and hand. Reduced motion
  and unavailable remote portrait fallbacks were checked.
- Ordinary Quick Play has no story theme or tap-selection hooks, and Card Opener
  keeps its separate shop, simulated dollar balance and settings.

Selected screenshots are in `docs/story-atlas/*.webp`. Full-size review PNGs and
generated source art remain under the local concept folder. Vite retains its
existing warning about the main JavaScript chunk exceeding 500 kB; code splitting
is outside this visual update.

## Release

Source branch: `feature/story-atlas-ui`, merged into `master` after verification.
Production: <https://playpokemoncards.pages.dev>, using Story Mode from the menu.
Pages project `playpokemoncards`, hosting account
`77965546ba0ef6c4f1741d7d8a04039e`, production branch `main`.

```sh
npm run build
CLOUDFLARE_ACCOUNT_ID=77965546ba0ef6c4f1741d7d8a04039e \
  /Users/sahil/dndsurvivor/node_modules/.bin/wrangler pages deploy dist \
  --project-name playpokemoncards --branch main
```

The existing GitHub workflow builds pushes to `master`. Direct upload is the
established publishing path until the deployment secret is configured.

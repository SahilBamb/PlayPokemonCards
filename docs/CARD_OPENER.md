# Card Opener

Entry point: the Card Opener button on the main menu, or `/card-opener`.

This is a standalone free simulation. It never imports or writes the Story Mode
profile, collection, coin wallet, or owned packs. Revealed cards are saved in
`sessionStorage` under `ppc-card-opener-session-v1`, so players can return from
the menu or refresh the tab and continue viewing them. Closing the tab ends the
session. Clear session has a confirmation dialog.

## Opening and viewing

Base Set is selected initially. Jungle, Fossil, Team Rocket, Gym Heroes, and Gym
Challenge are also available. A pack photograph tears across the top from left
to right, its top strip detaches, and the hidden cards emerge.

Row mode allows any card to be flipped independently. Clicking a revealed card
opens the existing full size card viewer with its foil effects. Stack mode
reveals one card at a time and keeps it visible until the player chooses Next
card or clicks it again. Inspect card opens the full size viewer without moving
to the next card. Switching modes retains all revealed cards.

Cards Opened is below the opening table, with set filtering, name and rarity
search, sorting, and individual card inspection. It includes every revealed
copy. The first 30 matching cards are shown, with Show more for larger sessions.
The existing animation and sound settings apply, and reduced motion preferences
skip the tear and deal animation without interrupting the reveal flow.

## Cards and simulated collation

The opener uses the original set data in `scripts/*_raw.json`, preserving holo
and ordinary printings that the battle card catalog combines. It contains 575
printings across the six sets, each identified by its original card ID.

Each simulated pack contains 11 cards. Base Set has 5 common cards, 3 uncommons,
2 basic Energy cards, and 1 rare. The Gym sets have 6 commons, 3 uncommons,
1 basic Energy, and 1 rare. The other sets have 7 commons, 3 uncommons, and
1 rare. The rare is placed last and has a simulated one in three chance of
using the holo pool. Cards are drawn without replacement inside each rarity
pool. These are approximate simulation odds, not certified physical collation.
The existing five card Story Mode packs are unchanged.

## Optional values and artwork

The Card values switch hides values everywhere, including individual cards,
pack totals, the session total, and the gallery. Values are TCGplayer market
estimates in USD from a cached TCGCSV snapshot. Unlimited and ordinary printings
are matched by set, card number, and foil type; first edition values are not
substituted. The source date is visible. Missing quotes say Price unavailable,
and partial totals are labeled Known value. Condition and edition affect actual
market value.

The initial snapshot has 574 quotes for 575 cards. No browser requests are made
to TCGCSV. The maintenance script follows its documented daily cache pattern:

```sh
python3 scripts/update_opener_data.py
```

The script checks the provider build timestamp, caches the raw responses in
`.cache/card-opener/`, and writes `src/data/openerCards.json` and
`src/data/openerPrices.json`. It also downloads original booster photographs
to `public/boosterpacks/`. The card art uses the same existing image host as the
game. No generated artwork is used.

The card back uses the image supplied by the user, a recreation of the classic
Pokémon TCG back by [Jasowke](https://www.deviantart.com/jasowke), titled
“Pokemon TCG Card Back 4k high res remake.” It is stored unchanged at
`public/card-opener/card-back.jpg` and shared by row cards, the top stack card,
and the cards underneath. Serving it locally avoids depending on a signed
external image URL.

Provider documentation: https://tcgcsv.com/docs

Reference rhythm: https://www.youtube.com/shorts/zYArzGD83WM

## Verification

```sh
npm run test:opener
npm run test:story
npm run test:ui:opener
npm run build
```

The UI check uses installed Chrome through Playwright. Run Vite on port 5199
first, or set `OPENER_URL` to a local or deployed URL. Screenshots are saved to
`.cache/card-opener-ui/`; `OPENER_SHOTS` can override the folder.

Coverage includes the tear progression, independent row flips, sequential stack
reveals, inspection, value visibility, set selection, session recovery, gallery
search and filtering, clear confirmation, touch controls, and proof that the
Story Mode profile is unchanged.

## Production release

Published October 26, 2026, from feature commit `8421eb0` to the existing
Cloudflare Pages project `playpokemoncards` in hosting account
`77965546ba0ef6c4f1741d7d8a04039e`, with production branch `main`.

Public feature: https://playpokemoncards.pages.dev/card-opener

Verified release: https://5c992380.playpokemoncards.pages.dev

The 14 opener checks, 19 Story Mode checks, scoped ESLint, production build, and
desktop/mobile browser flows passed. The browser flows also passed against the
production host. Both HTML routes, all six booster photographs, the application
JavaScript/CSS, and the existing sharing image matched the local build byte for
byte. GitHub Actions build run `40348846600` succeeded. The direct upload path
was used because the repository does not yet have a deployment API token secret.

To publish a future release after running the checks above:

```sh
npm run build
CLOUDFLARE_ACCOUNT_ID=77965546ba0ef6c4f1741d7d8a04039e npx wrangler@4.152.0 pages deploy dist --project-name playpokemoncards --branch main
```

Read the shared deployment context before publishing. No DNS changes are needed
for this existing `pages.dev` project.

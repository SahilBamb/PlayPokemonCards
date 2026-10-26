# Card Opener

Entry point: the Card Opener button on the main menu, or `/card-opener`.

This is a standalone free simulation. It never imports or writes the Story Mode
profile, collection, coin wallet, or owned packs. Revealed cards are saved in
`sessionStorage` under `ppc-card-opener-session-v1`, so players can return from
the menu or refresh the tab and continue viewing them. Closing the tab ends the
session. Clear session has a confirmation dialog.

## Opening and viewing

The entry screen is an illustrated card shop with an independent shopkeeper
layer, a featured pack carousel, and six working product listings. Base Set,
Jungle, Fossil, Team Rocket, Gym Heroes, and Gym Challenge are available. The
Booster Packs section shows only pack photographs in white borders with price
badges overlapping the lower left edge. Clicking a badge changes it to Confirm?,
and confirming buys the pack with simulated money. The purchase animates in the
shop before the pack appears on its own over the dimmed shop.

Row, Stack, and Card values preferences are on the shop screen. The opening
popup has just the pack, tear guide, and close control, with no settings toolbar
or surrounding panel border. Completing a pack returns players to the shop to
choose and confirm another one.

Drag a mouse or finger across the dotted guide from left to right. The glowing
tear follows the gesture, and releasing early retains the current progress.
The dotted guide, arrow animation, and prompt disappear as soon as a valid tear
starts. Once the tear reaches the far edge, its top strip detaches and all eleven
hidden cards visibly emerge from the wrapper before fanning into a row or
settling into a stack. The guide also accepts the right arrow key, Enter, or
Space. Pointer capture and touch action handling keep
the tear working when the pointer leaves the line, without scrolling the page.

The popup traps focus, makes the shop inert, and restores focus and scrolling
when closed. Escape or Back to card shop closes it. Card inspection remains
above the popup, and Escape dismisses inspection first. An unfinished opened
pack can be resumed and cannot be replaced by another product. Choosing another
pack after completion prepares a fresh sealed wrapper without clearing history.

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

## Simulated money and pack prices

New players receive $1,000 in simulated USD. The balance is stored separately
from Story Mode in `localStorage` under `ppc-card-opener-wallet-v1`; refreshing,
returning from the menu, opening another tab, and clearing the Cards Opened
gallery do not grant more starting money. Balances and charges use integer
cents, and purchases are allowed when they would make the balance negative or
when it is already negative. This is a free simulation with no real payments.

The first badge click does not spend anything. Confirmation reserves the sealed
pack and deducts the cached source price exactly once. Interrupted purchase
animations and page refreshes recover the sealed pack from the current tab's
session. Resuming or ripping it never charges again. Clearing the gallery keeps
an unopened paid pack and the wallet balance. Revealed card values are estimates
for viewing, not credits to the wallet or ownership in the game collection.

Pack prices use TCGplayer market quotes for the exact unlimited edition booster
products already used for the pack photographs, supplied by the same TCGCSV
snapshot as the card prices. Source date and USD units are visible. The price
refresh script also checks that all six selected packs have positive source
quotes and refuses to replace the snapshot if a quote is missing. The Card
values switch affects revealed card estimates, not purchase prices or money.

| Pack | TCGplayer product | Initial market estimate, October 25, 2026 |
| --- | --- | --- |
| Base Set, revised unlimited | 138130 | $916.46 |
| Jungle, unlimited | 138129 | $330.45 |
| Fossil, unlimited | 138134 | $340.31 |
| Team Rocket, unlimited | 138135 | $328.26 |
| Gym Heroes, unlimited | 138138 | $269.72 |
| Gym Challenge, unlimited | 138139 | $419.99 |

These are cached market estimates for vintage sealed packs, not the original
retail price, a certified weight, a first edition price, or a live seller offer.

## Artwork and source refresh

The initial snapshot has 574 quotes for 575 cards. No browser requests are made
to TCGCSV. The maintenance script follows its documented daily cache pattern:

```sh
python3 scripts/update_opener_data.py
```

The script checks the provider build timestamp, caches the raw responses in
`.cache/card-opener/`, and writes `src/data/openerCards.json` and
`src/data/openerPrices.json`. It also downloads original booster photographs
to `public/boosterpacks/`. The card art uses the same existing image host as the
game. The shop interior and transparent shopkeeper are generated illustrations;
their saved paths, provenance, and exact prompts are in
[CARD_SHOP_ARTWORK.md](CARD_SHOP_ARTWORK.md).

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

Coverage includes the image frames and overlapping badges, confirmation and
delivery animation, sourced prices, persistent balances, purchases below zero,
single charges, recovery of paid packs, shop preferences, minimal popup focus
and background isolation, mouse and touch tearing, disappearing guides, all
eleven cards emerging in both modes, keyboard opening, independent flips,
sequential stack reveals, inspection, gallery search/filtering/sorting, clear
confirmation, and proof that the Story Mode profile is unchanged.

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

## Shop redesign release

Published October 26, 2026, from source commit `87d875e` to the same account,
Pages project, production branch, and public feature URL above.

Verified release: https://df99f35e.playpokemoncards.pages.dev

All 15 opener checks, 19 Story Mode checks, scoped ESLint, and the production
build passed. The updated browser flow passed locally and against production,
including the storefront, focus trap, background isolation, mouse and touch
tearing, partial tear recovery, keyboard opening, both reveal modes, inspection,
gallery recovery, and profile isolation. Additional light theme checks passed
at widths of 360, 768, and 1280 pixels. Both routes, both generated illustrations,
the supplied card back, application JavaScript/CSS, and existing sharing image
matched the deployed build byte for byte. GitHub Actions build `40385810539`
succeeded. The temporary local test server was stopped after verification.

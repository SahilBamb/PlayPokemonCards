# Card Opener

Entry point: the Card Opener button on the main menu, or `/card-opener`.

The page is a shop illustration, its shopkeeper, and a single glass and wood
cabinet with six packs on two shelves. A compact top bar shows the balance,
View/Sell, and settings. The owner's requested hosted Art pledge badge is at
the upper left. The former sidebar cards, visit statistics, featured carousel,
welcome card, last pack button, How it works section, and inline card gallery
have been removed.

All six existing pack photographs remain in use. No generated pack replacement
was adopted. The shop interior and transparent shopkeeper remain the existing
generated artwork documented in [CARD_SHOP_ARTWORK.md](CARD_SHOP_ARTWORK.md).

## Buying and opening

Price badges overlap the packs' lower left edges. The entire pack is a single
button, including its image and badge. The first click changes the
badge to Confirm? without spending money. The second reserves the sealed pack,
deducts its cached market price once, and animates it to the opening popup.
An unfinished pack's badge changes to Continue, allowing the pack to be resumed
without another purchase. Completed packs are viewed through View/Sell.

Row, Stack, and Card values preferences live at the upper right of the cabinet
header. New sessions default to Stack; a saved Row preference is preserved.
The opening popup shows the pack, tear guide, and close control. Drag a mouse or finger from
left to right across the top. The dotted guide, direction animation, and prompt
disappear when a valid tear starts. An irregular cut with dark separation,
bright foil edges, and little fibers follows the gesture without
stretching the torn pattern. The loose strip and wrapper share the same ragged
edge. A partial tear can be resumed. The right arrow, Enter, and Space provide
keyboard controls. Pointer capture and touch action handling prevent accidental page
scrolling while tearing.

The top strip detaches and all eleven hidden cards visibly emerge from the
wrapper. They fan into a row or settle into a stack. Row cards flip independently.
Stack cards remain visible until the player chooses Next card or clicks again.
The stack reserves consistent slots for the rarity, a two line title, metadata,
Reveal/Next and Inspect controls, progress, value total, and completion actions.
The popup keeps the same size and position through all eleven reveals, including
the last card. Card size adapts to viewport height; short landscape screens place
card details beside the stack. New cards fade into the same position.
Inspection opens the full size card viewer above either popup. Both popups trap
focus, make the shop inert, and restore focus and scrolling when closed. Escape
closes inspection first, then the popup. Reduced motion and the existing animation
and sound preferences apply.

## Big hits

Holo and secret pulls, plus cards with a cached value of at least $50, receive an
exaggerated foil celebration: a gold outline, colored glow, radial burst,
rainbow foil, sweeping shine, twelve twinkling sparkles, and a Big Hit label.
The rare pull melody follows the sound setting. Reduced motion keeps a static
highlight and disables moving foil, rays, and sparkles. This changes presentation,
not draw odds or sale values.

## View/Sell

The View/Sell button opens the inventory in a popup rather than below the shop.
It includes every revealed copy, full size inspection, set and sale status
filters, name/rarity search, sorting, and pagination after the first 30 matches.
Sold artwork remains inspectable, with a Sold label and its credited value.

Each card displays its value over the artwork, styled like the stack price.
A Prices switch hides these overlays for viewing the artwork. This preference
is independent of the opening view, survives refreshes and reopening inventory,
and is retained when history is cleared. Sold cards display their credited value.

Clicking an available card or its Sell card button selects it without selling.
The button changes to Confirm with the exact value, and a second click on the
card or button completes the sale. Cancel, inspecting the card, selecting another
card, changing filters, and sorting clear the pending selection. Inspect remains
an explicit action even with prices hidden. Sold cards and cards without a quote
can still be inspected, but cannot be sold again.

Each copy has a stable pack/index key. A confirmed sale credits the cached quote, rounded
to integer cents, once. The entry records `soldForCents`; repeated actions and
reloads cannot credit the same copy again. Cards without a source quote cannot
be sold. Selling changes the simulated wallet only and never writes the Story
Mode profile.

Sell all sells eligible copies matching the current filters and search, including
matches past the first 30 displayed cards. Its label shows the count and exact
total. The first click asks for inline confirmation; the second performs the sale.
Sold copies and missing quotes are skipped. All, Available, and Sold filters
keep the sales view useful after a bulk sale.

Card values hides estimates during opening. Inventory has its own Prices switch;
confirmation always states the price before selling. Revealed card history is stored
in `sessionStorage` under `ppc-card-opener-session-v1`: it survives refreshes and
menu navigation, and ends when the browser tab closes. Clear history has a
confirmation dialog and preserves the wallet and any unopened paid pack.

## Simulated money

New players receive $10,000 in simulated USD. Money is separate from Story Mode
and stored in `localStorage` under `ppc-card-opener-wallet-v1`. Wallet payload
version 2 records the starting grant. Previous $1,000 wallets receive the $9,000
difference once, preserving prior spending and sale proceeds; reloads and new
tabs do not repeat the increase. Session snapshots also record the grant so
legacy snapshots recover correctly.

Balances, purchases, and sale credits use integer cents. Purchases are allowed
when they make the balance negative or when it is already negative. Revealing,
resuming, or ripping a pack never charges again. Clearing history does not grant
starting money, refund purchases, or reverse sales. This is a free simulation;
there are no real payments or ownership changes in the game collection.

## Cards, prices, and artwork

The opener preserves all 575 printings across Base Set, Jungle, Fossil, Team
Rocket, Gym Heroes, and Gym Challenge. The battle catalog combines some prints;
the separate five card Story Mode pack generator is unchanged.

Each simulated pack contains 11 cards. Base Set has 5 commons, 3 uncommons,
2 basic Energy cards, and 1 rare. The Gym sets have 6 commons, 3 uncommons,
1 basic Energy, and 1 rare. Other sets have 7 commons, 3 uncommons, and 1 rare.
The rare is last and has an approximate one in three chance of using the holo
pool. Draws are without replacement within each rarity pool. These are simulation
odds, not certified physical collation.

Pack and card values are cached TCGplayer market estimates in USD via TCGCSV,
with the source date visible. Pack quotes match the exact unlimited edition
products used for the photographs. Card quotes match set, number, and foil type;
first edition prices are not substituted. A missing quote is shown as unavailable.
The initial snapshot has 574 card quotes and all six pack quotes. Actual prices
vary with condition and edition; these are neither original retail prices nor
live seller offers.

Refresh source data with:

```sh
python3 scripts/update_opener_data.py
```

The script checks the provider timestamp, caches daily responses in
`.cache/card-opener/`, and writes `src/data/openerCards.json` and
`src/data/openerPrices.json`. It refuses to replace the snapshot if a pack quote
is missing or card price coverage is too low. The browser never fetches TCGCSV.
Original pack photos remain in `public/boosterpacks/`; card scans use the existing
host. The user supplied back remains at `public/card-opener/card-back.jpg`, a
recreation by [Jasowke](https://www.deviantart.com/jasowke).

Provider documentation: https://tcgcsv.com/docs

## Verification

```sh
npm run test:opener
npm run test:story
npm run test:ui:opener
npm run test:ui:opener-layout
npm run build
```

The browser check uses installed Chrome through Playwright. Start Vite on port
5199 or set `OPENER_URL` to a local or deployed URL. `OPENER_SHOTS` overrides
`.cache/card-opener-ui/` for screenshots. Coverage includes the cabinet and badge,
whole pack confirmation, header preferences, default Stack and saved Row,
starting grant migration, purchases below zero, paid pack recovery, mouse and
touch tearing, both reveal modes, big hit effects, View/Sell, individual and
confirmed bulk sales, duplicate sale prevention, sale recovery, filters,
inspection, clearing, keyboard controls, and Story Mode profile isolation.
The layout check compares card, details, controls, progress, and popup bounds
before and after every reveal and advance, including the final card, at five
viewports. It exercises long names, missing quotes, holos, animation and reduced
motion, hidden opening values, inventory price preference persistence, and sale
cancellation and inspection without changing the balance.

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

## Pack purchasing and balance release

Published October 26, 2026, from source commit `2fbbe96` to the same Cloudflare
account, Pages project, production branch, and public feature URL above.

Verified release: https://76a53120.playpokemoncards.pages.dev

All 18 opener checks, 19 Story Mode checks, scoped ESLint, and the production
build passed. The revised browser flow passed locally and against production,
covering overlapping price badges, confirmation before spending, delivery
animation, sealed pack recovery after refresh, a persistent $1,000 starting
balance, further purchases below zero, single charges, shop preferences, the
minimal opening view, disappearing tear prompts, eleven card emergence in both
modes, gallery controls, keyboard and touch, and Story Mode profile isolation.
Additional light theme layouts passed at widths of 360, 768, and 1440 pixels.
Both routes, both illustrations, the supplied back, the sharing image, and the
application JavaScript/CSS matched the deployed build byte for byte. GitHub
Actions build `40392499556` succeeded. The temporary local test server was
stopped after verification.

## Cabinet, sales, and big hits release

Published October 26, 2026, from source commit `b7a3610` to the same Cloudflare
account, Pages project, production branch, and public feature URL above.

Verified release: https://9d975fd1.playpokemoncards.pages.dev

All 21 opener checks, 19 Story Mode checks, scoped ESLint, and the production
build passed. The revised browser flow passed locally and against production,
including the cabinet layout, original pack images, hosted badge, $10,000 grant,
one time legacy wallet increase, purchases below zero, both reveal modes,
View/Sell inspection and filters, individual and confirmed bulk sales, duplicate
sale prevention, sale recovery after reload, mouse/touch/keyboard controls, and
Story Mode profile isolation. A separate stack check verified the rare glow,
twelve sparkles, foil layers, and reduced motion behavior. Both page routes,
all six original pack photos, shop illustrations, supplied back, sharing image,
and application JavaScript/CSS matched the deployed build byte for byte. GitHub
Actions build `40400613195` succeeded. The temporary local test server was stopped
after verification.

## Pack interaction and ragged foil release

Published October 27, 2026, from source commit `e516e6d` to the same Cloudflare
account, Pages project, production branch, and public feature URL above.

Verified release: https://528faf43.playpokemoncards.pages.dev

The entire pack now accepts the first selection and second confirmation click,
including its image and overlapping price badge. It is one keyboard accessible
button, preserving single charging and unfinished pack recovery. Row, Stack, and
Card values now sit at the cabinet's upper right. New sessions use Stack;
explicit saved Row preferences remain intact. The dragged tear exposes an
irregular dark cut with silver foil edges and fibers. The cut, detached strip,
and opened wrapper use the same seam, revealed progressively without stretching.

All 22 opener checks, 19 Story Mode checks, scoped ESLint, and the production
build passed. The browser flow passed locally and against production, including
whole image confirmation, no charge on the first click, exactly one charge on
confirmation, default Stack and saved Row, header placement, resumable jagged
tearing, mouse and touch opening, both reveal modes, card sales, wallet recovery,
and Story Mode isolation. Desktop and mobile screenshots were inspected. Both
page routes, all six pack photographs, shop illustrations, supplied card back,
sharing image, and application JavaScript/CSS matched local build bytes over
production HTTPS. GitHub Actions build `40523349714` succeeded. The temporary
local test server was stopped after verification.

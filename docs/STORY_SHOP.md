# Story shop and copy refresh

The story Poké Mart now follows the Card Opener's cabinet layout: wood framed
shelves, pack scans with a white edge, coin price badges, an illustrated shop and
a compact Row/Stack preference. Each campaign retains its original shopkeeper
portrait and greeting. Limited stock notices appear separately from the greeting.
Existing shop art and pack scans are reused; the one-card promo has a native SVG
sleeve built from the existing Poké Ball motif.

## Purchase and opening

1. Click a pack to request confirmation. Click it again to spend the existing
   story coin price. Affordability remains enforced.
2. The purchased pack is added to unopened inventory and shown in a popup.
   Closing the popup before tearing leaves it available through Open owned,
   including after a reload.
3. Drag across the foil seam, use the right arrow, or press Enter to open. The
   jagged tear component is shared with Card Opener. Cards emerge from the wrapper
   before revealing in the selected mode. Stack is the default.
4. Cards and refunds are saved when the seal opens. Closing partway through the
   reveal cannot lose cards or consume another pack. Existing five-card booster,
   single-card promo, four-copy cap and duplicate coin refund rules remain intact.
5. Click each card to reveal and advance. The last pull stays large before the
   summary. Revealed cards can be inspected, with holo shine and sparkles for
   shiny rarities. Extra copies show their actual coin refund on the card.

Story coins and the Card Opener's simulated dollars remain separate. This update
does not add selling or change pack probabilities, prices, rewards or deck rules.
Reveal preference is stored under `ppc-story-reveal-mode`.

## Copy convention

Player-facing prose uses ordinary sentences, commas, colons and parentheses.
Avoid repeated hyphens and long dash punctuation in dialogue, labels, tooltips,
descriptions and game logs. A source AST audit found and cleaned 124 text
fragments, and the decorative turn log separators were replaced with plain turn
headings. Commands, CSS custom properties, URL signatures, numeric operators,
Markdown syntax and archived source card text retain their required syntax.

## Verification

- Engine checks: 107 passed. Match checks: 24 passed. Story checks: 19 passed.
  Card Opener checks: 26 passed. Production build and scoped UI ESLint passed.
- Browser checks: all three hosts and greetings, two-click confirmation,
  affordability, unopened inventory across reload, mouse and native touch tear,
  keyboard tear, row and stack reveals, stable card bounds, preview layering,
  closing mid-reveal, one-card promos, four-copy caps and exact coin refunds.
- A capped collection fixture returned 100 coins for a duplicate promo. A booster
  returned 75 coins, matching its per-card badges of 5, 5, 5, 10 and 50. Fixtures
  were confined to an isolated browser profile.
- Visual checks covered 1600 by 950, 1366 by 768 and 390 by 844. Cabinet overflow
  scrolls internally on desktop; phones use a vertical shop. Popup size and card
  placement remain stable during a stack opening. Full motion and reduced motion
  paths were exercised.
- The public Card Opener regression retained its own dollar balance, purchase
  flow and shared tear interaction. Player-facing source strings and JSX have no
  long dashes or repeated hyphen prose after the final audit.

Selected screenshots are stored in `docs/story-atlas/`. The repository still has
pre-existing engine lint findings for unused imports and hook-name false positives;
the engine test suite passes. Vite also retains its existing large chunk warning.

Branch: `feature/story-shop-and-copy`. Deployment uses the existing Pages project
`playpokemoncards`, production branch `main`, hosting account
`77965546ba0ef6c4f1741d7d8a04039e`. See `STORY_ATLAS.md` for the publish command.

# Sharing previews

The production page supplies Open Graph metadata for Facebook and Messages,
plus a large image Twitter Card for X. These tags are in the initial HTML so
preview crawlers can read them without running the React app.

Title: Play Pokémon Cards

Description: Play 530 classic Pokémon cards in your browser. Battle AI opponents,
explore three story campaigns, and build your own decks. No download needed.

The sharing copy contains no hyphens or dash punctuation. The image is an RGB
JPEG measuring 1200 by 630 pixels, published at
https://playpokemoncards.pages.dev/share/classiccards.jpg.

The image uses existing classic card artwork from the same Pokémon TCG image
host as the game. Its editable layout is `scripts/sharecard.html`; the original
three card images are retained in `scripts/shareassets/`.

Regenerate the image with:

```sh
node scripts/render_sharecard.mjs
npm run build
```

The renderer uses the existing Playwright dependency and installed Chrome.
It checks the visible image copy for dash punctuation before exporting.

This release preserves the currently deployed JavaScript and CSS because the
checkout contains unrelated staged and unstaged interface work. The metadata
and image are the only production changes. Those interface changes are excluded
from the sharing commit and retain their original staging state.

Verification checks the built HTML, image dimensions, and the live responses
using browser, Facebook, X, and Apple crawler user agents. Platform display and
cache refresh are controlled by each service; no social posts or messages are
sent as part of this check.

References:

https://ogp.me/

https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages

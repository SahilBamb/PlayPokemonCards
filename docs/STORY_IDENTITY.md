# Story identity, atmosphere and navigation

Story Mode has its own public entry at `/story-mode`. The home menu pushes this
URL into browser history, and the app resolves it on direct entry, reload, Back
and Forward. Returning to the main menu writes `/` consistently. In the normal
in-app flow, Back from Story Mode returns home instead of skipping to an earlier
Card Opener visit. Campaign views, shops, decks and transient battles stay within
this Story Mode entry; the existing saves remain in local storage.

The three story covers retain their individual landscape maps and add recognizable
artifacts from existing project artwork:

| Story | Identity |
| --- | --- |
| The Indigo Journey | Blue, a Poké Ball and classic Pikachu/Charizard cards |
| Rocket Takeover | Prominent red R, Rocket characters and a warning stripe |
| League Reborn | Misty, Brock, trophy and Gym badge ribbon |

The eleven cover artifacts are local WebP files under
`public/story-atlas/campaigns/`, totaling about 214 KB. These reuse existing card,
trainer and badge art, resized and compressed with transparency preserved. The
asset manifest records source references, dimensions and byte sizes. The complete
cover art remains available when remote image hosts fail.

The existing two-layer DriftBackground now runs behind both story selection and
the campaign hub. Selection uses a neutral night sky; hubs use their campaign's
badge or Rocket motif and a matching accent. Dark translucent panels replace the
beige page chrome. The illustrated map retains its colors, and conversations,
starter dialogs and the shop retain their established readable surfaces. The
animation setting pauses the drift, and system reduced motion disables it.

Verification on October 29, 2026:

- Navigation regression passed for Home, Card Opener, Home, Story Mode, Back,
  Forward, reload, direct entry, trailing slash and both main menu controls.
  The reusable scenario is `scripts/ui_story_navigation.mjs`.
- Visual inspection covered all three covers, the dark hub, light conversation
  popup and deck dock at 1600 by 950, 1366 by 768 and 390 by 844. Primary selection
  actions fit the laptop viewport. No horizontal overflow or lost deck controls.
- Starter selection, saved 60-card deck, shop and encounter controls passed.
  The neutral backdrop returns when leaving a campaign for selection.
- Settings pause and OS reduced motion passed. Blocking external image hosts
  left all 15 cover images available. No browser page errors occurred.
- Nineteen story tests, scoped ESLint and the production build passed. Vite's
  existing large chunk warning remains.

Source branch: `feature/story-identity-and-navigation`. Deployment remains the
`playpokemoncards` Cloudflare Pages project, account
`77965546ba0ef6c4f1741d7d8a04039e`, production branch `main`. See `STORY_ATLAS.md`
for the established deployment command.

Published October 29, 2026: source `c86ddac`, deployment `ef86d0c6`
(<https://ef86d0c6.playpokemoncards.pages.dev>). The public `/story-mode` URL
served the current app, and its HTML, JS, CSS, asset manifest and all 18 atlas
assets matched the tested build. The complete navigation regression passed on
the production host, including the earlier Card Opener history sequence. All 15
cover images loaded locally and the three distinct covers were inspected at
1366 by 768 without browser errors. GitHub build
[40912490218](https://github.com/SahilBamb/PlayPokemonCards/actions/runs/40912490218)
passed for this source.

## Home page typography

October 29, 2026: Story Mode now inherits the home page's M PLUS Rounded 1c
font stack throughout. Headings use the same 900 weight and tight tracking
as the home title. The brand, deck selector, mystery placeholder and battle
location no longer introduce Georgia. Body text and controls share the global
fallbacks. The decorative Rocket R keeps its existing logo treatment.

The production build, CSS formatting and diff checks passed. Browser inspection
confirmed matching computed font stacks on Home and Story Mode and the actual
Rounded Mplus 1c Black web font rendering the Kanto heading. Visual checks at
1600 by 950, 1366 by 768 and 390 by 844 covered campaign selection, starter and
dialogue popups, hub/deck dock and shop. Starter selection, introduction,
encounter cancellation and shop return passed using normal controls. The phone's
Cinnabar Trainee deck name fits, all deck controls remain reachable, and no
horizontal overflow or browser page errors were found. Review images are
`story-atlas/46-story-home-font-laptop.webp`,
`story-atlas/48-story-home-font-dialogue.webp`,
`story-atlas/49-story-home-font-hub.webp` and
`story-atlas/53-story-home-font-mobile-deck.webp`.

Published source `b86e7b5` as Cloudflare Pages deployment `3b038c66`.
Production `/story-mode`, HTML, JS and CSS match the tested build. The public
Home to Story Mode flow confirmed matching font families, 900-weight headings,
no horizontal overflow at 1366 by 768 and no browser page errors.

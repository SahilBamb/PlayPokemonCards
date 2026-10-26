# Pocket Grove QA inventory

Functional and visual checks cover the same states. Screenshots are under
`docs/pixel-grove/screenshots/`. Rules are tested independently with
`npm run test:pixel-grove`.

| Requirement / control | Functional check | Visual state |
| --- | --- | --- |
| Reference-inspired forest board | All image assets load | Initial desktop and mobile board |
| Six requested species only | Card definitions and collection | Six-card album |
| Pikachu sleeping / awake | Heads wakes, tails does not; Sing restores sleep | Both sprite poses |
| Lightning tokens | Attach from hand; only once per turn | Attached tokens and target highlight |
| Voltorb to Electrode | Evolution carries Energy and damage | Evolution effect and new sprite |
| Basic Pokémon | Empty bench target accepts Voltorb | Filled bench patch |
| Potion | Heal only damaged friendly Pokémon | HP and healing notice |
| Attacks | Cost check, damage, end turn | Attack motion, HP loss, opponent turn |
| Opponent | Automatic response; Koffing evolves | Opponent sprites and battle notes |
| Retreat | Pays Energy and switches active/bench | Selected bench and active after switch |
| Prizes and ending | KO promotion and last-prize victory | Prize token and result panel |
| Restart | Confirm fresh battle | Initial hand and sleeping Pikachu restored |
| Album / reference / guide | Open, close, Escape, backdrop | Dialog fit and readable cards |
| Sound | On, off | Toggle label |
| Classic game | `/classic` loads existing menu | Existing game menu |
| Appearance | Light/Dark/Transparent, saved across reload and classic mode | Three desktop appearances and mobile transparent panel |
| Responsive controls | Touch hand, target, details and end turn | 390px mobile and 1440px desktop |
| Keyboard | Escape cancels, Space ends turn | Selection cleared / turn changes |

Off-happy-path exploration: repeat Energy attachment, evolve the wrong Pokémon,
play onto an occupied bench, attack while asleep, retreat while asleep,
switch selection while waiting for the AI, and open dialogs on small screens.

Viewport checks include board/controls bounds, horizontal overflow, readable
labels, overlapping sprites, sprite transparency, and mobile overlays blocking
targets. Intentional scrolling is supported on small screens.

Verified: 14 reducer tests pass. The desktop/mobile browser flow passes,
including every interaction listed above except a whole match victory through
browser clicks (victory/prize completion is covered by reducer tests). Both
Pikachu poses, all six cards, desktop collection fit, and all three appearances
were visually inspected. Browser checks found no missing game assets, runtime
errors, or horizontal overflow. Desktop board and controls fit without scrolling.
The mobile details sheet leaves card targeting accessible when dismissed.

The same browser flow passed against the Cloudflare branch preview at
`https://pixel-grove.playpokemoncards.pages.dev/`, deployment `e37935cc`, source
`8f1637e`. All five main PNG assets matched local SHA-256 hashes. Classic board
appearance checks also passed (dark, light, transparent alpha 0.2). Third-party
analytics scripts are stubbed during UI checks so tests do not send telemetry.

# Production deployment

## Front-page creator links · November 5, 2026

Published https://d9e73ca4.playpokemoncards.pages.dev from source `cc0073b6c7f31af58d6686bfb214f82d03d85ff5`. The front page adds small links labeled “Made by Solo Developer!” to `https://www.sahilbambulkar.com/` and “Other Games” to `https://www.dndlair.com/`, using the game’s existing typography and palette. Desktop, phone, keyboard focus, new-tab navigation, and short landscape layouts were checked. Deployed HTML/style or compiled assets match the verified local build byte for byte. Only the creator credits and their styling change the player-facing page.

Production source is on `codex/solo-developer-credit`, based on the exact deployed `b86e7b5` frontend. The separate `master` and unfinished archive branches are retained. Publish with `npm ci`, `npm run build`, then the pinned Wrangler from `~/dndlair/node_modules/.bin/wrangler pages deploy dist --project-name playpokemoncards --branch main`, selecting Cloudflare account `77965546ba0ef6c4f1741d7d8a04039e`.

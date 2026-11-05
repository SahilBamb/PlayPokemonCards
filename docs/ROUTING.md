# Routing and measurement audit

November 5, 2026.

`public/404.html` disables Pages’ implicit SPA fallback. `scripts/prepare-pages.mjs` emits explicit entries for `/card-opener/` and `/story-mode/`, the only pathname routes in `src/App.jsx`. Pages canonicalizes their non-slash forms to these entries; it must not redirect them to `/`. Update this list when adding a real client route. The alternative Node host in `scripts/serve-dist.mjs` uses the same explicit allowlist, returns 404 for missing files/routes, and handles HEAD without streaming a body.

Error pages are small standalone documents with inline CSS, no application startup and no analytics. Missing scripts/images/videos must never receive successful homepage HTML. Keep these properties when changing routes or hosting.

Validation uses actual Pages dev, Caddy or Wrangler Workers, plus public production checks. The cross-project harness is `~/dndlair/scripts/check-project-routing.mjs`: run `node scripts/check-project-routing.mjs playpokemoncards <base-url>` from that repository. It checks GET/HEAD, real routes, scanner/random/nested/encoded paths, missing assets/API paths, MIME types and applicable range/API behavior. Browser checks block analytics ingestion. The release record is in `docs/DEPLOYMENT.md`; the full cross-project findings are in DnD Lair `docs/ROUTING_AUDIT.md`.

This fixes future handling; it does not alter historical counts or exclude bots from real URLs. HTTP requests, JavaScript pageviews, sessions and visitor identities are different measures.

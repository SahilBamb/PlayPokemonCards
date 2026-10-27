# Influencer pack opening Short

The first proof of concept combines three Grok Imagine reaction clips of one
original fictional adult streamer with a real browser recording of Card Opener.
It is a 30 second, 1080 by 1920, 30 fps H.264 MP4 with stereo AAC, burned captions,
quiet original sound effects, and an explicit AI streamer / seeded demo label.
The website footage retains the actual card images, values, foil effects, tear
interaction, and card transitions. Nothing is posted to a social network.

The local production folder is:
`/Users/sahil/Movies/playpokemoncards-influencer-demo-2026-10-27/`.
The final video is `output/playpokemoncards-charizard-short.mp4`.
Prompts, original Grok clips, the reference image, transcripts, recorded UI,
editing plan, caption sidecar, and a cover image are retained there.

## Reproduce the pack

Open `/card-opener?seed=CHARIZARD-STREAM-1715`, choose Base Set, and open the pack.
The seed intentionally repeats the same pack for that set, independent of earlier
session pack counts. It preserves ordinary purchasing, the wallet, and inventory.
Without a `seed` query, openings keep the original randomness and collation.

The sequence is Vulpix, Pikachu, Pidgey, Charmander, Tangela, Dewgong, Dratini,
Machoke, Water Energy, Psychic Energy, then Rare Holo Charizard. The source price
snapshot shows Charizard at $954.65; future price refreshes can change estimates.
The recording manifest pins all eleven card identifiers and rejects a mismatch.
The pure `rollSeededOpenerPack` helper also accepts a pack sequence argument for
other recording tools. The URL uses its first pack consistently.

Recipe: [charizard-demo](shorts/charizard-demo/pack-manifest.json).
Timing and captions: [edit-plan.json](shorts/charizard-demo/edit-plan.json).
Exact prompts and generation URLs are kept alongside them. The first middle
prompt was rejected by Grok; `02b-build.txt` is the successful facial reaction
version. No generated card images or simulated website footage are used.

## Repeat the recording and edit

Use an isolated browser context. The recorder does this automatically and checks
all eleven drawn IDs against the manifest. It uses original high resolution scans
from a local cache, filling missing cache entries from their public image URLs.
It records actual purchase confirmation, mouse tearing, emergence, and card clicks.
A tiny sync marker outside the final crop calibrates video time to the browser;
wall clock startup estimates are unreliable. All card reveal timings come from
the edit plan. The tear/emergence montage is sped up to fit the spoken intro.

Requirements: installed Chrome, Node dependencies, FFmpeg/FFprobe, Python with
Pillow and NumPy. On this Mac the render uses the existing Arial fonts. Install
Playwright's recording encoder once with `npx playwright install ffmpeg`.

```sh
npm run dev -- --host 127.0.0.1 --port 5201
# In another shell, set RUN_DIR to your prepared production folder:
node scripts/record_opener_short.mjs "$RUN_DIR"
python scripts/render_opener_short.py "$RUN_DIR"
```

The folder needs `pack-manifest.json`, `edit-plan.json`, and the three reaction
clips under `sources/`: `01-opening.mp4`, `02-build.mp4`, `03-charizard.mp4`.
Copy the two JSON recipes from `docs/shorts/charizard-demo/` to start a new folder.
The recorder creates the screenshot directories. `OPENER_URL` selects another
local or deployed site. Generated clips are created through the
[grok-imagine skill](/Users/sahil/.codex/skills/grok-imagine/SKILL.md), using the
same portrait reference for continuity, then downloaded normally through Chrome.
The scripts never access Grok's private endpoints or browser profile files.

Before delivery, inspect the final frame at each spoken reveal, verify both
energy cards are visible, and check the climax against the Charizard dialogue.
FFprobe should report 1080 by 1920, 30 fps, 30 seconds, and stereo AAC. Speech
transcription checks wording and timing, but does not establish vocal naturalness
or perfect lip sync. Original source audio is retained for review.

## Verified delivery

The first video was exported and inspected on October 27, 2026. The actual frame
start was calibrated at 0.88 seconds using the off-crop sync marker. A separate
contact sheet verifies every final card reveal, including Water and Psychic
Energy, and named dialogue frames were checked against Vulpix, Pikachu, and the
Charizard climax. The final file is exactly 30 seconds with H.264 1080 by 1920
video at 30 fps and 48 kHz stereo AAC. Peak audio level is below clipping.
Source speech was transcribed locally; no claim of manual audio audition is made.

The seeded opening feature and reusable pipeline are committed as `37c04c3`,
retained on `experiment/influencer-pack-shorts`, and merged into `master`.
Production release: https://b39dbdcc.playpokemoncards.pages.dev
Replay: https://playpokemoncards.pages.dev/card-opener?seed=CHARIZARD-STREAM-1715
Choose the Base Set pack. All 24 opener checks, scoped ESLint, and the production
build passed. A browser check verified seeded draws after existing session packs,
repeat seeded openings in production, and unchanged ordinary random draws.
Production HTML, JavaScript, and CSS matched the local build. GitHub Actions run
`40596193072` succeeded. The temporary recording server on port 5201 was stopped.

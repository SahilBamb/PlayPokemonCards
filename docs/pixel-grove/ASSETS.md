# Asset provenance and rebuild

The source reference was supplied by the user:
https://i.pinimg.com/736x/3d/38/13/3d38133e3ee77a1579819684b69b71ac.jpg

The built-in image-generation tool produced the forest board, card-object atlas,
and transparent Energy token atlas. Exact prompts are in
[ASSET-PROMPTS.md](ASSET-PROMPTS.md). The original generated files are preserved
in the project assets directory.

The character outputs were rejected by the image service. The user explicitly
approved reference cutouts plus existing pixel sprites for the missing views.

`scripts/build_pixel_grove_assets.py` produces the final atlases and individual
files using Pillow:

- Reference cutouts: sleeping Pikachu with its log; Voltorb and Electrode back
  views; Koffing, Weezing, and Jigglypuff front views; the log for the awake pose.
- Existing game sprites: awake Pikachu back view and Pikachu, Voltorb, Electrode
  front views from [PokeAPI/sprites](https://github.com/PokeAPI/sprites).
  Original downloaded files and the repository license are retained in `sources/`.
- Card illustrations: the generated forest composited with those character
  assets, preserving crisp nearest-neighbor scaling. Full card faces are HTML
  with six reference PNG exports under `card-references/`.

The sprite atlas is a 4 × 2 grid of 256px cells, in this order:
Voltorb back, Electrode back, awake Pikachu back, sleeping Pikachu/log;
Koffing front, Weezing front, Jigglypuff front, empty log.
The card-art atlas is 3 × 2: Pikachu, Voltorb, Electrode; Koffing, Weezing,
Jigglypuff. Individual transparent sprites and square illustrations are also
saved in `public/pixel-grove/assets/sprites/` and `card-art/`.

Rebuild with Python and Pillow (validated with Pillow 13.0.0):

```sh
python3 -m venv /tmp/pixel-grove-assets-venv
/tmp/pixel-grove-assets-venv/bin/pip install Pillow==13.0.0
/tmp/pixel-grove-assets-venv/bin/python scripts/build_pixel_grove_assets.py
```

All runtime art is local. No sprite host or image-generation service is needed
when playing the demo.

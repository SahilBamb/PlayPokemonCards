# Card shop artwork

Created with the built-in image generation tool on October 26, 2026, at the
user's request. The supplied shop screenshot was the visual reference. These
are separate artwork layers; navigation, product listings, pack photographs,
modal controls, and card reveals are real interface elements.

The generated PNG originals remain in the local Codex generated image library.
The project consumes WebP encodings made at quality 91 without changing the
composition or dimensions. The shopkeeper retains its alpha channel.

| Asset | Saved project path | Dimensions |
| --- | --- | --- |
| Shop interior | `public/card-opener/shop/interior.webp` | 1672 × 941 |
| Shopkeeper | `public/card-opener/shop/shopkeeper.webp` | 1024 × 1536, transparent |

The existing pack photographs, card scans, and user supplied card back are
unchanged. The menu's previous no AI art pledge badge was removed because this
release uses generated shop illustrations.

## Interior prompt

```text
Use case: stylized-concept. Asset type: landscape background illustration for a playable trading card shop. Draw a cozy collectible card shop INTERIOR ONLY, no people. Wide landscape composition approximately 16:9. Eye level customer viewpoint across a polished wooden counter occupying the bottom 18 percent. Behind it, colorful shelves of trading card booster packets and binders, framed collectible cards, a small cute yellow plush toy on the left shelf, blue daylight through storefront windows, warm golden ceiling lights. Central area immediately behind the counter is uncluttered so a separate shopkeeper can be composited there. Cheerful polished anime background painting, clean cel shaded details, warm wood and cool blue palette, subtle depth of field, richly detailed premium game background. The foreground counter has a few display binders and sleeved cards only at the far left and far right edges, center of counter clear. Full environment edge to edge. All packaging has abstract colors with no legible lettering. NO people, NO user interface, NO panels, NO typography, NO buttons, NO prices, NO watermarks.
```

## Shopkeeper prompt

The supplied screenshot was passed as a reference image and transparent output
was requested.

```text
Use case: stylized-concept. Asset type: a single isolated shopkeeper character illustration for an interactive Pokémon trading card shop website. Input image is ONLY a style, outfit, pose, and character reference. Reimagine the friendly adult woman shopkeeper from this reference as a standalone character, make sure to keep the same polished high quality anime aesthetic and style of the original image. An adult woman about 25 years old, warm cheerful welcoming smile, bright blue eyes, long pale blonde hair, red and white Poké Ball themed cap with red ribbon, modest white collared short sleeve shirt with red trim, black shop apron with small Poké Ball emblem and a name badge with no readable text, red waist tie. Front facing relaxed pose behind a counter, hands resting naturally near her waist. Frame from cap down to mid thigh, complete hat, hair, arms and apron within frame, no cropping of hair or hands. Crisp clean linework with beautiful soft cel shading and warm shop lighting. Transparent background with NO room, NO counter, NO other objects, NO interface panels, NO text, NO watermark. Keep the character proportions natural and nonsexual, faithful to the reference.
```

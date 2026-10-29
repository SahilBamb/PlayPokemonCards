// Existing pack scans are shared with Quick Play's collection and the Card Opener.
export const storyPackArt = (pack) =>
  pack.setId === "promo"
    ? "/story-atlas/promo-pack.svg"
    : `/boosterpacks/${pack.setId}.jpg`;

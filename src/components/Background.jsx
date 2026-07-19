// Animated app backdrop: slanted columns of small pokéballs drifting left,
// dark and faded so the game window reads as the foreground.
export function PokeballBackground() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[#101014]">
      <div
        className="absolute -inset-[60%] -rotate-12 opacity-[0.055] animate-[ballScroll_48s_linear_infinite]"
        style={{ backgroundImage: 'url(/pokeball.svg)', backgroundSize: '56px 56px' }}
      />
      <div
        className="absolute -inset-[60%] -rotate-12 opacity-[0.035] animate-[ballScroll_110s_linear_infinite]"
        style={{ backgroundImage: 'url(/pokeball.svg)', backgroundSize: '96px 96px', backgroundPositionY: '48px' }}
      />
      {/* vignette so the edges fall away */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.6)_100%)]" />
    </div>
  )
}

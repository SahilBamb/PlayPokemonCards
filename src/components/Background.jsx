// Animated app backdrop: slanted columns of a tile image drifting left,
// dark and faded so the game window reads as the foreground.
export function DriftBackground({ src = '/pokeball.svg', base = '#101014', wash = null, strong = false, className = '', paused = false }) {
  return (
    <div aria-hidden className={`drift-background fixed inset-0 -z-10 overflow-hidden ${className}`} style={{ backgroundColor: base }}>
      <div
        className={`drift-layer absolute -inset-[60%] -rotate-12 animate-[ballScroll_48s_linear_infinite] ${strong ? 'opacity-[0.08]' : 'opacity-[0.055]'}`}
        style={{ backgroundImage: `url(${src})`, backgroundSize: '56px 56px', animationPlayState: paused ? 'paused' : 'running' }}
      />
      <div
        className={`drift-layer absolute -inset-[60%] -rotate-12 animate-[ballScroll_110s_linear_infinite] ${strong ? 'opacity-[0.05]' : 'opacity-[0.035]'}`}
        style={{ backgroundImage: `url(${src})`, backgroundSize: '96px 96px', backgroundPositionY: '48px', animationPlayState: paused ? 'paused' : 'running' }}
      />
      {wash && <div className="absolute inset-0" style={{ backgroundColor: wash }} />}
      {/* vignette so the edges fall away */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.6)_100%)]" />
    </div>
  )
}

export function PokeballBackground() {
  return <DriftBackground src="/pokeball.svg" />
}

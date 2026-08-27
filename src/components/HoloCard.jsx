import { useRef, useState } from 'react'
import './holo.css'

// rarity -> foil pattern (see holo.css); anything else renders flat
const FOIL_FOR_RARITY = {
  'Rare Holo': 'holo',
  Promo: 'promo',
}

// Tilt-and-shine card for the full-screen preview. Pointer position drives
// CSS variables; holo.css turns them into rotation, glare, and (for foil
// rarities) a holographic pattern. One card at a time, so the GPU-heavy
// blend modes stay cheap.
export function HoloCard({ card, children, className = '' }) {
  const ref = useRef(null)
  const [interacting, setInteracting] = useState(false)
  const foil = FOIL_FOR_RARITY[card.rarity]

  const onPointerMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
    const py = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1)
    const fromCenter = Math.min(Math.hypot(px - 0.5, py - 0.5) / 0.5, 1)
    el.style.setProperty('--pointer-x', `${px * 100}%`)
    el.style.setProperty('--pointer-y', `${py * 100}%`)
    el.style.setProperty('--pointer-from-left', `${px}`)
    el.style.setProperty('--pointer-from-top', `${py}`)
    el.style.setProperty('--pointer-from-center', `${fromCenter}`)
    el.style.setProperty('--rotate-x', `${(px - 0.5) * -22}deg`)
    el.style.setProperty('--rotate-y', `${(py - 0.5) * 18}deg`)
    el.style.setProperty('--background-x', `${37 + px * 26}%`)
    el.style.setProperty('--background-y', `${33 + py * 34}%`)
    el.style.setProperty('--card-opacity', '1')
  }

  const onPointerLeave = () => {
    const el = ref.current
    if (!el) return
    setInteracting(false)
    el.style.setProperty('--pointer-x', '50%')
    el.style.setProperty('--pointer-y', '50%')
    el.style.setProperty('--pointer-from-left', '0.5')
    el.style.setProperty('--pointer-from-top', '0.5')
    el.style.setProperty('--pointer-from-center', '0')
    el.style.setProperty('--rotate-x', '0deg')
    el.style.setProperty('--rotate-y', '0deg')
    el.style.setProperty('--background-x', '50%')
    el.style.setProperty('--background-y', '50%')
    el.style.setProperty('--card-opacity', '0')
  }

  return (
    <div
      ref={ref}
      data-foil={foil}
      className={`holo-card ${interacting ? 'interacting' : ''} ${className}`}
      onPointerMove={onPointerMove}
      onPointerEnter={() => setInteracting(true)}
      onPointerLeave={onPointerLeave}
    >
      <div className="holo-card__rotator">
        {children}
        {foil && <div className="holo-card__shine" />}
        <div className="holo-card__glare" />
      </div>
    </div>
  )
}

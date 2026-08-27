import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useGame } from './GameContext.jsx'
import { useSettings } from './Settings.jsx'
import { playSfx } from '../lib/sfx.js'

// The fx entry currently being played (or null). BoardCards read this to
// animate themselves when they are the source/target of the effect.
const FxContext = createContext(null)
export const useFx = () => useContext(FxContext)

// Per-coin timing for the flip overlay.
const COIN_SPIN_MS = 750
const COIN_MS = 950 // spin + land per coin
const COINS_HOLD_MS = 650 // pause on the final result

const DURATIONS = {
  attack: 480,
  hit: 500,
  status: 900,
  'poison-tick': 900,
  heal: 750,
  ko: 900,
}

function durationOf(fx) {
  if (fx.kind === 'coins') return fx.results.length * COIN_MS + COINS_HOLD_MS
  return DURATIONS[fx.kind] ?? 500
}

// Schedule the sound(s) for one fx entry. `later` registers cancellable timers.
function soundFor(fx, later) {
  switch (fx.kind) {
    case 'coins':
      fx.results.forEach((r, i) => {
        later(() => playSfx('coin'), i * COIN_MS)
        later(() => playSfx(r === 'H' ? 'heads' : 'tails'), i * COIN_MS + COIN_SPIN_MS)
      })
      break
    case 'attack':
      later(() => playSfx('attack'), 0)
      break
    case 'hit':
      later(() => playSfx('hit'), 0)
      break
    case 'status':
      later(() => playSfx(fx.status), 0)
      break
    case 'poison-tick':
      later(() => playSfx('poisoned'), 0)
      break
    case 'heal':
      later(() => playSfx('heal'), 0)
      break
    case 'ko':
      later(() => playSfx('ko'), 0)
      break
  }
}

function Coin({ result, landed, spinning }) {
  if (!spinning && !landed) return <div className="w-14 h-14" />
  if (spinning) {
    return (
      <div className="w-14 h-14 rounded-full bg-zinc-100 border-4 border-zinc-300 shadow-xl animate-[coinSpin_0.25s_linear_infinite] flex items-center justify-center overflow-hidden">
        <img src="/pokeball.svg" alt="" className="w-9 h-9 opacity-60" draggable={false} />
      </div>
    )
  }
  return result === 'H' ? (
    <div className="flex flex-col items-center gap-1">
      <div className="w-14 h-14 rounded-full bg-white border-4 border-poke-red shadow-xl flex items-center justify-center animate-[badgePop_0.3s_ease-out]">
        <img src="/pokeball.svg" alt="Heads" className="w-9 h-9" draggable={false} />
      </div>
      <span className="text-[10px] font-black uppercase tracking-wider text-white">Heads</span>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-1">
      <div className="w-14 h-14 rounded-full bg-zinc-700 border-4 border-zinc-500 shadow-xl flex items-center justify-center animate-[badgePop_0.3s_ease-out]">
        <span className="text-zinc-300 font-black text-lg">✕</span>
      </div>
      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Tails</span>
    </div>
  )
}

function CoinOverlay({ fx }) {
  const [progress, setProgress] = useState({ landed: 0, spinning: fx.results.length > 0 })

  useEffect(() => {
    const timers = []
    fx.results.forEach((_, i) => {
      timers.push(setTimeout(() => setProgress({ landed: i + 1, spinning: i + 1 < fx.results.length }), i * COIN_MS + COIN_SPIN_MS))
    })
    return () => timers.forEach(clearTimeout)
  }, [fx])

  const heads = fx.results.slice(0, progress.landed).filter((r) => r === 'H').length
  const allDone = progress.landed === fx.results.length

  return (
    <div data-testid="coin-overlay" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4 pointer-events-none">
      {fx.label && <div className="text-white text-sm font-bold uppercase tracking-widest drop-shadow">{fx.label}</div>}
      <div className="flex gap-4 items-start min-h-20">
        {fx.results.map((r, i) => (
          <Coin key={i} result={r} landed={i < progress.landed} spinning={i === progress.landed && progress.spinning} />
        ))}
      </div>
      <div className={`text-2xl font-black uppercase tracking-wide drop-shadow transition-opacity ${allDone ? 'opacity-100' : 'opacity-0'} ${heads > 0 ? 'text-poke-red' : 'text-zinc-300'}`}>
        {fx.results.length > 1 ? `${heads} Head${heads === 1 ? '' : 's'}` : heads > 0 ? 'Heads!' : 'Tails!'}
      </div>
    </div>
  )
}

function KoBanner({ name }) {
  return (
    <div data-testid="ko-banner" className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="px-8 py-4 bg-zinc-950/85 border-y-4 border-poke-red animate-[badgePop_0.35s_ease-out]">
        <span className="text-white text-2xl font-black uppercase tracking-widest drop-shadow">{name} was Knocked Out!</span>
      </div>
    </div>
  )
}

// Watches state.fxQueue, plays each entry (animation + sound) in order, then
// dispatches fx-done so the engine resumes. With animations off it fires the
// sounds and resumes immediately.
export function FxProvider({ children }) {
  const { state, dispatch } = useGame()
  const { settings } = useSettings()
  const [current, setCurrent] = useState(null)
  const playing = useRef(false)
  const animationsOn = settings.animations

  useEffect(() => {
    if (!state.fxQueue.length || playing.current) return
    playing.current = true
    const queue = [...state.fxQueue]
    const timers = []
    const later = (fn, ms) => timers.push(setTimeout(fn, ms))

    if (!animationsOn) {
      // Sound-only mode: quick staggered sounds, no visual delay.
      queue.forEach((fx, i) => later(() => soundFor(fx, (fn, ms) => later(fn, ms + i * 150)), 0))
      playing.current = false
      dispatch({ type: 'fx-done' })
      return () => {} // keep sound timers alive; they're harmless
    }

    const step = (i) => {
      if (i >= queue.length) {
        setCurrent(null)
        playing.current = false
        dispatch({ type: 'fx-done' })
        return
      }
      const fx = queue[i]
      setCurrent(fx)
      soundFor(fx, later)
      later(() => step(i + 1), durationOf(fx))
    }
    step(0)

    return () => {
      timers.forEach(clearTimeout)
      playing.current = false
      setCurrent(null)
    }
  }, [state.fxQueue, animationsOn, dispatch])

  return (
    <FxContext.Provider value={current}>
      {children}
      {current?.kind === 'coins' && <CoinOverlay fx={current} />}
      {current?.kind === 'ko' && <KoBanner name={current.name} />}
    </FxContext.Provider>
  )
}

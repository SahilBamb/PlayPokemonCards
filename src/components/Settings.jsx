import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { setVolume, setSoundEnabled, playSfx } from '../lib/sfx.js'

const KEY = 'ppc-settings'
const DEFAULTS = { animations: true, sound: true, volume: 0.7, theme: 'dark' }

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

const SettingsContext = createContext({ settings: DEFAULTS, update: () => {}, openSettings: () => {} })
export const useSettings = () => useContext(SettingsContext)

// Battle fx are engine-driven when either animations or sound is on.
export const fxWanted = (settings) => settings.animations || settings.sound

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
      <span className="text-sm font-semibold text-zinc-200">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full relative transition ${checked ? 'bg-poke-red' : 'bg-zinc-700'}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    </label>
  )
}

function SettingsModal({ settings, update, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div
        data-testid="settings-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-80 bg-zinc-900 border-2 border-poke-red rounded-sm shadow-2xl p-5 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between border-b-2 border-poke-red/60 pb-2">
          <h2 className="text-white text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <img src="/pokeball.svg" alt="" className="w-4 h-4" draggable={false} />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-sm bg-zinc-800 hover:bg-poke-red text-zinc-300 hover:text-white text-sm font-bold leading-none"
          >
            ×
          </button>
        </div>
        <Toggle label="Dark mode" checked={settings.theme !== 'light'} onChange={(v) => update({ theme: v ? 'dark' : 'light' })} />
        <Toggle label="Battle animations" checked={settings.animations} onChange={(v) => update({ animations: v })} />
        <Toggle label="Sound effects" checked={settings.sound} onChange={(v) => update({ sound: v })} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-zinc-200 flex justify-between">
            Volume <span className="text-zinc-400 font-normal">{Math.round(settings.volume * 100)}%</span>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.volume}
            disabled={!settings.sound}
            onChange={(e) => update({ volume: +e.target.value })}
            onMouseUp={() => playSfx('coin')}
            className="accent-poke-red disabled:opacity-40"
          />
        </label>
        <p className="text-[11px] text-zinc-500 leading-snug">
          With animations and sound both off, coin flips and effects resolve instantly.
        </p>
      </div>
    </div>
  )
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(load)
  const [open, setOpen] = useState(false)

  // Keep the sound engine in sync with the current settings.
  useEffect(() => {
    setVolume(settings.volume)
    setSoundEnabled(settings.sound)
  }, [settings])

  // Dark gameplay is the default; light mode is the opt-in.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme !== 'light')
  }, [settings.theme])

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const openSettings = useCallback(() => setOpen(true), [])

  return (
    <SettingsContext.Provider value={{ settings, update, openSettings }}>
      {children}
      {open && <SettingsModal settings={settings} update={update} onClose={() => setOpen(false)} />}
    </SettingsContext.Provider>
  )
}

// Small gear button that opens the settings modal.
export function SettingsButton({ className = '' }) {
  const { openSettings } = useSettings()
  return (
    <button
      onClick={openSettings}
      title="Settings"
      aria-label="Settings"
      className={`px-2.5 py-1 rounded-sm bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-white text-xs font-semibold shadow ${className}`}
    >
      ⚙
    </button>
  )
}

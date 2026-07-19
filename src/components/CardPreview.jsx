import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { TypeIcon } from './icons.jsx'

// Right-click any card to see it big and centered; click anywhere, press
// Escape, or hit the X to dismiss. Provided app-wide so every screen gets it.
const PreviewContext = createContext(() => {})
export const useCardPreview = () => useContext(PreviewContext)

// pokemontcg.io serves higher-resolution scans alongside the small ones
const hiresUrl = (url) => url?.replace(/\.png$/, '_hires.png')

function TextFallback({ card }) {
  return (
    <div className="w-80 max-w-[85vw] bg-amber-50 border-4 border-amber-300 rounded-2xl p-6 flex flex-col gap-3 text-gray-900">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{card.name}</h2>
        {card.hp && <span className="font-bold text-red-600">HP {card.hp}</span>}
      </div>
      {card.type && <TypeIcon type={card.type} size={18} />}
      {card.power && (
        <p className="text-sm">
          <span className="font-bold">{card.power.name}:</span> {card.power.text}
        </p>
      )}
      {(card.attacks ?? []).map((a) => (
        <p key={a.name} className="text-sm">
          <span className="font-bold">{a.name}</span> {a.damage && <span className="text-red-600 font-bold">{a.damage}</span>}
          {a.text && <> — {a.text}</>}
        </p>
      ))}
      {card.text && <p className="text-sm">{card.text}</p>}
    </div>
  )
}

function PreviewOverlay({ card, onClose }) {
  const [failedHires, setFailedHires] = useState(false)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      data-testid="card-preview"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-8 cursor-pointer"
    >
      <button
        onClick={onClose}
        aria-label="Close card preview"
        className="absolute top-4 right-4 w-10 h-10 rounded-sm bg-poke-red hover:bg-[#f4460f] border-b-2 border-poke-red-dark text-white text-xl font-bold
          flex items-center justify-center transition"
      >
        ✕
      </button>
      {card.image ? (
        <img
          src={failedHires ? card.image : hiresUrl(card.image)}
          onError={() => setFailedHires(true)}
          alt={card.name}
          className="max-h-[88vh] max-w-[90vw] rounded-sm shadow-2xl select-none animate-[zoomIn_120ms_ease-out]"
          draggable={false}
        />
      ) : (
        <TextFallback card={card} />
      )}
    </div>
  )
}

export function CardPreviewProvider({ children }) {
  const [card, setCard] = useState(null)
  const preview = useCallback((c) => {
    if (c && !c.hidden) setCard(c)
  }, [])
  const close = useCallback(() => setCard(null), [])

  return (
    <PreviewContext.Provider value={preview}>
      {children}
      {card && <PreviewOverlay card={card} onClose={close} />}
    </PreviewContext.Provider>
  )
}

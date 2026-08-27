import { useState } from 'react'

// Character dialogue: a large JRPG-style text box anchored to the bottom
// center, with the character's portrait oversized and overlapping its right
// edge. Advances line by line on click; `onDone` fires after the last line.
// Pass `onCancel` to offer a decline option ("Maybe Later") on the last line.
export function DialogueBox({ name, image, lines, onDone, doneLabel = 'Continue', onCancel, cancelLabel = 'Maybe Later' }) {
  const [i, setI] = useState(0)
  const last = i >= lines.length - 1
  const advance = () => (last ? onDone?.() : setI(i + 1))

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center pb-8 md:pb-16" data-testid="dialogue">
      <div className="relative w-full max-w-5xl px-4">
        {image && (
          <img
            src={image}
            alt={name}
            draggable={false}
            className="absolute right-4 md:right-8 bottom-0 z-10 h-80 md:h-[28rem] w-auto max-w-[45%] object-contain object-bottom
              drop-shadow-[0_0_24px_rgba(0,0,0,0.9)] pointer-events-none select-none"
          />
        )}
        <div
          onClick={advance}
          className="cursor-pointer select-none bg-zinc-950/95 border-2 border-zinc-600 rounded-sm shadow-2xl relative"
        >
          <div className="absolute -top-5 left-6 px-4 py-1 bg-poke-red border-b-2 border-poke-red-dark rounded-sm text-white text-base font-black uppercase tracking-wide shadow">
            {name}
          </div>
          <p
            className={`px-6 md:px-8 pt-9 pb-5 text-white text-xl md:text-2xl font-semibold leading-relaxed min-h-[9rem] md:min-h-[11rem]
              ${image ? 'pr-44 md:pr-80' : ''}`}
            data-testid="dialogue-line"
          >
            {lines[i]}
          </p>
          <div className={`px-6 md:px-8 pb-4 flex items-center justify-between gap-3 ${image ? 'pr-44 md:pr-80' : ''}`}>
            <span className="text-xs text-zinc-500 uppercase tracking-widest">
              {i + 1} / {lines.length} — click to continue
            </span>
            {last ? (
              <span className="flex items-center gap-2">
                {onCancel && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onCancel()
                    }}
                    data-testid="dialogue-cancel"
                    className="px-4 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 text-sm font-bold uppercase tracking-wide"
                  >
                    {cancelLabel}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDone?.()
                  }}
                  data-testid="dialogue-done"
                  className="px-5 py-2 rounded-sm bg-poke-red hover:bg-[#f4460f] border-b-2 border-poke-red-dark text-white text-sm font-bold uppercase tracking-wide"
                >
                  {doneLabel}
                </button>
              </span>
            ) : (
              <span className="text-poke-red text-2xl leading-none animate-pulse">▾</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

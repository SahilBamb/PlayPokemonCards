// Small synthesized sound effects via the Web Audio API — no audio assets.
// Each effect is a short recipe of oscillator/noise tones. Individual sounds
// can later be swapped for real audio files behind the same play() API.

let ctx = null
let master = null
let volume = 0.7
let enabled = true

function ensureContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = volume
    master.connect(ctx.destination)
  }
  // Browsers suspend audio until a user gesture; try to resume opportunistically.
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v))
  if (master) master.gain.value = volume
}

export function setSoundEnabled(v) {
  enabled = !!v
}

// One tone: { f: startFreq, f2: endFreq, t: startTime, d: duration,
//             type: oscillator type, g: peak gain, noise: true for white noise }
function playTones(tones) {
  const ac = ensureContext()
  if (!ac) return
  const now = ac.currentTime
  for (const tone of tones) {
    const start = now + (tone.t ?? 0)
    const dur = tone.d ?? 0.15
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(tone.g ?? 0.25, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    gain.connect(master)

    if (tone.noise) {
      const len = Math.ceil(ac.sampleRate * dur)
      const buffer = ac.createBuffer(1, len, ac.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      const src = ac.createBufferSource()
      src.buffer = buffer
      const filter = ac.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(tone.f ?? 800, start)
      if (tone.f2) filter.frequency.exponentialRampToValueAtTime(tone.f2, start + dur)
      src.connect(filter)
      filter.connect(gain)
      src.start(start)
      src.stop(start + dur)
    } else {
      const osc = ac.createOscillator()
      osc.type = tone.type ?? 'sine'
      osc.frequency.setValueAtTime(tone.f ?? 440, start)
      if (tone.f2) osc.frequency.exponentialRampToValueAtTime(tone.f2, start + dur)
      osc.connect(gain)
      osc.start(start)
      osc.stop(start + dur)
    }
  }
}

const SOUNDS = {
  packTear: [
    { noise: true, f: 1400, f2: 5200, d: 0.55, g: 0.18 },
    { noise: true, f: 2800, f2: 700, t: 0.4, d: 0.45, g: 0.14 },
  ],
  cardFlip: [{ noise: true, f: 1600, f2: 500, d: 0.12, g: 0.07 }, { f: 880, d: 0.11, t: 0.12, type: 'sine', g: 0.05 }],
  cardSlide: [{ noise: true, f: 900, f2: 1900, d: 0.16, g: 0.07 }],
  cardRare: [
    { f: 523, d: 0.25, type: 'sine', g: 0.1 },
    { f: 659, d: 0.3, t: 0.12, type: 'sine', g: 0.1 },
    { f: 784, d: 0.5, t: 0.24, type: 'sine', g: 0.1 },
    { f: 1047, d: 0.6, t: 0.36, type: 'sine', g: 0.07 },
  ],
  // coin toss: metallic ring while spinning
  coin: [
    { f: 900, f2: 1400, d: 0.35, type: 'triangle', g: 0.18 },
    { f: 1800, d: 0.25, t: 0.05, type: 'sine', g: 0.08 },
  ],
  // coin lands heads: bright ascending ding
  heads: [
    { f: 1100, d: 0.12, type: 'sine', g: 0.25 },
    { f: 1650, d: 0.28, t: 0.09, type: 'sine', g: 0.25 },
  ],
  // coin lands tails: dull descending thunk
  tails: [
    { f: 700, d: 0.12, type: 'sine', g: 0.25 },
    { f: 420, d: 0.3, t: 0.09, type: 'sine', g: 0.22 },
  ],
  // attack: quick whoosh
  attack: [{ noise: true, f: 400, f2: 2400, d: 0.3, g: 0.35 }],
  // hit: low thud
  hit: [
    { noise: true, f: 900, f2: 150, d: 0.2, g: 0.5 },
    { f: 120, f2: 55, d: 0.25, type: 'sine', g: 0.5 },
  ],
  poisoned: [
    { f: 220, f2: 160, d: 0.25, type: 'sawtooth', g: 0.12 },
    { f: 330, f2: 240, d: 0.3, t: 0.12, type: 'sawtooth', g: 0.1 },
    { f: 500, d: 0.08, t: 0.28, type: 'sine', g: 0.12 },
  ],
  asleep: [
    { f: 660, f2: 440, d: 0.4, type: 'sine', g: 0.14 },
    { f: 520, f2: 330, d: 0.45, t: 0.25, type: 'sine', g: 0.12 },
  ],
  confused: [
    { f: 500, f2: 900, d: 0.18, type: 'triangle', g: 0.16 },
    { f: 900, f2: 500, d: 0.18, t: 0.15, type: 'triangle', g: 0.16 },
    { f: 500, f2: 900, d: 0.18, t: 0.3, type: 'triangle', g: 0.16 },
  ],
  paralyzed: [
    { noise: true, f: 4000, f2: 1500, d: 0.2, g: 0.25 },
    { f: 80, d: 0.18, type: 'square', g: 0.12 },
  ],
  heal: [
    { f: 780, d: 0.14, type: 'sine', g: 0.16 },
    { f: 980, d: 0.14, t: 0.1, type: 'sine', g: 0.16 },
    { f: 1310, d: 0.3, t: 0.2, type: 'sine', g: 0.18 },
  ],
  ko: [
    { f: 300, f2: 70, d: 0.55, type: 'sawtooth', g: 0.3 },
    { noise: true, f: 600, f2: 100, d: 0.45, t: 0.05, g: 0.3 },
  ],
}

export function playSfx(name) {
  if (!enabled) return
  const tones = SOUNDS[name]
  if (tones) playTones(tones)
}

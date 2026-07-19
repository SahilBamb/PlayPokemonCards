export const opposite = { p1: 'p2', p2: 'p1' }

let uidCounter = 1
export const nextUid = () => `c${uidCounter++}`

export function flipCoins(coins = 1) {
  let heads = 0
  const results = []
  for (let i = 0; i < coins; i++) {
    const h = Math.random() > 0.5
    results.push(h ? 'H' : 'T')
    if (h) heads++
  }
  return { coins, heads, tails: coins - heads, results }
}

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Expand energy attachments into individual units of a type.
// burn ("Energy Burn") makes every unit count as fire.
export function energyUnits(energyAttached = [], burn = null) {
  const units = []
  for (const e of energyAttached) {
    const n = e.units ?? 1
    for (let i = 0; i < n; i++) units.push(burn ?? e.energy)
  }
  return units
}

export function costMatch({ cost = {}, energyAttached = [], burn = null }) {
  const units = energyUnits(energyAttached, burn)
  for (const [type, n] of Object.entries(cost)) {
    if (type === 'colorless') continue
    let need = n
    for (let i = 0; i < units.length && need > 0; i++) {
      if (units[i] === type) {
        units[i] = null
        need--
      }
    }
    if (need > 0) return false
  }
  return units.filter(Boolean).length >= (cost.colorless ?? 0)
}

// Water Gun / Hydro Pump: energy of `type` attached but not needed to pay the cost.
export function extraEnergy({ type, cost = {}, energyAttached = [] }) {
  const units = energyUnits(energyAttached)
  const ofType = units.filter((u) => u === type).length
  const others = units.length - ofType
  const colorlessNeed = Math.max(0, (cost.colorless ?? 0) - others)
  return Math.max(0, ofType - (cost[type] ?? 0) - colorlessNeed)
}

export function isString(e) {
  return typeof e === 'string' || e instanceof String
}

export function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function handleDragOver(e) {
  e.preventDefault()
}

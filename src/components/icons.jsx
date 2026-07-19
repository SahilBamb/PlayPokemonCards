import { FaStar, FaLeaf, FaFire, FaTint, FaBolt, FaBrain, FaFistRaised, FaMoon, FaCog, FaFlask, FaSyncAlt, FaBed, FaShieldAlt } from 'react-icons/fa'

export const TYPE_ICONS = {
  grass: { Icon: FaLeaf, bg: 'bg-green-200 text-green-800' },
  fire: { Icon: FaFire, bg: 'bg-red-200 text-red-700' },
  water: { Icon: FaTint, bg: 'bg-blue-200 text-blue-700' },
  lightning: { Icon: FaBolt, bg: 'bg-yellow-200 text-yellow-700' },
  psychic: { Icon: FaBrain, bg: 'bg-purple-200 text-purple-700' },
  fighting: { Icon: FaFistRaised, bg: 'bg-amber-400 text-amber-900' },
  darkness: { Icon: FaMoon, bg: 'bg-gray-300 text-gray-800' },
  metal: { Icon: FaCog, bg: 'bg-slate-200 text-slate-700' },
  colorless: { Icon: FaStar, bg: 'bg-slate-300 text-slate-700' },
  doublecolorless: { Icon: FaStar, bg: 'bg-slate-400 text-slate-800' },
}

export const STATUS_ICONS = {
  asleep: { Icon: FaBed, bg: 'bg-indigo-300 text-indigo-900' },
  confused: { Icon: FaSyncAlt, bg: 'bg-amber-300 text-amber-900' },
  paralyzed: { Icon: FaBolt, bg: 'bg-yellow-300 text-yellow-900' },
  poisoned: { Icon: FaFlask, bg: 'bg-lime-300 text-lime-900' },
}

export function TypeIcon({ type, size = 14 }) {
  const entry = type ? TYPE_ICONS[String(type).toLowerCase()] : null
  if (!entry) return null
  const { Icon, bg } = entry
  return (
    <span className={`inline-flex items-center justify-center rounded-full p-0.5 ${bg}`}>
      <Icon size={size} />
    </span>
  )
}

export function StatusIcon({ status, size = 12 }) {
  const entry = status ? STATUS_ICONS[String(status).toLowerCase()] : null
  if (!entry) return null
  const { Icon, bg } = entry
  return (
    <span title={status} className={`inline-flex items-center justify-center rounded-full p-1 shadow ${bg}`}>
      <Icon size={size} />
    </span>
  )
}

export function GuardIcon({ guard }) {
  if (!guard) return null
  const label = guard.kind === 'all' ? 'Blocks everything' : guard.kind === 'threshold' ? `Blocks <= ${guard.threshold}` : 'Blocks damage'
  return (
    <span title={label} className="inline-flex items-center justify-center rounded-full p-1 bg-cyan-200 text-cyan-800 shadow">
      <FaShieldAlt size={12} />
    </span>
  )
}

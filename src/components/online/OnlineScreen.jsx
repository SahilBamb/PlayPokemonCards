// Multiplayer entry point: lobby (name, deck, ranked queue / private codes /
// leaderboard) and the handoff into OnlineMatchScreen once a match starts.
import { useState, useRef, useEffect, useCallback } from 'react'
import { DECKS } from '../../engine/cards.js'
import { DECK_GROUPS } from '../../data/presetDecks.js'
import { loadDecks, deckToList, validateDeck } from '../../lib/deckStore.js'
import {
  makeClient,
  attachSession,
  loadIdentity,
  saveIdentityName,
  randomCode,
  SERVER_HTTP_URL,
} from '../../lib/online.js'
import { SettingsButton } from '../Settings.jsx'
import { OnlineMatchScreen } from './OnlineMatchScreen.jsx'

// All deck options the lobby offers: every Quick Play preset plus the
// player's own match-legal saved decks.
function deckChoices() {
  const groups = Object.entries(DECK_GROUPS).map(([gid, label]) => ({
    label,
    options: Object.values(DECKS)
      .filter((d) => d.group === gid)
      .map((d) => ({ key: `preset:${d.id}`, name: d.name, list: d.list })),
  }))
  const custom = loadDecks()
    .filter((d) => validateDeck(d.counts).length === 0)
    .map((d) => ({ key: `custom:${d.id}`, name: `${d.name || '(unnamed)'} ★`, list: deckToList(d) }))
  if (custom.length) groups.unshift({ label: 'My Decks', options: custom })
  return groups
}

function Panel({ title, children }) {
  return (
    <div className="flex flex-col items-center gap-5 bg-zinc-900/90 border-2 border-zinc-700 rounded-sm p-6 shadow-2xl backdrop-blur-sm w-[28rem] max-w-[92vw] max-h-[80vh] overflow-y-auto">
      <h2 className="text-lg font-bold uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

function Leaderboard({ onBack }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    fetch(`${SERVER_HTTP_URL}/leaderboard`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError(true))
  }, [])

  const Row = ({ p, rank }) => (
    <tr className="border-b border-zinc-800 last:border-0">
      <td className="py-1 pr-3 text-zinc-500 font-bold">{rank}</td>
      <td className="py-1 pr-3 font-semibold text-white">{p.name}</td>
      <td className="py-1 pr-3 text-poke-red font-black">{p.elo}</td>
      <td className="py-1 text-zinc-400">
        {p.wins}–{p.losses}
      </td>
    </tr>
  )

  return (
    <Panel title="Ranked Leaderboard">
      {error && <p className="text-sm text-red-400">Could not reach the server.</p>}
      {!data && !error && <p className="text-sm text-zinc-400 animate-pulse">Loading…</p>}
      {data && data.total === 0 && <p className="text-sm text-zinc-400">No ranked matches played yet — be the first!</p>}
      {data && data.top.length > 0 && (
        <table className="w-full text-sm" data-testid="leaderboard-top">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-zinc-500">
              <th className="pb-2">#</th>
              <th className="pb-2">Trainer</th>
              <th className="pb-2">Elo</th>
              <th className="pb-2">W–L</th>
            </tr>
          </thead>
          <tbody>
            {data.top.map((p, i) => (
              <Row key={p.id} p={p} rank={i + 1} />
            ))}
          </tbody>
        </table>
      )}
      {data && data.bottom.length > 0 && (
        <>
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Hall of Shame</span>
          <table className="w-full text-sm">
            <tbody>
              {data.bottom.map((p, i) => (
                <Row key={p.id} p={p} rank={data.total - i} />
              ))}
            </tbody>
          </table>
        </>
      )}
      <button onClick={onBack} className="px-5 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 font-semibold">
        Back
      </button>
    </Panel>
  )
}

function OnlineLobby({ onExit, onSession }) {
  const identity = useRef(loadIdentity()).current
  const [name, setName] = useState(identity.name)
  const [groups] = useState(deckChoices)
  const [deckKey, setDeckKey] = useState(groups[0]?.options[0]?.key ?? '')
  const [joinCode, setJoinCode] = useState('')
  const [status, setStatus] = useState({ mode: 'idle' }) // idle | connecting | waiting | leaderboard | error
  const watchRef = useRef(null)

  const currentDeck = groups.flatMap((g) => g.options).find((o) => o.key === deckKey)

  const cancelWait = useCallback(() => {
    watchRef.current?.unsub?.()
    watchRef.current?.session?.room?.leave()
    watchRef.current = null
    setStatus({ mode: 'idle' })
  }, [])

  // Leave any half-open room if the lobby unmounts (e.g. back to menu).
  useEffect(() => () => watchRef.current?.session?.room?.leave(), [])

  async function connect(kind) {
    if (!currentDeck) return
    const displayName = name.trim() || 'Trainer'
    saveIdentityName(displayName)
    setStatus({ mode: 'connecting' })
    try {
      const client = makeClient()
      const opts = {
        name: displayName,
        deck: currentDeck.list,
        playerId: identity.playerId,
        token: identity.token,
      }
      let room
      let code = null
      if (kind === 'ranked') {
        room = await client.joinOrCreate('ranked', opts)
      } else if (kind === 'host') {
        code = randomCode()
        room = await client.create('private', { ...opts, code })
      } else {
        code = joinCode.trim().toUpperCase()
        if (!code) throw new Error('Enter the code your friend shared.')
        room = await client.join('private', { ...opts, code })
      }
      const session = attachSession(room)
      const unsub = session.subscribe(() => {
        if (session.start) {
          unsub()
          watchRef.current = null
          onSession(session)
        } else if (session.closed) {
          unsub()
          watchRef.current = null
          setStatus({ mode: 'error', message: session.error ?? 'Disconnected from the server.' })
        }
      })
      watchRef.current = { session, unsub }
      setStatus({ mode: 'waiting', kind, code })
    } catch (e) {
      const message = String(e?.message ?? e)
        .replace(/^.*onError.*=>/, '')
        .trim()
      setStatus({
        mode: 'error',
        message:
          message && !/failed to fetch|network/i.test(message)
            ? message
            : 'Could not reach the multiplayer server. Is it running?',
      })
    }
  }

  if (status.mode === 'leaderboard') {
    return <Leaderboard onBack={() => setStatus({ mode: 'idle' })} />
  }

  if (status.mode === 'waiting') {
    return (
      <Panel title={status.kind === 'ranked' ? 'Searching for an opponent…' : 'Waiting for your friend…'}>
        {status.kind !== 'ranked' && status.code && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-zinc-500">Share this code</span>
            <span data-testid="private-code" className="text-4xl font-black tracking-[0.3em] text-poke-red">
              {status.code}
            </span>
          </div>
        )}
        <img src="/pokeball.svg" alt="" className="w-12 h-12 animate-spin [animation-duration:2.5s] opacity-70" draggable={false} />
        {status.kind === 'ranked' && <p className="text-sm text-zinc-400">You'll be paired with the next trainer who queues up.</p>}
        <button onClick={cancelWait} className="px-5 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 font-semibold">
          Cancel
        </button>
      </Panel>
    )
  }

  return (
    <Panel title="Multiplayer">
      {status.mode === 'error' && (
        <p className="text-sm text-red-400 border border-red-900 bg-red-950/40 rounded-sm px-3 py-2 w-full text-center">{status.message}</p>
      )}
      <label className="w-full flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Trainer name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder="Trainer"
          data-testid="online-name"
          className="w-full px-3 py-2 rounded-sm bg-zinc-950 border-2 border-zinc-700 focus:border-poke-red outline-none text-white font-semibold"
        />
      </label>
      <label className="w-full flex flex-col gap-1">
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Deck</span>
        <select
          value={deckKey}
          onChange={(e) => setDeckKey(e.target.value)}
          data-testid="online-deck"
          className="w-full px-3 py-2 rounded-sm bg-zinc-950 border-2 border-zinc-700 focus:border-poke-red outline-none text-white font-semibold"
        >
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="text-[11px] text-zinc-500">Format: everything through Gym Challenge. Build your own in the Deck Editor.</span>
      </label>

      <button
        onClick={() => connect('ranked')}
        disabled={status.mode === 'connecting'}
        data-testid="online-ranked"
        className="w-full px-6 py-3 rounded-sm bg-poke-red hover:bg-[#f4460f] disabled:opacity-50 text-white text-lg font-black tracking-wide uppercase border-b-4 border-poke-red-dark shadow-xl transition"
      >
        Ranked Match
      </button>

      <div className="w-full flex flex-col gap-2">
        <button
          onClick={() => connect('host')}
          disabled={status.mode === 'connecting'}
          data-testid="online-host"
          className="w-full px-6 py-2.5 rounded-sm bg-zinc-100 hover:bg-white disabled:opacity-50 text-poke-red font-black tracking-wide uppercase border-b-4 border-zinc-400 shadow transition"
        >
          Create Private Match
        </button>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            maxLength={6}
            data-testid="online-code"
            className="flex-1 px-3 py-2 rounded-sm bg-zinc-950 border-2 border-zinc-700 focus:border-poke-red outline-none text-white font-black tracking-[0.2em] uppercase text-center"
          />
          <button
            onClick={() => connect('join')}
            disabled={status.mode === 'connecting' || !joinCode.trim()}
            data-testid="online-join"
            className="px-4 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border-2 border-zinc-600 font-bold uppercase tracking-wide"
          >
            Join
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onExit} className="px-5 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 font-semibold">
          Back
        </button>
        <button
          onClick={() => setStatus({ mode: 'leaderboard' })}
          data-testid="online-leaderboard"
          className="px-5 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 font-semibold"
        >
          Leaderboard
        </button>
      </div>
    </Panel>
  )
}

export function OnlineScreen({ onExit }) {
  const [session, setSession] = useState(null)

  const leaveMatch = useCallback(() => {
    session?.room?.leave()
    setSession(null)
  }, [session])

  if (session) {
    return <OnlineMatchScreen session={session} onExit={leaveMatch} />
  }
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center gap-8 text-white">
      <div className="absolute top-4 right-4">
        <SettingsButton />
      </div>
      <div className="flex flex-col items-center gap-3">
        <img src="/pokeball.svg" alt="" className="w-14 h-14 drop-shadow-[0_0_24px_rgba(227,53,13,0.45)]" draggable={false} />
        <h1 className="text-3xl font-black tracking-tight drop-shadow-lg">
          Multiplayer<span className="text-poke-red"> Arena</span>
        </h1>
      </div>
      <OnlineLobby onExit={onExit} onSession={setSession} />
    </div>
  )
}

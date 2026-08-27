// Client-side multiplayer plumbing: persistent identity, server connection,
// and a session wrapper that buffers room messages so React screens can mount
// and unmount without losing the latest view.
import { Client } from 'colyseus.js'

// Explicit override first (VITE_ONLINE_URL=wss://myserver.up.railway.app);
// production builds default to same-origin (the server can serve dist/);
// dev defaults to the local server's port.
const DEFAULT_URL = import.meta.env.PROD
  ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
  : `ws://${window.location.hostname}:2567`
const RAW_URL = import.meta.env.VITE_ONLINE_URL ?? DEFAULT_URL
export const SERVER_WS_URL = RAW_URL.replace(/\/$/, '')
export const SERVER_HTTP_URL = SERVER_WS_URL.replace(/^ws/, 'http')

export const makeClient = () => new Client(SERVER_WS_URL)

// One identity per browser, created lazily. The token is the proof of
// ownership of the player id (and its Elo) — it never leaves this device
// except to the game server.
const IDENTITY_KEY = 'ppc-online-id'

export function loadIdentity() {
  try {
    const id = JSON.parse(localStorage.getItem(IDENTITY_KEY))
    if (id?.playerId && id?.token) return id
  } catch {
    // fall through to a fresh identity
  }
  const fresh = { playerId: crypto.randomUUID(), token: crypto.randomUUID(), name: '' }
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(fresh))
  return fresh
}

export function saveIdentityName(name) {
  const id = loadIdentity()
  localStorage.setItem(IDENTITY_KEY, JSON.stringify({ ...id, name }))
}

// Share codes for private matches (unambiguous alphabet, 6 chars).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function randomCode() {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return code
}

// Attach message handlers immediately after joining, before any React screen
// mounts, so the opening 'start'/'view' messages are never dropped.
export function attachSession(room) {
  const session = {
    room,
    payload: null, // latest { view, targets, actions }
    start: null,
    result: null,
    oppConnected: true,
    closed: false,
    error: null,
    version: 0, // bumped on every message — React subscribes to this
    listeners: new Set(),
  }
  const notify = () => {
    session.version++
    session.listeners.forEach((l) => l())
  }
  room.onMessage('view', (p) => {
    session.payload = p
    notify()
  })
  room.onMessage('start', (m) => {
    session.start = m
    notify()
  })
  room.onMessage('result', (m) => {
    session.result = m
    notify()
  })
  room.onMessage('opp-disconnected', () => {
    session.oppConnected = false
    notify()
  })
  room.onMessage('opp-reconnected', () => {
    session.oppConnected = true
    notify()
  })
  room.onError((code, message) => {
    session.error = message || `Connection error (${code})`
    notify()
  })
  room.onLeave(() => {
    session.closed = true
    notify()
  })
  session.subscribe = (listener) => {
    session.listeners.add(listener)
    return () => session.listeners.delete(listener)
  }
  return session
}

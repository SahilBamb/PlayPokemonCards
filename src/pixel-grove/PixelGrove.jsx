import { useEffect, useReducer, useRef, useState } from 'react'
import { POKEMON, cardDefinition, fullName, groveReducer, hpLeft, initialGroveState } from './game.js'
import './pixel-grove.css'
import { AppearanceOptions } from '../components/AppearanceOptions.jsx'
import { loadAppearance, saveAppearance } from '../lib/appearance.js'

const ASSETS = '/pixel-grove/assets/'
const atlasPosition = (index, columns, rows) => ({
  backgroundPosition: `${(index % columns) / (columns - 1) * 100}% ${Math.floor(index / columns) / (rows - 1) * 100}%`,
})

export function EnergyIcon({ type = 'lightning', className = '' }) {
  const index = { lightning: 0, psychic: 1, colorless: 2, silver: 3 }[type]
  return <span className={`grove-energy ${className}`} style={atlasPosition(index, 2, 2)} role="img" aria-label={`${type} energy`} />
}

function Art({ species, className = '' }) {
  return <div className={`grove-art ${className}`} style={atlasPosition(POKEMON[species].art, 3, 2)} role="img" aria-label={`Pixel art of ${POKEMON[species].name}`} />
}

export function PokemonCard({ species, compact = false }) {
  const card = POKEMON[species]
  return (
    <div className={`grove-pokemon-card ${compact ? 'compact' : ''}`} data-type={card.type} data-card={species}>
      <div className="grove-card-meta"><span>{card.stage}{card.evolvesFrom ? ` · ${POKEMON[card.evolvesFrom].name}` : ''}</span><span>HP <b>{card.hp}</b> <EnergyIcon type={card.type} /></span></div>
      <Art species={species} />
      <div className="grove-card-title">{card.name}{card.suffix && <em>ex</em>}</div>
      {!compact && <>
        <div className="grove-card-attacks">{card.attacks.map((attack) => <div key={attack.name}>
          <div><span className="grove-cost">{Array.from({ length: attack.cost }, (_, i) => <EnergyIcon key={i} type={card.type} />)}</span><strong>{attack.name}</strong><b>{attack.damage || '—'}</b></div>
          <p>{attack.text}</p>
        </div>)}</div>
        <p className="grove-card-flavor">{card.description}</p>
        <div className="grove-card-bottom"><span>POCKET GROVE</span><span>{String(card.art + 1).padStart(2, '0')} / 06 ✦</span></div>
      </>}
    </div>
  )
}

function ItemCard({ id }) {
  const card = cardDefinition(id)
  return <div className="grove-item-card" style={atlasPosition(card.objectArt, 2, 2)}>
    <span className="grove-item-kind">{card.kind === 'energy' ? 'ENERGY' : 'ITEM'}</span>
    <span className="grove-item-title">{card.name}</span>
  </div>
}

function Sprite({ pokemon, side, className = '' }) {
  let index
  if (pokemon.species === 'pikachu') index = pokemon.status === 'asleep' ? 3 : 2
  else index = { voltorb: 0, electrode: 1, koffing: 4, weezing: 5, jigglypuff: 6 }[pokemon.species]
  return <span className={`grove-sprite ${className}`} style={atlasPosition(index, 4, 2)} data-pose={pokemon.species === 'pikachu' ? (pokemon.status === 'asleep' ? 'sleeping' : 'awake') : side === 'player' ? 'back' : 'front'} />
}

function Creature({ pokemon, side, active, index, selected, targetable, onClick, event }) {
  const data = POKEMON[pokemon.species]
  const hp = hpLeft(pokemon)
  const isHit = event.kind === 'attack' && event.side !== side && active
  const isActing = event.kind === 'attack' && event.side === side && active
  const isEvolving = event.kind === 'evolve' && event.uid === pokemon.uid
  return <button
    className={`grove-creature ${active ? 'active' : 'benched'} ${side} ${selected ? 'selected' : ''} ${targetable ? 'targetable' : ''}`}
    style={!active ? { left: `${29 + index * 22}%`, top: side === 'opponent' ? '18.8%' : '76.3%' } : undefined}
    onClick={onClick}
    aria-label={`${side === 'player' ? 'Your' : 'Opponent’s'} ${fullName(pokemon)}, ${hp} of ${data.hp} HP, ${active ? 'active' : 'bench'}`}
    aria-pressed={selected} data-creature={pokemon.uid} data-species={pokemon.species}
  >
    <span key={`${event.id}-${pokemon.uid}`} className={`grove-sprite-motion ${isHit ? 'taking-hit' : ''} ${isActing ? 'attacking' : ''} ${isEvolving ? 'evolving' : ''}`}>
      <Sprite pokemon={pokemon} side={side} />
    </span>
    {pokemon.status === 'asleep' && <span className="grove-zzz" aria-label="Asleep">z<span>z</span><small>z</small></span>}
    {pokemon.status === 'poisoned' && <span className="grove-poison" aria-label="Poisoned">POISON</span>}
    {isHit && <span key={`hit-${event.id}`} className="grove-damage">−{event.damage}</span>}
    <span className="grove-creature-caption"><span>{data.name}{data.suffix && <em>ex</em>}</span><span>{hp}<small>/{data.hp}</small></span></span>
    <span className="grove-hp"><span style={{ width: `${hp / data.hp * 100}%`, backgroundColor: hp / data.hp < 0.3 ? '#ed8165' : hp / data.hp < 0.6 ? '#ecca55' : undefined }} /></span>
    <span className="grove-attached">{Array.from({ length: Math.min(pokemon.energy, 6) }, (_, i) => <EnergyIcon type={side === 'player' ? 'lightning' : data.type} key={i} />)}{pokemon.energy > 6 && <small>+{pokemon.energy - 6}</small>}</span>
  </button>
}

function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null)
  useEffect(() => { ref.current.showModal() }, [])
  return <dialog ref={ref} className={`grove-dialog ${wide ? 'wide' : ''}`} onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose() }} aria-label={title}>
    <div className="grove-dialog-heading"><div><span className="grove-eyebrow">POCKET GROVE</span><h2>{title}</h2></div><button className="grove-close" onClick={onClose} aria-label="Close dialog">×</button></div>
    {children}
  </dialog>
}

export default function PixelGrove() {
  const [state, dispatch] = useReducer(groveReducer, undefined, initialGroveState)
  const [selectedUid, setSelectedUid] = useState('p-pikachu')
  const [handIndex, setHandIndex] = useState(null)
  const [modal, setModal] = useState(null)
  const [sound, setSound] = useState(false)
  const [appearance, setAppearance] = useState(loadAppearance)
  const [mobilePanel, setMobilePanel] = useState(false)
  const audio = useRef(null)
  const allPokemon = [state.player.active, ...state.player.bench, state.opponent.active, ...state.opponent.bench].filter(Boolean)
  const selected = allPokemon.find((p) => p.uid === selectedUid) || state.player.active
  const friendly = [state.player.active, ...state.player.bench].some((p) => p?.uid === selected.uid)
  const selectedCardId = handIndex === null ? null : state.player.hand[handIndex]
  const selectedCard = selectedCardId ? cardDefinition(selectedCardId) : null
  const data = POKEMON[selected.species]
  const isPlayer = state.phase === 'player'
  const isSelectedActive = selected.uid === state.player.active.uid
  const send = (action) => dispatch({ ...action, roll: Math.random(), rolls: [Math.random(), Math.random()] })

  useEffect(() => { saveAppearance(appearance) }, [appearance])

  useEffect(() => {
    if (state.phase !== 'opponent') return
    const timer = setTimeout(() => dispatch({ type: 'opponent-turn', rolls: [Math.random(), Math.random()] }), 1600)
    return () => clearTimeout(timer)
  }, [state.phase])

  useEffect(() => {
    if (!sound || !audio.current) return
    const context = audio.current
    const tones = state.event.kind === 'evolve' ? [392, 494, 587, 784] : state.event.kind === 'attack' ? [196, 148, 98] : state.event.kind === 'wake' ? [523, 659, 784] : [440, 554]
    tones.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const at = context.currentTime + index * 0.065
      oscillator.type = 'triangle'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(0.035, at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.16)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(at)
      oscillator.stop(at + 0.18)
    })
  }, [state.event.id, state.event.kind, sound])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setHandIndex(null); setMobilePanel(false) }
      if (e.code === 'Space' && !modal && e.target === document.body && state.phase === 'player') {
        e.preventDefault()
        dispatch({ type: 'end-turn', rolls: [Math.random(), Math.random()] })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, state.phase])

  const validTarget = (pokemon) => {
    if (!selectedCard || !isPlayer) return false
    if (selectedCard.kind === 'energy') return !state.attached
    if (selectedCardId === 'potion') return pokemon.damage > 0
    return selectedCard.evolvesFrom === pokemon.species
  }
  const playCard = (target, bench) => {
    const action = { type: 'play-card', index: handIndex, target, bench }
    const result = groveReducer(state, action)
    dispatch(action)
    if (result.player.hand.length < state.player.hand.length) setHandIndex(null)
    if (target) setSelectedUid(target)
  }
  const choosePokemon = (pokemon, side) => {
    if (selectedCard && side === 'player') playCard(pokemon.uid)
    else { setSelectedUid(pokemon.uid); setHandIndex(null); setMobilePanel(true) }
  }
  const endTurn = () => { setHandIndex(null); send({ type: 'end-turn' }) }
  const reset = () => { dispatch({ type: 'reset' }); setSelectedUid('p-pikachu'); setHandIndex(null); setMobilePanel(false); setModal(null) }
  const toggleSound = () => {
    if (!audio.current) audio.current = new (window.AudioContext || window.webkitAudioContext)()
    audio.current.resume()
    setSound(!sound)
  }
  const cardHint = !selectedCard ? 'Choose a card from your hand or a Pokémon in the clearing.' : selectedCard.evolvesFrom ? 'Choose a Voltorb to evolve.' : selectedCard.kind === 'energy' ? 'Choose one of your Pokémon to attach Energy.' : selectedCardId === 'potion' ? 'Choose a damaged Pokémon to heal.' : 'Choose an empty patch on your bench.'

  return <main className="grove-app" data-appearance={appearance}>
    <div className="grove-page-no">FIELD STUDY <span>001</span></div>
    <div className="grove-shell">
      <aside className="grove-left">
        <a href="/" className="grove-brand" aria-label="Pocket Grove home"><span className="grove-brand-ball" /><span>PLAYPOKEMONCARDS</span></a>
        <div className="grove-intro"><div className="grove-eyebrow"><span className="grove-tiny-star">✦</span> A LITTLE CHANGE OF SCENERY</div><h1>Pocket <br />Grove<span>.</span></h1><p>A familiar card game.<br />A tiny, living world.</p></div>
        <div className="grove-turn-card"><span className={`grove-status-light ${!isPlayer ? 'thinking' : ''}`} /><div><span className="grove-eyebrow">TURN {String(state.turn).padStart(2, '0')}</span><strong>{state.phase === 'over' ? 'Battle complete' : isPlayer ? 'Your move' : 'Their move…'}</strong></div><span className="grove-turn-symbol">{isPlayer ? '↗' : '···'}</span></div>
        <div className="grove-turn-checks"><span className={state.attached ? 'done' : ''}>{state.attached ? '✓' : '○'} Energy attached</span><span className={state.retreated ? 'done' : ''}>{state.retreated ? '✓' : '○'} Pokémon switched</span></div>
        <div className="grove-field-notes"><h2>From the clearing <span>↘</span></h2><ol>{state.log.slice(0, 4).map((entry, i) => <li key={entry.id} className={i === 0 ? 'latest' : ''}><span className="grove-note-dot" />{entry.text}</li>)}</ol></div>
        <div className="grove-left-bottom"><button className="grove-end-turn" onClick={endTurn} disabled={!isPlayer}>End turn <span>→</span></button><AppearanceOptions value={appearance} onChange={setAppearance} /><div className="grove-small-controls"><button onClick={() => setModal('guide')}>? How to play</button><button onClick={toggleSound} aria-pressed={sound}>{sound ? '♪ Sound on' : '♪ Sound off'}</button></div><a href="/classic" className="grove-classic-link">Return to the classic game ↗</a></div>
      </aside>

      <section className="grove-table-column" aria-label="Forest battle table">
        <div className="grove-table-topline"><span><i /> FOREST CLEARING</span><button onClick={() => setModal('reference')}>THE INSPIRATION ↗</button></div>
        <div className={`grove-board ${selectedCard ? 'choosing-target' : ''}`}>
          <img className="grove-board-background" src={`${ASSETS}forest-board.png`} alt="A lush pixel-art forest clearing with mint-green grass, clovers, flowers, and teal leaves" />
          <div className="grove-dappled-light" />
          <div className="grove-fireflies" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
          <span className="grove-zone-label opponent">OPPONENT’S BENCH</span>
          <span className="grove-zone-label player">YOUR BENCH</span>
          <div className="grove-opponent-hand" aria-label="Opponent’s hidden hand"><span /><span /></div>
          <div className="grove-deck opponent" aria-label="Opponent’s deck"><div /><span>18</span></div>
          <div className="grove-deck player" aria-label={`${state.player.deck.length} cards in your deck`}><div /><span>{state.player.deck.length}</span></div>
          <div className="grove-discard opponent" aria-label={`${state.opponent.discard} cards in opponent’s discard pile`}><span /><span /></div>
          <div className="grove-discard player" aria-label={`${state.player.discard} cards in your discard pile`}><span /><span />{state.player.discard > 0 && <b>{state.player.discard}</b>}</div>
          {state.opponent.bench.map((pokemon, i) => pokemon && <Creature key={pokemon.uid} pokemon={pokemon} side="opponent" index={i} selected={selected.uid === pokemon.uid && !selectedCard} onClick={() => choosePokemon(pokemon, 'opponent')} event={state.event} />)}
          <Creature pokemon={state.opponent.active} side="opponent" active selected={selected.uid === state.opponent.active.uid && !selectedCard} onClick={() => choosePokemon(state.opponent.active, 'opponent')} event={state.event} />
          {state.player.active.species === 'pikachu' && state.player.active.status !== 'asleep' && <div className="grove-stump grove-sprite" style={atlasPosition(7, 4, 2)} aria-hidden="true" />}
          <Creature pokemon={state.player.active} side="player" active selected={selected.uid === state.player.active.uid && !selectedCard} targetable={validTarget(state.player.active)} onClick={() => choosePokemon(state.player.active, 'player')} event={state.event} />
          {state.player.bench.map((pokemon, i) => pokemon ? <Creature key={pokemon.uid} pokemon={pokemon} side="player" index={i} selected={selected.uid === pokemon.uid && !selectedCard} targetable={validTarget(pokemon)} onClick={() => choosePokemon(pokemon, 'player')} event={state.event} /> : <button className={`grove-empty-bench ${selectedCard && POKEMON[selectedCardId]?.stage === 'Basic' ? 'targetable' : ''}`} key={`empty-${i}`} style={{ left: `${29 + i * 22}%` }} aria-label={`Empty bench patch ${i + 1}`} onClick={() => selectedCard && playCard(undefined, i)}><span>+</span><small>BENCH</small></button>)}
          <button className={`grove-wake-coin ${state.coin ? `coin-${state.coin}` : ''}`} onClick={() => send({ type: 'wake' })} disabled={!isPlayer || state.player.active.status !== 'asleep' || state.sleepChecked} aria-label="Flip wake-up coin" title="Flip the silver coin to wake up"><EnergyIcon type="silver" />{state.player.active.status === 'asleep' && !state.sleepChecked && <span>FLIP TO WAKE</span>}{state.coin && <span>{state.coin.toUpperCase()}</span>}</button>
          <div className="grove-prizes" aria-label={`${state.player.prizes} prize cards remaining`}><EnergyIcon /><strong>{state.player.prizes}</strong><span>PRIZES LEFT</span></div>
          <div className="grove-opponent-prizes" aria-label={`${state.opponent.prizes} opponent prizes remaining`}><EnergyIcon type="silver" /><strong>{state.opponent.prizes}</strong></div>
          <div className="grove-hand" aria-label="Your hand">{state.player.hand.map((id, i) => <button key={`${id}-${i}`} className={`grove-hand-card ${handIndex === i ? 'chosen' : ''}`} style={{ '--card-tilt': `${(i - (state.player.hand.length - 1) / 2) * 3}deg`, '--card-index': i }} disabled={!isPlayer} onClick={() => { setHandIndex(handIndex === i ? null : i); setMobilePanel(false) }} aria-label={`Play ${cardDefinition(id).name}${POKEMON[id]?.suffix ? ' ex' : ''}`} aria-pressed={handIndex === i} title={cardDefinition(id).name}>{POKEMON[id] ? <PokemonCard species={id} compact /> : <ItemCard id={id} />}</button>)}</div>
          <span className="grove-hand-label">YOUR HAND <b>{state.player.hand.length}</b></span>
          {state.event.kind === 'evolve' && <div key={state.event.id} className="grove-evolution-sparkles" aria-hidden="true">✦<span>✦</span><i>✦</i></div>}
          {state.phase === 'over' && <div className="grove-victory"><span className="grove-eyebrow">THE CLEARING GROWS QUIET</span><h2>{state.winner === 'player' ? 'A little victory.' : 'Another day, another battle.'}</h2><p>{state.winner === 'player' ? 'Every great adventure starts small.' : 'There is always room for one more round.'}</p><button onClick={reset}>Play again <span>↗</span></button></div>}
        </div>
        <div className="grove-table-bottomline"><span>THREE PRIZES. SIX POKÉMON. ONE LITTLE GROVE.</span><span>✦</span></div>
      </section>

      <aside className={`grove-right ${mobilePanel ? 'mobile-open' : ''}`}>
        <div className="grove-inspector-heading"><span className="grove-eyebrow">{selectedCard ? 'IN YOUR HAND' : friendly ? 'YOUR POKÉMON' : 'OPPONENT’S POKÉMON'}</span><button onClick={() => { setMobilePanel(false); setHandIndex(null) }} aria-label="Close Pokémon details" className="grove-mobile-close">×</button><button className="grove-reset" onClick={() => setModal('reset')} title="Start a fresh battle" aria-label="Restart battle">↻</button></div>
        <div className="grove-inspector-art">{selectedCard && !POKEMON[selectedCardId] ? <ItemCard id={selectedCardId} /> : <PokemonCard species={selectedCardId && POKEMON[selectedCardId] ? selectedCardId : selected.species} />}</div>
        {selectedCard ? <div className="grove-card-instructions"><span className="grove-eyebrow">{selectedCard.evolvesFrom ? 'TIME TO EVOLVE' : selectedCard.kind === 'energy' ? 'A LITTLE EXTRA SPARK' : selectedCardId === 'potion' ? 'A LITTLE PICK-ME-UP' : 'JOIN THE CLEARING'}</span><h2>{selectedCard.name}{selectedCard.suffix ? ' ex' : ''}</h2><p>{cardHint}</p><button className="grove-text-button" onClick={() => setHandIndex(null)}>Cancel selection ×</button></div> : <>
          <div className="grove-inspector-status"><span className="grove-hp-number">{hpLeft(selected)} <small>/ {data.hp} HP</small></span><span className={`grove-condition ${selected.status || ''}`}>{selected.status === 'asleep' ? 'zZ Asleep' : selected.status === 'poisoned' ? 'Poisoned' : 'Ready'}</span></div>
          <div className="grove-inspector-energy"><span>Attached Energy</span><div>{selected.energy ? Array.from({ length: Math.min(selected.energy, 8) }, (_, i) => <EnergyIcon key={i} type={friendly ? 'lightning' : data.type} />) : <span className="grove-no-energy">None yet</span>}</div></div>
          <div className="grove-actions">{data.attacks.map((attack, index) => <button key={attack.name} onClick={() => send({ type: 'attack', index })} disabled={!isPlayer || !isSelectedActive || selected.status === 'asleep' || selected.energy < attack.cost} aria-label={`Use ${attack.name}`}><span><span className="grove-action-cost">{Array.from({ length: attack.cost }, (_, i) => <EnergyIcon key={i} type={data.type} />)}</span><strong>{attack.name}</strong></span><b>{attack.damage || 'zZ'}</b></button>)}</div>
          {isSelectedActive && selected.status === 'asleep' && <button className="grove-wake-action" aria-label="Flip a coin to wake up" onClick={() => send({ type: 'wake' })} disabled={!isPlayer || state.sleepChecked}><EnergyIcon type="silver" />{state.sleepChecked ? 'Still asleep. Try next turn.' : 'Flip a coin to wake up'}<span>↗</span></button>}
          {friendly && !isSelectedActive && <button className="grove-switch" onClick={() => { send({ type: 'retreat', target: selected.uid }); setMobilePanel(false) }} disabled={!isPlayer || state.retreated || !state.player.active.energy || state.player.active.status === 'asleep'}>Switch into the clearing <span>1 <EnergyIcon /> ↗</span></button>}
          {!friendly && <p className="grove-selection-note">Their side of the clearing. Choose one of your Pokémon to make a move.</p>}
        </>}
        <div className="grove-live-notice" role="status" aria-live="polite"><span>✦</span><p>{state.notice || cardHint}</p></div>
        <div className="grove-right-bottom"><button className="grove-album-button" onClick={() => setModal('album')}><span><b>06</b> The card collection</span><span>↗</span></button><div className="grove-mobile-appearance"><AppearanceOptions value={appearance} onChange={setAppearance} /></div><div className="grove-inspector-utilities"><button onClick={() => setModal('guide')}>? How to play</button><button onClick={toggleSound} aria-pressed={sound}>{sound ? '♪ Sound on' : '♪ Sound off'}</button></div><div className="grove-prototype-label"><i /> A PLAYABLE PIXEL-ART EXPERIMENT</div></div>
      </aside>
    </div>
    <div className="grove-mobile-bar">{selectedCard && <div className="grove-mobile-target-hint"><span>{cardHint}</span><button onClick={() => setHandIndex(null)}>Cancel ×</button></div>}<button onClick={() => { setSelectedUid(state.player.active.uid); setHandIndex(null); setMobilePanel(true) }}>Pokémon & attacks ↗</button><button disabled={!isPlayer} onClick={endTurn}>End turn →</button></div>

    {modal === 'album' && <Modal title="Six little personalities." onClose={() => setModal(null)} wide><p className="grove-modal-intro">A small cast, reimagined for a greener kind of game.</p><div className="grove-card-album">{Object.keys(POKEMON).map((species) => <PokemonCard key={species} species={species} />)}</div></Modal>}
    {modal === 'reference' && <Modal title="It started with a picture." onClose={() => setModal(null)}><p className="grove-modal-intro">The forest, the little sprites, the cards in the grass. Our starting point for Pocket Grove.</p><img className="grove-reference-image" src="/pixel-grove/reference.jpg" alt="Original pixel-art Pokémon card battle inspiration" /></Modal>}
    {modal === 'guide' && <Modal title="A little field guide." onClose={() => setModal(null)}><div className="grove-guide"><p>Take three prizes to win. Knock out an opposing Pokémon to take a prize. Pikachu ex is worth two!</p><div><b>01</b><section><h3>Pick a card. Pick a Pokémon.</h3><p>Choose a card in your hand, then its target on the field. Attach one Lightning Energy per turn. Play Basic Pokémon onto empty bench patches.</p></section></div><div><b>02</b><section><h3>A little growth goes a long way.</h3><p>Play Electrode onto Voltorb to evolve. Energy and damage stay attached; special conditions clear. Potion heals 30 HP.</p></section></div><div><b>03</b><section><h3>Wake, switch, or make a move.</h3><p>Pikachu starts asleep! Flip the silver coin once per turn: heads wakes it up. Sleeping Pokémon also get a wake-up flip between turns. Awake Pokémon can attack with enough Energy, or pay 1 Energy to retreat.</p></section></div><div><b>04</b><section><h3>Then let the grove answer.</h3><p>Attacking ends your turn. Your opponent attacks, attaches Energy, and evolves Koffing into Weezing. Poison deals 10 damage between turns. Draw a card when your next turn starts.</p></section></div><p className="grove-guide-footnote">A small, relaxed ruleset made for this six-Pokémon demo. Press Space to end a turn, or Escape to cancel a selection.</p></div></Modal>}
    {modal === 'reset' && <Modal title="A fresh patch of grass?" onClose={() => setModal(null)}><p className="grove-modal-intro">Start the battle over with a full hand and a very sleepy Pikachu.</p><button className="grove-end-turn" onClick={reset}>Start a fresh battle ↗</button></Modal>}
  </main>
}

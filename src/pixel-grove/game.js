// A deliberately small, self-contained ruleset for the pixel-art experiment.
// Card definitions and state transitions stay independent of the renderer.
export const POKEMON = {
  pikachu: {
    id: 'pikachu', name: 'Pikachu', suffix: 'ex', hp: 120, type: 'lightning', stage: 'Basic', art: 0,
    description: 'A little forest nap. A whole lot of electricity.',
    attacks: [
      { name: 'Spark', cost: 1, damage: 30, text: 'A bright little jolt.' },
      { name: 'Thunderbolt', cost: 3, damage: 70, discard: 1, text: 'Discard 1 attached Energy.' },
    ],
  },
  voltorb: {
    id: 'voltorb', name: 'Voltorb', hp: 50, type: 'lightning', stage: 'Basic', art: 1,
    description: 'Small, round, and positively charged.',
    attacks: [
      { name: 'Tackle', cost: 1, damage: 10, text: 'A surprisingly spirited bump.' },
      { name: 'Electro Ball', cost: 2, damage: 30, text: 'Roll a little thunder their way.' },
    ],
  },
  electrode: {
    id: 'electrode', name: 'Electrode', hp: 90, type: 'lightning', stage: 'Stage 1', evolvesFrom: 'voltorb', art: 2,
    description: 'All that energy had to go somewhere.',
    attacks: [
      { name: 'Rolling Tackle', cost: 1, damage: 20, text: 'A very enthusiastic roll.' },
      { name: 'Discharge', cost: 3, damage: 60, text: 'Let the sparks fly.' },
    ],
  },
  koffing: {
    id: 'koffing', name: 'Koffing', hp: 60, type: 'psychic', stage: 'Basic', art: 3,
    description: 'A happy cloud with a rather peculiar perfume.',
    attacks: [
      { name: 'Smog', cost: 1, damage: 10, status: 'poisoned', text: 'The opposing Pokémon is now Poisoned.' },
      { name: 'Tackle', cost: 2, damage: 20, text: 'A slightly wobbly bump.' },
    ],
  },
  weezing: {
    id: 'weezing', name: 'Weezing', hp: 100, type: 'psychic', stage: 'Stage 1', evolvesFrom: 'koffing', art: 4,
    description: 'Two heads, one very mischievous idea.',
    attacks: [
      { name: 'Twin Fumes', cost: 2, damage: 30, status: 'poisoned', text: 'The opposing Pokémon is now Poisoned.' },
      { name: 'Smog Burst', cost: 3, damage: 50, text: 'A purple puff of trouble.' },
    ],
  },
  jigglypuff: {
    id: 'jigglypuff', name: 'Jigglypuff', hp: 70, type: 'colorless', stage: 'Basic', art: 5,
    description: 'One more song before your afternoon nap.',
    attacks: [
      { name: 'Sing', cost: 1, damage: 0, status: 'asleep', text: 'The opposing Pokémon is now Asleep.' },
      { name: 'Pound', cost: 2, damage: 20, text: 'A tiny encore.' },
    ],
  },
}

export const ITEMS = {
  lightning: { id: 'lightning', name: 'Lightning Energy', kind: 'energy', type: 'lightning', objectArt: 1, description: 'Attach to one of your Pokémon. Once per turn.' },
  potion: { id: 'potion', name: 'Potion', kind: 'item', objectArt: 3, description: 'Heal 30 damage from one of your Pokémon.' },
}
export const cardDefinition = (id) => POKEMON[id] || ITEMS[id]
export const fullName = (pokemon) => `${POKEMON[pokemon.species].name}${POKEMON[pokemon.species].suffix ? ' ex' : ''}`
export const creature = (species, uid, energy = 0, extras = {}) => ({ species, uid, energy, damage: 0, status: null, ...extras })
export const hpLeft = (pokemon) => Math.max(0, POKEMON[pokemon.species].hp - pokemon.damage)

export function initialGroveState() {
  return {
    turn: 1, phase: 'player', winner: null, attached: false, retreated: false, sleepChecked: false,
    player: {
      active: creature('pikachu', 'p-pikachu', 2, { status: 'asleep' }),
      bench: [creature('voltorb', 'p-voltorb', 1), null, creature('electrode', 'p-electrode', 1)],
      hand: ['lightning', 'electrode', 'voltorb', 'potion', 'lightning'],
      deck: ['lightning', 'pikachu', 'potion', 'lightning', 'electrode', 'voltorb', 'lightning', 'potion', 'lightning', 'lightning'],
      prizes: 3, discard: 0,
    },
    opponent: {
      active: creature('jigglypuff', 'o-jigglypuff', 2),
      bench: [creature('weezing', 'o-weezing', 2), creature('koffing', 'o-koffing', 1), creature('jigglypuff', 'o-jigglypuff-bench', 1)],
      prizes: 3, discard: 0,
    },
    notice: 'Pikachu ex dozed off! Flip the silver coin to try waking up.',
    log: [{ id: 0, text: 'Jigglypuff’s song drifted through the grove. Pikachu ex fell asleep.' }],
    event: { id: 0, kind: 'start' },
    coin: null,
  }
}

function note(state, text, kind = 'note', extra = {}) {
  const id = state.event.id + 1
  state.notice = text
  state.log.unshift({ id, text })
  state.log = state.log.slice(0, 24)
  state.event = { id, kind, ...extra }
  return state
}
const findPokemon = (team, uid) => [team.active, ...team.bench].find((p) => p?.uid === uid)
const rejected = (state, text) => ({ ...state, notice: text })

function checkKnockouts(state) {
  for (const side of ['player', 'opponent']) {
    const team = state[side]
    if (hpLeft(team.active) > 0) continue
    const other = side === 'player' ? 'opponent' : 'player'
    const prizeCount = team.active.species === 'pikachu' ? 2 : 1
    state[other].prizes = Math.max(0, state[other].prizes - prizeCount)
    team.discard += 1
    const knockedOut = fullName(team.active)
    const index = team.bench.findIndex(Boolean)
    if (!state[other].prizes || index < 0) {
      state.phase = 'over'
      state.winner = other
      return note(state, `${knockedOut} fainted. ${other === 'player' ? 'You won the grove battle!' : 'Your opponent won this time.'}`, 'win')
    }
    team.active = team.bench[index]
    team.bench[index] = null
    note(state, `${knockedOut} fainted! ${fullName(team.active)} takes the clearing.`, 'knockout', { side })
  }
  return state
}

function betweenTurns(state, rolls = [1, 1]) {
  for (const [i, side] of ['player', 'opponent'].entries()) {
    const pokemon = state[side].active
    if (pokemon.status === 'poisoned') {
      pokemon.damage += 10
      note(state, `${fullName(pokemon)} took 10 poison damage.`, 'poison', { side })
    }
    if (pokemon.status === 'asleep' && rolls[i] >= 0.5) {
      pokemon.status = null
      note(state, `${fullName(pokemon)} woke up!`, 'wake', { side })
    }
  }
  return checkKnockouts(state)
}

export function groveReducer(current, action) {
  if (action.type === 'reset') return initialGroveState()
  if (current.phase === 'over') return current
  if (action.type === 'clear-notice') return { ...current, notice: '' }
  if (action.type !== 'opponent-turn' && current.phase !== 'player') return rejected(current, 'Your opponent is making a move.')
  const state = structuredClone(current)
  if (action.type === 'play-card') {
    const id = state.player.hand[action.index]
    if (!id) return current
    const card = cardDefinition(id)
    const pokemon = findPokemon(state.player, action.target)
    if (card.kind === 'energy') {
      if (!pokemon) return rejected(current, 'Choose one of your Pokémon to attach this Energy.')
      if (state.attached) return rejected(current, 'You already attached an Energy this turn.')
      pokemon.energy += 1
      state.attached = true
      state.player.hand.splice(action.index, 1)
      return note(state, `Lightning Energy attached to ${fullName(pokemon)}.`, 'energy', { uid: pokemon.uid })
    }
    if (id === 'potion') {
      if (!pokemon || !pokemon.damage) return rejected(current, 'Choose one of your Pokémon with damage to heal.')
      const healed = Math.min(30, pokemon.damage)
      pokemon.damage -= healed
      state.player.hand.splice(action.index, 1)
      state.player.discard += 1
      return note(state, `Potion healed ${healed} HP on ${fullName(pokemon)}.`, 'heal', { uid: pokemon.uid })
    }
    if (card.evolvesFrom) {
      if (!pokemon || pokemon.species !== card.evolvesFrom) return rejected(current, 'Electrode evolves from Voltorb. Choose a Voltorb in play.')
      pokemon.species = id
      pokemon.status = null
      state.player.hand.splice(action.index, 1)
      return note(state, 'Voltorb evolved into Electrode!', 'evolve', { uid: pokemon.uid })
    }
    if (!Number.isInteger(action.bench) || action.bench < 0 || action.bench > 2 || state.player.bench[action.bench]) return rejected(current, 'Choose an empty patch on your bench.')
    if (!['voltorb', 'pikachu'].includes(id)) return current
    const uid = `p-${id}-${state.event.id + 1}`
    state.player.bench[action.bench] = creature(id, uid)
    state.player.hand.splice(action.index, 1)
    return note(state, `${POKEMON[id].name}${id === 'pikachu' ? ' ex' : ''} joined your bench.`, 'play', { uid })
  }
  if (action.type === 'wake') {
    if (state.player.active.status !== 'asleep') return rejected(current, 'Your active Pokémon is already awake.')
    if (state.sleepChecked) return rejected(current, 'One wake-up coin per turn. Try again next turn.')
    const heads = action.roll >= 0.5
    state.sleepChecked = true
    state.coin = heads ? 'heads' : 'tails'
    if (heads) state.player.active.status = null
    return note(state, heads ? `${fullName(state.player.active)} woke up! Heads!` : 'Tails… still dreaming. You can evolve your bench or end your turn.', heads ? 'wake' : 'coin', { heads })
  }
  if (action.type === 'retreat') {
    if (state.retreated) return rejected(current, 'You already switched Pokémon this turn.')
    if (state.player.active.status === 'asleep') return rejected(current, 'Your sleeping Pokémon needs to wake up before retreating.')
    const index = state.player.bench.findIndex((p) => p?.uid === action.target)
    if (index < 0) return current
    if (!state.player.active.energy) return rejected(current, 'Your active Pokémon needs 1 Energy to retreat.')
    state.player.active.energy -= 1
    state.player.active.status = null
    ;[state.player.active, state.player.bench[index]] = [state.player.bench[index], state.player.active]
    state.retreated = true
    state.player.discard += 1
    return note(state, `${fullName(state.player.active)} moved into the clearing.`, 'retreat')
  }
  if (action.type === 'attack') {
    const pokemon = state.player.active
    const attack = POKEMON[pokemon.species].attacks[action.index]
    if (!attack) return current
    if (pokemon.status === 'asleep') return rejected(current, 'Your Pokémon is asleep. Flip the silver coin to try waking up.')
    if (pokemon.energy < attack.cost) return rejected(current, `${attack.name} needs ${attack.cost} attached Energy.`)
    state.opponent.active.damage += attack.damage
    if (attack.status) state.opponent.active.status = attack.status
    if (attack.discard) pokemon.energy = Math.max(0, pokemon.energy - attack.discard)
    note(state, `${fullName(pokemon)} used ${attack.name}${attack.damage ? ` for ${attack.damage} damage` : ''}!`, 'attack', { side: 'player', damage: attack.damage })
    checkKnockouts(state)
    if (state.phase === 'over') return state
    betweenTurns(state, action.rolls)
    if (state.phase !== 'over') state.phase = 'opponent'
    return state
  }
  if (action.type === 'end-turn') {
    note(state, 'You ended your turn. The grove rustles…', 'end-turn')
    betweenTurns(state, action.rolls)
    if (state.phase !== 'over') state.phase = 'opponent'
    return state
  }
  if (action.type === 'opponent-turn') {
    if (state.phase !== 'opponent') return current
    // The opponent uses only the same three named species and their evolution.
    if (state.turn >= 2) {
      const evolving = [state.opponent.active, ...state.opponent.bench].find((p) => p?.species === 'koffing')
      if (evolving) {
        evolving.species = 'weezing'
        evolving.status = null
        note(state, 'Your opponent evolved Koffing into Weezing!', 'evolve', { uid: evolving.uid })
      }
    }
    const pokemon = state.opponent.active
    pokemon.energy += 1
    if (pokemon.status !== 'asleep') {
      const attacks = POKEMON[pokemon.species].attacks
      const attack = pokemon.species === 'jigglypuff' && state.turn % 3 === 0 ? attacks[0] : [...attacks].reverse().find((a) => a.cost <= pokemon.energy)
      if (attack) {
        state.player.active.damage += attack.damage
        if (attack.status) state.player.active.status = attack.status
        note(state, `${fullName(pokemon)} used ${attack.name}${attack.damage ? ` for ${attack.damage} damage` : ''}${attack.status === 'asleep' ? '. Your Pokémon fell asleep' : ''}!`, 'attack', { side: 'opponent', damage: attack.damage })
      }
    } else note(state, `${fullName(pokemon)} is still fast asleep.`, 'note')
    checkKnockouts(state)
    if (state.phase === 'over') return state
    betweenTurns(state, action.rolls)
    if (state.phase === 'over') return state
    state.turn += 1
    state.phase = 'player'
    state.attached = false
    state.retreated = false
    state.sleepChecked = false
    state.coin = null
    const drawn = state.player.deck.shift()
    if (drawn) state.player.hand.push(drawn)
    // Empty bench spots are replenished slowly, keeping the demo alive.
    const benchIndex = state.opponent.bench.findIndex((p) => !p)
    if (benchIndex >= 0 && state.turn % 2 === 0) state.opponent.bench[benchIndex] = creature(state.turn % 4 === 0 ? 'jigglypuff' : 'koffing', `o-new-${state.turn}`, 1)
    state.notice = `Your turn${drawn ? ` · drew ${cardDefinition(drawn).name}` : ''}.`
    return state
  }
  return current
}

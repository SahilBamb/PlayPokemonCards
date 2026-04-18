import { useState, useEffect, useRef, createContext, useReducer, useContext} from 'react'
import { FaStar, FaArrowLeft, FaArrowRight, FaLeaf, FaFire, FaTint, FaBolt, FaBrain, FaFistRaised, FaMoon, FaCog, FaSyncAlt, FaFlask } from 'react-icons/fa'

import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { costMatch, getStyling, handleDragOver, isString, isObject, opposite } from './utils'

import ATTACKS from './attacks.json'

const TYPE_ICONS = {
  grass: {Icon: FaLeaf, bg: "bg-green-200"},
  fire: {Icon: FaFire, bg: "bg-red-200"},
  water: {Icon: FaTint, bg: "bg-blue-200"},
  lightning: {Icon: FaBolt, bg: "bg-yellow-200"},
  psychic: {Icon: FaBrain, bg: "bg-purple-200"},
  fighting: {Icon: FaFistRaised, bg: "bg-amber-400"},
  darkness: {Icon: FaMoon, bg: "bg-gray-200"},
  metal: {Icon: FaCog, bg: "bg-slate-200"},
  colorless: {Icon: FaStar, bg: "bg-slate-300"}
}

const STATUS_ICONS = {
  burned: { Icon: FaFire, bg: "bg-orange-300" },
  confused: { Icon: FaSyncAlt, bg: "bg-amber-200" },
  paralyzed: { Icon: FaBolt, bg: "bg-yellow-300" },
  poisoned: { Icon: FaFlask, bg: "bg-lime-300" }
}

const initialState = {
  p1 : {
    hand: Array.from({length: 5}).map(()=> {return {cardType: "energy", energy: "lightning"}}),
    mon: [{cardType:"monster", energyAttached:[], attacks:["Nuzzle"]}, undefined, undefined, undefined, undefined, undefined], //Array.from({length: 6}),
    deck: Array.from({length: 52}).map(()=> {return {cardType: "monster", energyAttached:[]}}),
    trash: [],
  },
  p2 : {
    hand: Array.from({length: 1}).map(()=> {return {cardType: "monster", energyAttached:[]}}),
    mon: Array.from({length: 6}).map(()=> {return {cardType: "monster", energyAttached:[]}}),
    deck: Array.from({length: 52}).map(()=> {return {cardType: "monster", energyAttached:[]}}),
    trash: []
  },
  effectsQueue : [],
  gameState: {turn: "p1", phase: "draw", turnNumber: 1, flags: {
    // energyAttached : false,
    // playedSupporter: false,
    // retreated: false,
    // attacked: false,
    // useAbility : {"pokemonId" : false}
  },
  },

  // pendingEffects: {
  //   prompt: "Choose an opponent benched Pokémon",
  //   valid : {
  //     id: ["all"],
  //     loc: ["mon"],
  //     player: ["p2"]
  //   }
  // }
}

function TypeIcon({ type, size = 16, className = '' }) {
  const Icon = type ? TYPE_ICONS[String(type).toLowerCase()]?.Icon : null
  const bg = type ? TYPE_ICONS[String(type).toLowerCase()]?.bg + " rounded-full" : ""
  if (!Icon) return null
  return <Icon size={size} className={bg}/>
}

function StatusIcon({ status, size = 16, className = '' }) {
  const entry = status ? STATUS_ICONS[String(status).toLowerCase()] : null
  if (!entry?.Icon) return null
  const Icon = entry.Icon
  const bg = (entry.bg || "") + " rounded-full"
  return <Icon size={size} className={bg} title={status}/>
}


const GameContext = createContext();

function printNestedObjects(o){
  return (
    <>
      {Object.entries(o).map(([key,val],b) => 
        {return <p>{key} : {!isObject(val) ? val : printNestedObjects(val)}</p>}
      )}
    </>
  )
}

function drawCard(state, action, numOfCards=1){
  const { player } = action;
  if (state[player].deck.length < numOfCards) {
    return state;
  }
  return {
    ...state,
    [player] : {
      ...state[player],
      hand : [...state[player].hand, ...state[player].deck.slice(0, numOfCards)],
      deck : state[player].deck.slice(numOfCards)
    }
  };
}

function attackMain(state, action, target, amount){
  const {id} = action;
  return {...{...state,
      [target] : { 
      ...state[target],
      mon : {
        ...state[target].mon,
        dc: (state[target].mon[id]?.dc ?? 0) + amount,
      }
  }}};
}

function attackAny(state, action, targetPlayer, amount, id){
  const newMon =
    state[targetPlayer].mon.toSpliced(id,1,{
      ...state[targetPlayer].mon[id],
      dc: (state[targetPlayer].mon[id]?.dc ?? 0) + amount,
    })
  return {...{...state,
      [target] : { 
      ...state[target],
      mon : newMon
  }}};
}

function DEAL_DAMAGE({state, action, amount, targetPos, target}){
  if (targetPos == "choose"){
    return attackAny(state, action, target, amount);
  }
  return attackAny(state, action, targetPlayer, amount, sId)
}

function PENDING_ACTION({state, action}){
  console.log("UPDATING PENDING ACTION");
  return {
    ...state,
    pendingEffects: {
      prompt: "Choose an opponent benched Pokémon",
      valid : {
        id: ["all"],
        loc: ["mon"],
        player: ["p2"]
      }
    }
  };
}

//TODO: Bug is that this is hardcoded to only discard from main (choose state can override)
function DISCARD_ENERGY({state, action, energyToDiscard}){
  const {loc, id, player} = state?.context?.target ?? {loc:"mon",id:0, player:action.player};
  let energies = [...state[player][loc][id].energyAttached];
  energyToDiscard.forEach(({energy,amount},idx) => {
    Array.from({length: amount}).forEach((_) => {
      console.log(energies.splice(energies.indexOf(energy),1));
    })
  })
  return {
    ...state,
    [player] : {
      ...state[player],
      [loc]: state[player][loc].toSpliced(id,1,{...state[player][loc][id], 
      energyAttached: energies})
    }
  }
}

function ADD_TO_CONTEXT({state, action, amount}){
  return {...state, 
    context: {
      ...state?.context,
      amount: amount
    }
  }
}

function INFLICT_STATUS({state, action, status, coinFlip=false}){
  const {loc, id, player} = state?.context?.target ?? {loc:"mon", id:0, player:opposite[action.player], action:action.status};
  if ((coinFlip) && (Math.random()>.5)){
    return state;
  }
  return {...state, 
    [player] : {
      ...state[player],
      [loc] : state[player][loc].toSpliced(id,1,{...state[player][loc][id], status: status})
    }
  }
}

function flipCoins({coins = 5}){
  const heads = Array.from({length: coins}).map((_) => (Math.random() > .5)).filter((_) => _).length;
  const tails = coins - heads;
  return {
    tails: tails,
    heads: heads
  }
}

function DEAL_DAMAGE_COIN_FLIP({state, action, amount, coinFlip, coins}){
  console.log(flipCoins({coins : coins}).heads)
  console.log(amount)

  const {loc, id, player} = state?.context?.target ?? {loc:"mon", id:0, player: opposite[action.player]};
  if (state?.context?.amount){
    amount = state.context.amount;
  }
  const newState = {...state, 
    [player] : {
      ...state[player],
      mon: state[player][loc].toSpliced(id,1,{...state[player][loc][id],
        dc: (state[player][loc][id]?.dc ?? 0) + (amount * flipCoins({coins : coins}).heads)
      })
    }
  }
  return newState;
}

const EFFECTS = {
  "DEAL_DAMAGE" : attack,
  "PENDING_ACTION": PENDING_ACTION, 
  "INFLICT_STATUS": INFLICT_STATUS,
  "DISCARD_ENERGY": DISCARD_ENERGY,
  "ADD_TO_CONTEXT": ADD_TO_CONTEXT,
  "DEAL_DAMAGE_COIN_FLIP": DEAL_DAMAGE_COIN_FLIP
}

//contains type -> loc(bench) id(0-4), player(p1/p2)
// pendingEffects: {
//   prompt: "Choose an opponent benched Pokémon",
//   valid : {
//     id: ["all"],
//     loc: ["mon"],
//     player: ["p2"]
//   }
// }

function Attack({name, player, energyAttached}){
  const {dmg, cost, target} = ATTACKS[name];
  const {targetPlayerRef, targetPos} = target;
  const {state, dispatch} = useContext(GameContext);
  const details = {attack: ATTACKS[name], 
                   target: (targetPlayerRef == "opp") ? opposite[player] : player,
                   energyAttached: energyAttached, 
                   player: player}

  function handleClick(){
    dispatch({type: "attack", ...details})
  }

  return (
    <div 
    onClick={handleClick}
    className=" w-full border flex justify-between p-1 hover:scale-150 transition cursor-pointer">
      <div className="flex flex-wrap w-5 items-center justify-center">
        {Object.keys(cost).map((c) => {
          return Array.from({length: cost[c]}).map((_) => <TypeIcon type={c} size={9} />)
          }
        )}
      </div>
      <div className="">{name}</div>
      <div className="">{dmg}</div>
  </div>
  )
}

function dropHandMon(state, action){
  console.log("DROPPING HAND INTO MON")
  if ((action.source.cardType == "energy") && (action.dest.cardType == "monster")){
    const energy = action.source.energy;
    let newState = {...state, 
      [action.source.player] : {...state[action.source.player], 
        [action.source.loc]: state[action.source.player][action.source.loc].toSpliced(action.source.id, 1), 
        }
      }
    
    newState = {...newState, 
      [action.dest.player] : {...newState[action.dest.player],
        [action.dest.loc]: state[action.dest.player][action.dest.loc].toSpliced(action.dest.id, 1, 
                //New Mon w/ Attached Energy
                {...state[action.dest.player][action.dest.loc][action.dest.id], 
                  energyAttached: [...state[action.dest.player][action.dest.loc][action.dest.id].energyAttached, energy]
                }) 
        }
      }

    return newState;
  }


  if ((action.source.cardType == "monster") && (action.dest.cardType == "empty")){
    let newState = {...state, 
      [action.source.player] : {...state[action.source.player], 
        [action.source.loc]: state[action.source.player][action.source.loc].toSpliced(action.source.id, 1), 
        }
      }
    
    newState = {...newState, 
      [action.dest.player] : {...newState[action.dest.player],
        [action.dest.loc]: state[action.dest.player][action.dest.loc].toSpliced(action.dest.id, 1, 
                //New Mon
                state[action.source.player][action.source.loc][action.source.id]) 
        }
      }

    return newState;
  }

  // console.log("Old STATE")
  // console.log(state)
  // console.log("New STATE")
  // console.log(newState)

  return state;
}

function costCheck(state, action){
  const {cost, effects} = action.attack;
  return (costMatch({cost: cost ?? {}, energyAttached: action?.energyAttached ?? []}));
}

//contains type -> loc(mon) id(0-4), player(p1/p2)
//click { "type": "PENDING_ACTION", "action": "CHOOSE_TARGET", "targetPos": "choose" },
//"amount": 20, "targetPos": "main" 
function attack({state, action, amount, self=false}){
  const {loc, id, player} = state?.context?.target ?? {loc:"mon", id:0, player: (self ? action.player : opposite[action.player])};
  if (state?.context?.amount){
    amount = state.context.amount;
  }
  const newState = {...state, 
    [player] : {
      ...state[player],
      mon: state[player][loc].toSpliced(id,1,{...state[player][loc][id],
        dc: (state[player][loc][id]?.dc ?? 0) + amount
      })
    }
  }
  return newState;
}

const REDUCER_ROUTER = {
  "clickdeck" : { default: drawCard },
  "drophandmon" : { default: dropHandMon}
}

REDUCER_ROUTER.getFunc = function(key) {
  if (!(key in this)){
    return (state, action) => {
      return state;
    }
  }
  console.log("FOUND REDUCER FOR: " + key)
  return this[key].default;
}


// const STATUS_ICONS = {
//   burned: { Icon: FaFire, bg: "bg-orange-300" },
//   confused: { Icon: FaSyncAlt, bg: "bg-amber-200" },
//   paralyzed: { Icon: FaBolt, bg: "bg-yellow-300" },
//   poisoned: { Icon: FaFlask, bg: "bg-lime-300" }
// }


// Components //

function Card({details}){

  const {state, dispatch} = useContext(GameContext);
  const styling = getStyling(details);
  const player = details?.player ?? "p1";
  // const type = details?.type ?? "monster";
  const {loc} = details; 

  function handleClick(){
    //contains type -> loc(mon) id(0-4), player(p1/p2)
    dispatch({type: 'click', ...details});
  }
  
  const handleDrop = (e) => {
    e.preventDefault();
    const dataJSON = e.dataTransfer.getData("application/json");
    const data = JSON.parse(dataJSON);
    //const dets = {sId: data.id, dId: details.id, player: details.player, cardType: data.cardType, energyAttached: data.energy}
    const dets2 = {source: data, dest: details}
    console.log("DROPPING DETAILS")
    console.log(dets2)
    //loc(mon) id(0-4), player(p1/p2)
   dispatch({...dets2, type: "drop"})
  };

  function handleDragStart(e, details){
    e.dataTransfer.setData("application/json", JSON.stringify(details));
  }

  const des = details?.des ?? "";
  const dc = details?.dc ?? 0;
  const status = details?.status ?? null;
  const energyAttached = details?.energyAttached ?? [];
  const attacks = details?.attacks ?? [];
  return (
    <div draggable={true}
    onDragOver={handleDragOver} 
    onDrop={handleDrop}
    onClick={handleClick}
    onDragStart={(e) => handleDragStart(e, details)} className="relative bg-white cursor-grab rounded-lg shadow-md p-4 h-50 w-35 hover:scale-125 hover:shrink-0 hover:z-3 transition" 
    style={{...styling}}>
      {(energyAttached.length > 0) && 
        <span className="absolute -bottom-2 -right-2 flex items-center gap-1 text-xs text-gray-600 rounded-full p-1">
          {energyAttached.map((e) => 
              {if (isString(e)){
                  return <TypeIcon type={e} size={12} />
                } else if (isObject(e)) {
                  return Object.keys(e).map((_) => 
                    Array.from({length: e[_]}).map((t) => <TypeIcon type={_} size={12} />))
                }
              }
          )}
        </span>}
      {dc>0 && <div className="absolute -top-3 -right-3 bg-red-500 text-white px-2 py-1 rounded-full">{dc}</div>}
      <div className="flex items-center justify-between">
        {/* <h3 className="text-lg font-bold">{name}</h3> */}
        <span className="flex items-center gap-1 text-xs text-gray-600">
          <TypeIcon type={details?.energy ?? details.cardType} size={14} />
          {details?.energy ? String(details.energy).charAt(0).toUpperCase() + String(details.energy).slice(1) : details?.cardType ?? "MISSING CARD TYPE"}
        </span>
      </div>
      <div className="w-full h-full flex items-center flex-col gap-1">
      <p className="text-gray-600 border w-full h-4/10">{des}</p>
        {details.cardType === "monster" && attacks.map((a,id) => 
          <Attack name={a} player={player} energyAttached={energyAttached} cost={a.cost} id={id}/>
        )}
      </div>
    </div>
  )
}

function CardSpot({details}){
  const {state, dispatch} = useContext(GameContext);
  const {player} = details;

  const handleDrop = (e) => {
    e.preventDefault();
    
    // Retrieve the stringified JSON
    const dataJSON = e.dataTransfer.getData("application/json");
    const data = JSON.parse(dataJSON);
    // const dets = {sId: data.id, dId: details.id, player: details.player, cardType: data.type}
    const dets2 = {source: data, dest: details}
    dispatch({type: "drop", ...dets2})
  };

  function handleClick(){
    //contains type -> loc(bench) id(0-4), player(p1/p2)
    console.log("CLICKING")
    console.log(details)
    dispatch({type: 'click', ...details});
  }

  const styling = getStyling(details)
  
  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver} 
      onDrop={handleDrop}
      className="bg-gray-200 rounded-lg shadow-md p-4 h-50 w-35 " style={{...styling}}>
        {details?.id}
    </div>
  )
}

function Deck({details}){
  const {player} = details;
  const {state, dispatch} = useContext(GameContext);
  const styling = getStyling(details);

  function handleClick(){
    dispatch({type: 'click', loc: 'deck', ...details});
  }

  return (
    <div
      style ={{...styling}}
      className="cursor-pointer flex shrink-0 items-center justify-center bg-green-200 rounded-lg shadow-md p-4 h-50 w-35 border-b-10 border-green-500 border-l-3 border-r-3"
      onClick={handleClick}>
      {state[player].deck.length}
    </div>
  )
}

function Trash({details}){
  const {state, dispatch} = useContext(GameContext);
  const {player} = details;

  function getTrash(){
    return state[player].trash.map((t) => 
      <Card details={{...t, name: "trash"}}/>
    )
  }

  return (
    (state[player].trash.length==0) ? <CardSpot details={{...details, name: "trash"}}/> : getTrash()
  )
}

function HanDeck({details}){
  const {player} = details;
  const {state, dispatch} = useContext(GameContext);
  return (
    <div className="flex gap-3 justify-between w-full min-w-0">
      <div className="flex min-w-0 max-w-full [&>*+*]:-ml-10">
        {Array.from(state[player].hand).map((_, id) => <Card key={id} details={{...details, ..._, loc: "hand", id: id, }}/>)}
      </div>
      <Deck details={details}/>
    </div>
  )
}

function Bench({details}){
  const {player, loc} = details;
  const {state, dispatch} = useContext(GameContext);
  return (
    <div className="flex gap-3 justify-between w-full">
      {/* Bench */}
      <div className="flex gap-2">
        {Array.from(state[player][loc].slice(1,)).map((_, i) => {
          return _ ?
          <Card details={{..._, ...details, loc: "mon", id: i+1}} /> :
          <CardSpot key={i} details={{...details, cardType: "empty", loc: "mon", id: i+1}} />
        })}
      </div>
      {/* <Trash details={details}/> */}
    </div>
  )
}

function Main({details}){
  const {player, loc, id} = details;
  const {state, dispatch} = useContext(GameContext);
  return (
    <div className="flex w-full justify-center">
      {state[player][loc][id]==null ? <CardSpot details={{...details}}/> : <Card details={{...details, ...state[player][loc][id]}}/> }
    </div>
  )
}

function clickValidation({state,loc,id,player}){
  const spot = state[player][loc][id];

  const locCheck = (state.pendingEffects.valid.loc == loc);
  const idCheck = state.pendingEffects.valid.id.includes("all") || state.pendingEffects.valid.id.includes(id);
  const playerCheck = (state.pendingEffects.valid.player.includes(player));  
  const nullCheck = ((state.pendingEffects.valid?.empty) || (spot));

  return (nullCheck) && 
         (locCheck) && 
         (idCheck) && 
         (playerCheck)
}


function Prompt(){
  const {state, dispatch} = useContext(GameContext);
  return (
      <div className="z-3 hover:opacity-40 transition-all bg-blue-200 p-2 rounded-md px-10 font-bold">{state?.pendingEffects?.prompt}</div>
  )
}

function App() {

  function reducer(state, action) {
    const {turn, phase} = state.gameState;
    let consumedPendingEffectsClick = false;

    if (state.pendingEffects){
      if (action.type == "click"){
        if (clickValidation({...action, state})){
          console.log("VALIDATION PASSED!")
          console.log("trying to load action:")
          console.log(action)
          console.log("Into Context")
          state = {...state,
            pendingEffects: null, 
            context: {
              target: {
                loc: action.loc,
                id: action.id,
                player: action.player
              }
            }
          };
          consumedPendingEffectsClick = true;
        } else {
          console.log("Click failed validation")
          return state;
        }
      }
    }

    if ((state.effectsQueue.length <= 0) && (!consumedPendingEffectsClick)){
      switch (action.type) {
        case 'click':
          return REDUCER_ROUTER.getFunc(`${action.type}${action.loc}`)(state, action)
        case 'drop':
          return REDUCER_ROUTER.getFunc(`${action.type}${action.source.loc}${action.dest.loc}`)(state, action)
        case 'attack':
          const {cost, name, effects} = action.attack;
          if (costCheck(state,action)){
            state = {...state, effectsQueue: [...state.effectsQueue, ...effects]};
          }
          break;
        default:
          break;
      }
    } else if (!consumedPendingEffectsClick) {
      console.log("Skipping event handling becuase active effectsQueue")
    }

    while ((state.effectsQueue.length > 0) && (!state?.pendingEffects)){
      const effect = state.effectsQueue[0];
      state = {...state, effectsQueue: state.effectsQueue.slice(1)};
      state = EFFECTS[effect.type]({...effect, action: {player: action.player}, state: state})
    }
    return state;
  }

  const [state, dispatch] = useReducer(reducer, initialState)

  return (
    <div className="relative flex gap-5 flex-col justify-center items-center w-full h-screen p-10">
      <GameContext.Provider value={{state, dispatch}}> 
      {/* <SearchableCards details={{cards: state.p1.deck}}/> */}

        <HanDeck details={{player: "p2", flipped: true}}/>
        <Bench details={{player: "p2", loc: "mon", flipped: true}}/>
        <Main details={{player: "p2", loc: "mon", id: 0, flipped: true}}/>
        
        <Prompt/>
        
        <Main details={{player: "p1", loc: "mon", id: 0}}/>
        <Bench details={{player: "p1", loc: "mon"}}/>
        <HanDeck details={{player: "p1"}}/>

      </GameContext.Provider>
    </div>
  )
}

export default App

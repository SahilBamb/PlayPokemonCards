import { useState, useEffect, useRef, createContext, useReducer, useContext} from 'react'
import { FaStar, FaArrowLeft, FaArrowRight, FaLeaf, FaFire, FaTint, FaBolt, FaBrain, FaFistRaised, FaMoon, FaCog, FaSyncAlt, FaFlask } from 'react-icons/fa'

import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

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

const initialState = {
  p1 : {
    hand: Array.from({length: 5}).map(()=> {return {type: "energy", energy: "lightning"}}),
    bench: Array.from({length: 5}),
    main: {attacks: ["Nuzzle"], energyAttached: ["lightning"], status: ["POISON"]}, //{attacks: [{name: "Tackle", dmg: 50}], energyAttached: ["fighting", "grass", "water"]}, 
    deck: Array.from({length: 52}).map(()=> {return {cardType: "monster", energyAttached:[]}}),
    trash: [],
  },
  p2 : {
    hand: Array.from({length: 1}).map(()=> {return {cardType: "monster", energyAttached:[]}}),
    bench: Array.from({length: 5}).map(()=> {return {cardType: "monster", energyAttached:[]}}),
    main: {attacks: ["Tackle"], energyAttached: [], status: ["BURN"]}, 
    deck: Array.from({length: 52}).map(()=> {return {cardType: "monster", energyAttached:[]}}),
    trash: []
  },
  gameState: {turn: "p1", phase: "draw", turnNumber: 1, flags: {
    // energyAttached : false,
    // playedSupporter: false,
    // retreated: false,
    // attacked: false,
    // useAbility : {"pokemonId" : false}
  },
  },

  pendingEffects: {
    prompt: "Choose an opponent benched Pokémon",
    valid : {
      id: ["all"],
      loc: ["bench"],
      player: ["p2"]
    }
  }
}

const opposite = {
  p1: "p2",
  p2: "p1"
}

const GameContext = createContext();

// Utils // 

function printNestedObjects(o){
  return (
    <>
      {Object.entries(o).map(([key,val],b) => 
        {return <p>{key} : {!isObject(val) ? val : printNestedObjects(val)}</p>}
      )}
    </>
  )
}

function getStyling(details){
  const flipped = (details?.flipped ?? false) ? "rotate(180deg)" : "";
  const bgColor = details?.bgcolor ?? "";
  return {
    "transform": flipped,
    "backgroundColor" : bgColor
  }
}

const handleDragOver = (e) => {
  e.preventDefault();
};

function isString(e){
  return ((e instanceof String) || (typeof e === 'string'));
}

function isObject(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

// Resolvers // 

function costMatch({cost={}, energyAttached=[]}){
  let cardCostCopy = {...cost}
  let extra = 0;
  energyAttached.forEach((_) => {
    if ((_ in cardCostCopy) && (cardCostCopy[_] > 0)){
      cardCostCopy[_] -= 1;
    } else if (_ === "doublecolorless") {
      extra+=2;
    } else {
      extra++;
    }
  });
  if ("colorless" in cardCostCopy){
    cardCostCopy["colorless"] -= extra;
  }
  return Object.values(cardCostCopy).every((_) => _<=0);
}

function iterateGameState(state, val){
  let s = state.gameState + val;
  if (s < 0) s+=state.possibleGameStates.length;
  if (s >= state.possibleGameStates.length) s=0;
  return {...state, gameState: s}
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

// function removeFromBench(state, player, sId){
//   console.log(state)
//   console.log({...state, 
//     [player] : {
//       ...state[player],
//       bench: state[player].bench.toSpliced(sId, 1, undefined)
//     }
//   }

//   )
//   return {...state, 
//     [player] : {
//       ...state[player],
//       bench: state[player].bench.toSpliced(sId, 1, null)
//     }
//   }
// }
// function removeFromMain(state, player){
//   console.log({...state, 
//     [player] : {
//       ...state[player],
//       main: null
//     }
//   })
//   return {...state, 
//     [player] : {
//       ...state[player],
//       main: null
//     }
//   }
// }

// function sendCardToTrash(state, player, sId){
//   let card = (sId === "main") ? state[player][sId] : state[player].bench[sId];
//   let newState = (sId == "bench") ? removeFromBench(state, player, sId) : removeFromMain(state, player);
//   return {...newState,
//           [player] : {
//             trash : [...trash, card],
//             ...newState.player
//           }
//         }
// }

function playMonster(state, action){
  const {sId, dId, cardType, energyAttached, player} = action;
  console.log("MONSTER")
  if (dId == "main"){
    return {...state, [player] : {...state[player], hand: state[player].hand.toSpliced(sId, 1), main: state[player].hand[sId]}}
  } 
  console.log("ATTACHING TO BENCH")
  return {...state, [player] : {...state[player], hand: state[player].hand.toSpliced(sId, 1), bench: state[player].bench.toSpliced(dId, 1, state[player].hand[sId])}}
}

function attachEnergy(state, action){
  const {sId, dId, cardType, energyAttached, player} = action;
  console.log("ACTIONN")
  console.log(action)
  if (((state[player].bench[dId] != null) || (dId == "main"))){
    if (dId == "main"){
      return {...state, [player] : {...state[player], hand: state[player].hand.toSpliced(sId, 1), main: {...state[player].main, energyAttached: [...state[player].main.energyAttached, energyAttached]}}}
    } else {
      return {...state, [player] : {...state[player], hand: state[player].hand.toSpliced(sId, 1), bench: state[player].bench.toSpliced(dId, 1, {...state[player].bench[dId], energyAttached: [...state[player].bench[dId].energyAttached, energyAttached]})}}
    }
  }
  return state;
}

// function attackBench(state, action){
//   return {...{...state,
//       [action.target] : { 
//       ...state[action.target],
//       bench : {
//         ...state[action.target].bench,
//         dc: (state[action.target].main?.dc ?? 0) + action.attack.dmg,
//       }
//   }}};
// }

function attackMain(state, action, target, amount){
  return {...{...state,
      [target] : { 
      ...state[target],
      main : {
        ...state[target].main,
        dc: (state[target].main?.dc ?? 0) + amount,
      }
  }}};
}


function attackAny(state, action, target, amount){
  const {id, loc, player} = state.context;
  const main = (loc == "main") ? {
    ...state[target].main,
    dc: (state[target].main?.dc ?? 0) + amount,
  } : state[target].main;

  const bench = (loc == "bench") ? 
    state[target].bench.toSpliced(id,1,{
      ...state[target].bench[id],
      dc: (state[target].bench[id]?.dc ?? 0) + amount,
    }) : state[target].bench;

  return {...{...state,
      [target] : { 
      ...state[target],
      main : main,
      bench : bench
  }}};
}

function DEAL_DAMAGE({state, action, amount, targetPos, target}){
  if (targetPos == "main"){
    return attackMain(state, action, target, amount);
  } else if (targetPos == "choose"){
    return attackAny(state, action, target, amount);
  }
  return attackBench(state, action, amount, sId)
}

const EFFECTS = {
  "DEAL_DAMAGE" : DEAL_DAMAGE
}

function Attack({name, player, energyAttached}){
  const {dmg, cost, target} = ATTACKS[name];
  const {targetPlayerRef, targetPos} = target;
  const {state, dispatch} = useContext(GameContext);
  const details = {attack: ATTACKS[name], 
                   target: (targetPlayerRef == "opp") ? opposite[player] : player,
                   energyAttached: energyAttached, 
                   player: player}

  function handleClick(){
    dispatch({type: "click", source: "mainattack", ...details})
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

function costCheckAndAttack(state, action){
  const {cost, effects} = action.attack;
  if (costMatch({cost: cost ?? {}, energyAttached: action?.energyAttached ?? []})){
    effects.forEach((a) => {
      state = EFFECTS[a.type]({state: state, target : action.target, ...a})
    })
  }
  return state;
}

const REDUCER_ROUTER = {
  "clickdeck" : { default: drawCard },
  "clickmainattack" : { default: costCheckAndAttack },
  "dropmonster" : { default: playMonster },
  "dropenergymonster" : { default: attachEnergy }
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

// Components //

function Card({details}){

  const {state, dispatch} = useContext(GameContext);
  const styling = getStyling(details);
  const player = details?.player ?? "p1";
  const type = details?.type ?? "monster";
  const {loc} = details; 

  function handleClick(){
    //contains type -> loc(bench) id(0-4), player(p1/p2)

    dispatch({type: 'click', ...details});
  }
  
  const handleDrop = (e) => {
    e.preventDefault();
    const dataJSON = e.dataTransfer.getData("application/json");
    const data = JSON.parse(dataJSON);
    const dets = {sId: data.id, dId: details.id, player: details.player, cardType: data.type, energyAttached: data.energy}
    dispatch({type: "drop", source: data.type, dest: type, ...dets})
  };

  function handleDragStart(e, details){
    e.dataTransfer.setData("application/json", JSON.stringify(details));
  }

  const name = details?.name ?? "";
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
    onDragStart={(e) => handleDragStart(e, { type: type, ...details })} className="relative bg-white cursor-grab rounded-lg shadow-md p-4 h-50 w-35 hover:scale-125 hover:shrink-0 hover:z-3 transition" style={{...styling}}>
      {(energyAttached.length > 0) && 
        <span className="absolute -bottom-2 -right-2 flex items-center gap-1 text-xs text-gray-600 rounded-full p-1">
          {energyAttached.map((e) => 
              {
                if (isString(e)){
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
        <h3 className="text-lg font-bold">{name}</h3>
        <span className="flex items-center gap-1 text-xs text-gray-600">
          <TypeIcon type={details?.energy ?? type} size={14} />
          {details?.energy ? String(details.energy).charAt(0).toUpperCase() + String(details.energy).slice(1) : type}
        </span>
      </div>
      <div className="w-full h-full flex items-center flex-col gap-1">
      <p className="text-gray-600 border w-full h-4/10">{des}</p>
        {type === "monster" && attacks.map((a) => 
          <Attack name={a} player={player} energyAttached={energyAttached} cost={a.cost}/>
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
    const dets = {sId: data.id, dId: details.id, player: details.player, cardType: data.type}
    dispatch({type: "drop", source: data.type, dest: "", ...dets})
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
    // dispatch({type: 'drawCard', player: details.player});
    dispatch({type: 'click', source: 'deck', ...details});
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

function SearchableCards({details}){
  const {cards} = details;
  const {state, dispatch} = useContext(GameContext);
  return (
    <div className="absolute w-full items-center z-2">
      <div className="flex gap-3 justify-between w-full min-w-0">
        <div className="flex min-w-0 max-w-full [&>*+*]:-ml-10">
          {cards.map((c) => 
            <Card/>
          )}
        </div>
      </div>
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

function TurnDebugger(){
  const {state, dispatch} = useContext(GameContext);
  return (
    <div className="absolute z-2 top-5 right-10 flex justify-center items-center">
      <FaArrowLeft size={30} onClick={()=> {dispatch({type: "turn", val: -1})}} className="bg-red-200 my-3 p-1 rounded-l-md hover:text-gray-200 hover:scale-150 active:scale-110 transition cursor-pointer" />
        <div className="bg-red-200 px-4 rounded-xl w-60">
          {printNestedObjects(state.gameState)}
        </div>
      <FaArrowRight size={30} onClick={()=> {dispatch({type: "turn", val: 1})}} className="bg-red-200 my-3 p-1 rounded-l-md hover:text-gray-200 hover:scale-150 active:scale-110 transition cursor-pointer" />
    </div>
  )
}

function HanDeck({details}){
  const {player} = details;
  const {state, dispatch} = useContext(GameContext);
  return (
    <div className="flex gap-3 justify-between w-full min-w-0">
      <div className="flex min-w-0 max-w-full [&>*+*]:-ml-10">
        {Array.from(state[player].hand).map((_, id) => <Card key={id} details={{...details, loc: "hand", id: id, ..._}}/>)}
      </div>
      <Deck details={details}/>
    </div>
  )
}

function BenchTrash({details}){
  const {player} = details;
  const {state, dispatch} = useContext(GameContext);
  return (
    <div className="flex gap-3 justify-between w-full">
      {/* Bench */}
      <div className="flex gap-2">
        {Array.from(state[player].bench).map((_, i) => {
          return _ ?
          <Card details={{..._, ...details, loc: "bench", id: i}} /> :
          <CardSpot key={i} details={{...details, loc: "bench", id: i}} />
        })}
      </div>
      <Trash details={details}/>
    </div>
  )
}

function Main({details}){
  const {player} = details;
  const {state, dispatch} = useContext(GameContext);
  return (
    <div className="flex w-full justify-center">
      {state[player].main==null ? <CardSpot details={{name: "main", ...details, id: "main"}}/> : <Card details={{name: "main", ...details,  id: "main", ...state[player].main}}/> }
    </div>
  )
}

function Prompt(){
  const {state, dispatch} = useContext(GameContext);
  return (
    state?.pendingEffects && 
      <div className="hover:opacity-40 transition-all absolute bottom-20 right-20 bg-blue-200 p-2 rounded-md px-10 font-bold">{state.pendingEffects?.prompt ?? "MISSING"}</div>
  )
}

function clickValidation({state,loc,id,player}){
  const spot = (loc == "main") ? state[player][id] : state[player][loc][id];

  const locCheck = (state.pendingEffects.valid.loc == loc);
  const idCheck = state.pendingEffects.valid.id.includes("all") || state.pendingEffects.valid.id.includes(id);
  const playerCheck = (state.pendingEffects.valid.player.includes(player));  
  const nullCheck = ((state.pendingEffects.valid?.empty) || (spot));

  return (nullCheck) && 
         (locCheck) && 
         (idCheck) && 
         (playerCheck)
}

function App() {

  function reducer(state, action) {
    const {turn, phase} = state.gameState;

    if (action.type == 'turn'){
      return iterateGameState(state, action.val);
    }

    if (state.pendingEffects){
      if (action.type == "click"){
        if (clickValidation({...action, state})){
          console.log("VALIDATION PASSED!")
          return {...state, pendingEffects: null, 
            context: {
              loc: action.loc,
              id: action.id,
              player: action.player
            }
          }

        } else {
          console.log("Click failed validation")
        }
      }

      console.log("ERROR - please select an option");
      return state;
    }

    // if (action.type == "drawCard"){
    //   return drawCard(action.player, state);
    // } 
    switch (action.type) {
      case 'click':
        return REDUCER_ROUTER.getFunc(`${action.type}${action.source}`)(state, action)
      case 'drop':
        return REDUCER_ROUTER.getFunc(`${action.type}${action.source}${action.dest}`)(state, action)
        
        // const {sId, dId, cardType, energyAttached, player} = action;
        // if (action.cardType == "monster"){
        //   return playMonster(state, action)
        // } else if (action.cardType == "energy"){
        //   return attachEnergy(state, action);
        // }
        // return state;
      // case 'dropCard':
      //   const {sId, dId, cardType, energyAttached, player} = action;
      //   if (action.cardType == "monster"){
      //     return playMonster(state, action)
      //   } else if (action.cardType == "energy"){
      //     return attachEnergy(state, action);
      //   }
      //   return state;
      case 'attack':
        const {cost, name, effects} = action.attack;
        state.effectsQueue.push(...effects);
        while (state.effectsQueue.length > 0){
          if (state.pendingEffects!==null){
            return state;
          }
          const effect = state.effectsQueue.shift();
          state = EFFECTS[effect.type]({state: state, target : action.target, ...effect})
        }
        return state;
        // if (costMatch({cost: cost ?? {}, energyAttached: action?.energyAttached ?? []})){
        //   effects.forEach((a) => {
        //     state = EFFECTS[a.type]({state: state, target : action.target, ...a})
        //   })
        //   return state;
        // } 
        console.log("Does not meet requirement for attack!")
        return state;     
      default:
        console.log("No matching error for key ")
        console.log("ACTION")
        console.log(action)
        console.log("STATE")
        console.log(state)
        return state;
        // throw new Error();
    
    }
    return state;
  }

  const [state, dispatch] = useReducer(reducer, initialState)

  console.log(state)

  return (
    <div className="relative flex gap-5 flex-col justify-center items-center w-full h-screen p-10">
      <GameContext.Provider value={{state, dispatch}}> 
      {/* <SearchableCards details={{cards: state.p1.deck}}/> */}


        <TurnDebugger/>

        <HanDeck details={{player: "p2", flipped: true}}/>
        <BenchTrash details={{player: "p2", flipped: true}}/>
        <Main details={{player: "p2", loc: "main", flipped: true}}/>
        
        <Prompt/>
        
        <Main details={{player: "p1", loc: "main"}}/>
        <BenchTrash details={{player: "p1"}}/>
        <HanDeck details={{player: "p1"}}/>

      </GameContext.Provider>
    </div>
  )
}

export default App

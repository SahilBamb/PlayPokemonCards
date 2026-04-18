const STATUS_ICONS = {
  // Use specific hex codes for a "palette" look
  burned: { bg: "#fca5a5" },    // Tailwind Red 300
  confused: { bg: "#fde68a" },  // Tailwind Amber 200
  paralyzed: { bg: "#fde047" }, // Tailwind Yellow 300
  poisoned: { bg: "#bef264" },  // Tailwind Lime 300
  // Added a custom palette red example:
  injured: { bg: "#e54e4e" }    // A softer, more "palette" red
}


  export function getStyling(details){
    const flipped = (details?.flipped ?? false) ? "rotate(180deg)" : "";
    const bgColor = (details?.status) ? STATUS_ICONS[details.status].bg : "";
    return {
      "transform": flipped,
      "backgroundColor" : bgColor
    }
  }
  
  export function handleDragOver(e) {
    e.preventDefault();
  };
  
  export function isString(e){
    return ((e instanceof String) || (typeof e === 'string'));
  }
  
  export function isObject(value) {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
}

export function costMatch({cost={}, energyAttached=[]}){
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

export const opposite = {
  p1: "p2",
  p2: "p1"
}
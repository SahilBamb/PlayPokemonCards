import catalog from "../data/openerCards.json" with { type: "json" };
import market from "../data/openerPrices.json" with { type: "json" };

export const OPENER_STORAGE_KEY = "ppc-card-opener-session-v1";
export const OPENER_WALLET_KEY = "ppc-card-opener-wallet-v1";
export const OPENER_STARTING_BALANCE_CENTS = 1000000;
const LEGACY_STARTING_BALANCE_CENTS = 100000;
export const OPENER_CARDS = catalog;
export const OPENER_BY_ID = Object.assign(
  Object.create(null),
  Object.fromEntries(catalog.map((card) => [card.id, card])),
);
export const OPENER_MARKET = market;
export const OPENER_SETS = [
  {
    id: "base1",
    name: "Base Set",
    year: 1999,
    accent: "#edb85d",
    commons: 5,
    energies: 2,
  },
  {
    id: "jungle",
    name: "Jungle",
    year: 1999,
    accent: "#8dcb85",
    commons: 7,
    energies: 0,
  },
  {
    id: "fossil",
    name: "Fossil",
    year: 1999,
    accent: "#dcad7c",
    commons: 7,
    energies: 0,
  },
  {
    id: "rocket",
    name: "Team Rocket",
    year: 2000,
    accent: "#d99fc8",
    commons: 7,
    energies: 0,
  },
  {
    id: "gym1",
    name: "Gym Heroes",
    year: 2000,
    accent: "#8bbbe6",
    commons: 6,
    energies: 1,
  },
  {
    id: "gym2",
    name: "Gym Challenge",
    year: 2000,
    accent: "#d19474",
    commons: 6,
    energies: 1,
  },
].map((set) => ({
  ...set,
  image: market.packs[set.id].image,
  priceCents: Math.round(market.packs[set.id].usd * 100),
  count: catalog.filter((card) => card.set === set.id).length,
}));

export const openerSet = (id) =>
  OPENER_SETS.find((set) => set.id === id) || OPENER_SETS[0];
export const isShinyPull = (card) => /Holo|Secret/.test(card.rarity);
export const quoteFor = (id) =>
  Object.hasOwn(market.cards, id) ? market.cards[id] : null;
export const saleValueCents = (id) => {
  const quote = quoteFor(id);
  return quote ? Math.round(quote.usd * 100) : null;
};
export const isBigHit = (card) =>
  isShinyPull(card) || (saleValueCents(card.id) ?? 0) >= 5000;
const upgradeBalance = (balance, grant) => {
  if (!Number.isSafeInteger(balance)) return OPENER_STARTING_BALANCE_CENTS;
  const result = balance + OPENER_STARTING_BALANCE_CENTS - grant;
  return Number.isSafeInteger(result) ? result : OPENER_STARTING_BALANCE_CENTS;
};
export const formatValue = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );

function draw(pool, count, rng) {
  const remaining = [...pool];
  const result = [];
  for (let i = 0; i < count; i += 1) {
    if (!remaining.length)
      throw new Error(
        "This set does not have enough cards for the simulated pack.",
      );
    const index = Math.min(
      remaining.length - 1,
      Math.max(0, Math.floor(rng() * remaining.length)),
    );
    result.push(remaining.splice(index, 1)[0]);
  }
  return result;
}

// Separate from Story Mode's five-card packs and collection rewards.
// Eleven-card simulated collation, with the rare kept last for the reveal.
export function rollOpenerPack(setId, rng = Math.random) {
  const set = openerSet(setId);
  const pool = catalog.filter((card) => card.set === set.id);
  const commons = pool.filter(
    (card) => card.rarity === "Common" && card.supertype !== "energy",
  );
  const uncommons = pool.filter((card) => card.rarity === "Uncommon");
  const energies = pool.filter(
    (card) => card.supertype === "energy" && card.rarity === "Common",
  );
  const rares = pool.filter((card) => card.rarity === "Rare");
  const holos = pool.filter(isShinyPull);
  const cards = [
    ...draw(commons, set.commons, rng),
    ...draw(uncommons, 3, rng),
    ...draw(energies, set.energies, rng),
  ];
  const rarePool =
    rng() < 1 / 3
      ? holos.length
        ? holos
        : rares
      : rares.length
        ? rares
        : holos;
  return [...cards, ...draw(rarePool, 1, rng)].map((card) => card.id);
}

// A recording seed reproduces a pack without changing ordinary random openings.
export function rollSeededOpenerPack(setId, seed, packNumber = 1) {
  const input = `${seed}:${setId}:${packNumber}`;
  let value = 2166136261;
  for (const char of input) {
    value ^= char.codePointAt(0);
    value = Math.imul(value, 16777619);
  }
  const random = () => {
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  return rollOpenerPack(setId, random);
}

export const initialOpenerSession = () => ({
  version: 1,
  setId: "base1",
  mode: "stack",
  showPrices: true,
  showInventoryPrices: true,
  packsOpened: 0,
  balanceCents: OPENER_STARTING_BALANCE_CENTS,
  startingBalanceCents: OPENER_STARTING_BALANCE_CENTS,
  purchase: null,
  stage: "sealed",
  pack: null,
  history: [],
});

export function restoreOpenerSession(raw) {
  const empty = initialOpenerSession();
  if (!raw) return empty;
  try {
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== 1 || !Array.isArray(saved.history))
      return empty;
    const keys = new Set();
    const history = saved.history
      .filter((entry) => {
        if (
          !entry ||
          !OPENER_BY_ID[entry.cardId] ||
          typeof entry.key !== "string" ||
          !Number.isInteger(entry.packNumber) ||
          entry.packNumber < 1 ||
          keys.has(entry.key)
        )
          return false;
        keys.add(entry.key);
        return true;
      })
      .map((entry) => {
        const clean = {
          key: entry.key,
          cardId: entry.cardId,
          packNumber: entry.packNumber,
        };
        if (Number.isSafeInteger(entry.soldForCents) && entry.soldForCents >= 0)
          clean.soldForCents = entry.soldForCents;
        return clean;
      });
    const restored = {
      ...empty,
      setId: openerSet(saved.setId).id,
      mode: saved.mode === "row" ? "row" : "stack",
      showPrices: saved.showPrices !== false,
      showInventoryPrices: saved.showInventoryPrices !== false,
      packsOpened: history.reduce(
        (largest, entry) => Math.max(largest, entry.packNumber),
        Number.isInteger(saved.packsOpened) && saved.packsOpened >= 0
          ? saved.packsOpened
          : 0,
      ),
      history,
      balanceCents: upgradeBalance(
        saved.balanceCents,
        Number.isSafeInteger(saved.startingBalanceCents)
          ? saved.startingBalanceCents
          : LEGACY_STARTING_BALANCE_CENTS,
      ),
    };
    if (
      saved.purchase &&
      OPENER_SETS.some((set) => set.id === saved.purchase.setId) &&
      Number.isSafeInteger(saved.purchase.priceCents) &&
      saved.purchase.priceCents > 0
    ) {
      restored.purchase = {
        setId: saved.purchase.setId,
        priceCents: saved.purchase.priceCents,
      };
      restored.setId = saved.purchase.setId;
    }
    const pack = saved.pack;
    if (
      pack &&
      Number.isInteger(pack.number) &&
      pack.number > 0 &&
      Array.isArray(pack.ids) &&
      pack.ids.length === 11 &&
      pack.ids.every((id) => OPENER_BY_ID[id]?.set === pack.setId) &&
      Array.isArray(pack.flipped) &&
      pack.flipped.length === pack.ids.length
    ) {
      const flipped = pack.flipped.map((value) => value === true);
      restored.pack = {
        number: pack.number,
        setId: openerSet(pack.setId).id,
        ids: pack.ids,
        flipped,
        index: Math.min(
          10,
          Math.max(0, Number.isInteger(pack.index) ? pack.index : 0),
        ),
        paidCents: Number.isSafeInteger(pack.paidCents) ? pack.paidCents : null,
      };
      restored.purchase = null;
      restored.packsOpened = Math.max(restored.packsOpened, pack.number);
      // Refreshing never strands a half-finished animation.
      restored.stage = flipped.every(Boolean) ? "complete" : "revealing";
    }
    return restored;
  } catch {
    return empty;
  }
}

export function loadOpenerSession() {
  let session;
  try {
    session = restoreOpenerSession(sessionStorage.getItem(OPENER_STORAGE_KEY));
  } catch {
    session = initialOpenerSession();
  }
  try {
    const wallet = JSON.parse(localStorage.getItem(OPENER_WALLET_KEY));
    if (
      [1, 2].includes(wallet?.version) &&
      Number.isSafeInteger(wallet.balanceCents)
    )
      session.balanceCents = upgradeBalance(
        wallet.balanceCents,
        wallet.version === 1
          ? LEGACY_STARTING_BALANCE_CENTS
          : Number.isSafeInteger(wallet.startingBalanceCents)
            ? wallet.startingBalanceCents
            : OPENER_STARTING_BALANCE_CENTS,
      );
  } catch {
    /* The in-memory wallet remains available when storage is blocked. */
  }
  return session;
}

export function saveOpenerSession(session) {
  try {
    sessionStorage.setItem(OPENER_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* The in-memory session stays usable if browser storage is full. */
  }
  try {
    localStorage.setItem(
      OPENER_WALLET_KEY,
      JSON.stringify({
        version: 2,
        balanceCents: session.balanceCents,
        startingBalanceCents: OPENER_STARTING_BALANCE_CENTS,
      }),
    );
  } catch {
    /* Keep the simulated wallet usable in memory. */
  }
}

export function openerReducer(state, action) {
  if (action.type === "sell" || action.type === "sell_all") {
    const keys =
      action.type === "sell"
        ? new Set([action.key])
        : Array.isArray(action.keys)
          ? new Set(action.keys)
          : null;
    let credit = 0;
    let sold = 0;
    const history = state.history.map((entry) => {
      const value = saleValueCents(entry.cardId);
      if (
        entry.soldForCents !== undefined ||
        value === null ||
        (keys && !keys.has(entry.key))
      )
        return entry;
      credit += value;
      sold += 1;
      return { ...entry, soldForCents: value };
    });
    if (!sold || !Number.isSafeInteger(state.balanceCents + credit))
      return state;
    return { ...state, history, balanceCents: state.balanceCents + credit };
  }
  if (action.type === "purchase") {
    if (!["sealed", "complete"].includes(state.stage) || state.purchase)
      return state;
    const set = OPENER_SETS.find((item) => item.id === action.id);
    if (!set || !Number.isSafeInteger(set.priceCents) || set.priceCents <= 0)
      return state;
    return {
      ...state,
      setId: set.id,
      balanceCents: state.balanceCents - set.priceCents,
      purchase: { setId: set.id, priceCents: set.priceCents },
      stage: "sealed",
      pack: null,
    };
  }
  if (action.type === "set")
    return state.purchase
      ? state
      : { ...state, setId: openerSet(action.id).id };
  if (action.type === "inventory_prices")
    return { ...state, showInventoryPrices: !state.showInventoryPrices };
  if (action.type === "prices")
    return { ...state, showPrices: !state.showPrices };
  if (action.type === "mode") {
    if (!["row", "stack"].includes(action.mode)) return state;
    const firstHidden =
      state.pack?.flipped.findIndex((flipped) => !flipped) ?? -1;
    return {
      ...state,
      mode: action.mode,
      pack: state.pack
        ? {
            ...state.pack,
            index: firstHidden < 0 ? state.pack.ids.length - 1 : firstHidden,
          }
        : null,
    };
  }
  if (action.type === "open") {
    if (
      state.stage !== "sealed" ||
      !state.purchase ||
      state.purchase.setId !== state.setId
    )
      return state;
    if (
      !Array.isArray(action.ids) ||
      action.ids.length !== 11 ||
      action.ids.some(
        (id) => !OPENER_BY_ID[id] || OPENER_BY_ID[id].set !== state.setId,
      )
    )
      return state;
    const number = state.packsOpened + 1;
    return {
      ...state,
      packsOpened: number,
      stage: action.instant ? "revealing" : "tearing",
      purchase: null,
      pack: {
        number,
        setId: state.setId,
        ids: action.ids,
        flipped: action.ids.map(() => false),
        index: 0,
        paidCents: state.purchase.priceCents,
      },
    };
  }
  if (action.type === "advance") {
    if (state.stage !== action.from) return state;
    if (state.stage === "tearing") return { ...state, stage: "dealing" };
    if (state.stage === "dealing") return { ...state, stage: "revealing" };
    return state;
  }
  if (action.type === "reveal") {
    const pack = state.pack;
    const index = action.index;
    if (
      state.stage !== "revealing" ||
      !pack ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= pack.ids.length ||
      pack.flipped[index]
    )
      return state;
    if (state.mode === "stack" && index !== pack.index) return state;
    const flipped = pack.flipped.map((value, i) => value || i === index);
    return {
      ...state,
      stage: flipped.every(Boolean) ? "complete" : state.stage,
      pack: { ...pack, flipped },
      history: [
        ...state.history,
        {
          key: `${pack.number}:${index}`,
          cardId: pack.ids[index],
          packNumber: pack.number,
        },
      ],
    };
  }
  if (action.type === "next") {
    if (!state.pack || !state.pack.flipped[state.pack.index]) return state;
    const index = state.pack.flipped.findIndex(
      (flipped, i) => i > state.pack.index && !flipped,
    );
    return index < 0 ? state : { ...state, pack: { ...state.pack, index } };
  }
  if (action.type === "clear")
    return {
      ...initialOpenerSession(),
      setId: state.setId,
      mode: state.mode,
      showPrices: state.showPrices,
      showInventoryPrices: state.showInventoryPrices,
      balanceCents: state.balanceCents,
      purchase: state.purchase,
    };
  return state;
}

export function openedValue(entries) {
  let amount = 0;
  let priced = 0;
  for (const entry of entries) {
    const quote = quoteFor(entry.cardId);
    if (quote) {
      amount += quote.usd;
      priced += 1;
    }
  }
  return { amount, priced, total: entries.length };
}

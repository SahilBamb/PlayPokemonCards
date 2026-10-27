import test from "node:test";
import assert from "node:assert/strict";
import {
  OPENER_BY_ID,
  OPENER_CARDS,
  OPENER_MARKET,
  OPENER_SETS,
  OPENER_STORAGE_KEY,
  OPENER_WALLET_KEY,
  OPENER_STARTING_BALANCE_CENTS,
  initialOpenerSession,
  isShinyPull,
  loadOpenerSession,
  openedValue,
  openerReducer,
  quoteFor,
  restoreOpenerSession,
  rollOpenerPack,
  rollSeededOpenerPack,
  saveOpenerSession,
  saleValueCents,
} from "../src/lib/cardOpener.js";

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const open = (
  state = { ...initialOpenerSession(), mode: "row" },
  instant = true,
) => {
  const paid =
    state.purchase || !["sealed", "complete"].includes(state.stage)
      ? state
      : openerReducer(state, { type: "purchase", id: state.setId });
  return openerReducer(paid, {
    type: "open",
    ids: rollOpenerPack(paid.setId, rng(9)),
    instant,
  });
};

test("all six sets produce eleven cards with the expected mix and rare last", () => {
  for (const set of OPENER_SETS) {
    for (let seed = 1; seed < 40; seed += 1) {
      const ids = rollOpenerPack(set.id, rng(seed));
      const cards = ids.map((id) => OPENER_BY_ID[id]);
      assert.equal(cards.length, 11);
      assert.ok(cards.every((card) => card.set === set.id));
      assert.equal(
        cards.filter(
          (card) => card.supertype === "energy" && card.rarity === "Common",
        ).length,
        set.energies,
      );
      assert.equal(
        cards.filter((card) => card.rarity === "Uncommon").length,
        3,
      );
      assert.equal(
        cards.filter(
          (card) => card.rarity === "Common" && card.supertype !== "energy",
        ).length,
        set.commons,
      );
      assert.match(cards.at(-1).rarity, /Rare/);
      assert.equal(new Set(ids).size, 11, "no duplicate cards within a pack");
    }
  }
});

test("rare rolls can produce both regular and holo cards", () => {
  const rare = OPENER_BY_ID[rollOpenerPack("base1", () => 0.95).at(-1)];
  const holo = OPENER_BY_ID[rollOpenerPack("base1", () => 0.1).at(-1)];
  assert.equal(rare.rarity, "Rare");
  assert.ok(isShinyPull(holo));
});

test("prices are sourced USD market quotes with explicit printings", () => {
  assert.equal(OPENER_MARKET.currency, "USD");
  assert.ok(Date.parse(OPENER_MARKET.updatedAt));
  assert.ok(
    Object.keys(OPENER_MARKET.cards).length > OPENER_CARDS.length * 0.95,
  );
  for (const quote of Object.values(OPENER_MARKET.cards)) {
    assert.ok(Number.isFinite(quote.usd) && quote.usd >= 0);
    assert.ok(
      ["Normal", "Holofoil", "Unlimited", "Unlimited Holofoil"].includes(
        quote.variant,
      ),
    );
    assert.match(quote.url, /^https:\/\/www\.tcgplayer\.com\/product\//);
  }
  assert.equal(quoteFor("missing"), null);
  assert.equal(quoteFor("toString"), null);
});

test("opening is counted once, starts the tear, and adds no unopened cards to history", () => {
  let state = open(initialOpenerSession(), false);
  assert.equal(state.stage, "tearing");
  assert.equal(state.packsOpened, 1);
  assert.equal(state.history.length, 0);
  assert.deepEqual(open(state), state);
  assert.equal(openerReducer(state, { type: "reveal", index: 0 }), state);
  state = openerReducer(state, { type: "advance", from: "tearing" });
  assert.equal(state.stage, "dealing");
  assert.equal(
    openerReducer(state, { type: "advance", from: "tearing" }),
    state,
  );
  state = openerReducer(state, { type: "advance", from: "dealing" });
  assert.equal(state.stage, "revealing");
});

test("row cards can be revealed in any order and only once", () => {
  const original = open();
  let state = openerReducer(original, { type: "reveal", index: 10 });
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].cardId, state.pack.ids[10]);
  assert.equal(state.pack.flipped[10], true);
  assert.equal(original.pack.flipped[10], false);
  assert.equal(openerReducer(state, { type: "reveal", index: 10 }), state);
  assert.equal(openerReducer(state, { type: "reveal", index: -1 }), state);
  state = openerReducer(state, { type: "reveal", index: 2 });
  assert.equal(state.history.length, 2);
});

test("stack cards remain visible until the player explicitly continues", () => {
  let state = open({ ...initialOpenerSession(), mode: "stack" });
  assert.equal(openerReducer(state, { type: "next" }), state);
  assert.equal(openerReducer(state, { type: "reveal", index: 1 }), state);
  state = openerReducer(state, { type: "reveal", index: 0 });
  assert.equal(state.pack.index, 0);
  assert.equal(state.history.length, 1);
  state = openerReducer(state, { type: "next" });
  assert.equal(state.pack.index, 1);
  assert.equal(state.pack.flipped[1], false);
  assert.equal(state.history.length, 1);
});

test("switching reveal mode preserves all pulls and starts at the first hidden card", () => {
  let state = open();
  state = openerReducer(state, { type: "reveal", index: 0 });
  state = openerReducer(state, { type: "reveal", index: 2 });
  state = openerReducer(state, { type: "mode", mode: "stack" });
  assert.equal(state.pack.index, 1);
  assert.equal(state.history.length, 2);
  state = openerReducer(state, { type: "mode", mode: "row" });
  assert.equal(state.pack.flipped[2], true);
});

test("set selection changes the next pack without destroying the current pack", () => {
  let state = open();
  const ids = state.pack.ids;
  state = openerReducer(state, { type: "set", id: "jungle" });
  assert.equal(state.setId, "jungle");
  assert.equal(state.pack.setId, "base1");
  assert.deepEqual(state.pack.ids, ids);
});

test("new sessions default to stack and restoration preserves an explicit row preference", () => {
  assert.equal(initialOpenerSession().mode, "stack");
  for (const mode of [undefined, "invalid", "stack", "row"]) {
    const restored = restoreOpenerSession(
      JSON.stringify({ ...initialOpenerSession(), mode }),
    );
    assert.equal(restored.mode, mode === "row" ? "row" : "stack");
  }
});

test("buying a shop pack reserves a sealed wrapper and cannot replace an unfinished pack", () => {
  let state = openerReducer({ ...initialOpenerSession(), mode: "row" }, {
    type: "purchase",
    id: "jungle",
  });
  assert.equal(state.setId, "jungle");
  assert.equal(state.stage, "sealed");
  assert.equal(state.packsOpened, 0);
  state = open(state);
  assert.equal(openerReducer(state, { type: "purchase", id: "fossil" }), state);
  for (let index = 0; index < 11; index += 1)
    state = openerReducer(state, { type: "reveal", index });
  state = openerReducer(state, { type: "purchase", id: "fossil" });
  assert.equal(state.pack, null);
  assert.equal(state.stage, "sealed");
  assert.equal(state.setId, "fossil");
  assert.equal(state.history.length, 11);
  assert.equal(state.packsOpened, 1);
});

test("completing a pack permits another pack while preserving session history", () => {
  let state = open();
  for (let index = 0; index < 11; index += 1)
    state = openerReducer(state, { type: "reveal", index });
  assert.equal(state.stage, "complete");
  assert.equal(state.history.length, 11);
  state = openerReducer(state, { type: "set", id: "fossil" });
  state = open(state);
  assert.equal(state.pack.setId, "fossil");
  assert.equal(state.packsOpened, 2);
  assert.equal(state.history.length, 11);
  state = openerReducer(state, { type: "reveal", index: 0 });
  assert.equal(state.history.length, 12);
  assert.equal(new Set(state.history.map((entry) => entry.key)).size, 12);
});

test("hiding prices changes no cards, counts, or reveal state", () => {
  const state = openerReducer(open(), { type: "reveal", index: 0 });
  const next = openerReducer(state, { type: "prices" });
  assert.equal(next.showPrices, false);
  assert.deepEqual(next.history, state.history);
  assert.deepEqual(next.pack, state.pack);
});

test("only revealed cards contribute to displayed values, and unavailable quotes stay unknown", () => {
  assert.deepEqual(openedValue([]), { amount: 0, priced: 0, total: 0 });
  const state = openerReducer(open(), { type: "reveal", index: 0 });
  assert.equal(openedValue(state.history).total, 1);
  assert.equal(
    openedValue(state.history).amount,
    quoteFor(state.history[0].cardId).usd,
  );
  assert.deepEqual(openedValue([{ cardId: "unknown" }]), {
    amount: 0,
    priced: 0,
    total: 1,
  });
});

test("refresh restores cards and preferences and recovers interrupted animations", () => {
  let state = open(initialOpenerSession(), false);
  assert.equal(restoreOpenerSession(JSON.stringify(state)).stage, "revealing");
  state = openerReducer(open(), { type: "reveal", index: 0 });
  state = openerReducer(state, { type: "prices" });
  const restored = restoreOpenerSession(JSON.stringify(state));
  assert.equal(restored.showPrices, false);
  assert.deepEqual(restored.history, state.history);
  assert.deepEqual(restored.pack, state.pack);
});

test("bad storage and unknown cards are rejected without a crash", () => {
  for (const raw of ["broken", "{}", "null", '{"version":2}', "[1,2]"])
    assert.deepEqual(restoreOpenerSession(raw), initialOpenerSession());
  const state = {
    ...initialOpenerSession(),
    history: [null, { cardId: "toString", key: "1:0", packNumber: 1 }],
  };
  assert.equal(restoreOpenerSession(JSON.stringify(state)).history.length, 0);
  assert.doesNotThrow(() => saveOpenerSession(state));
  assert.deepEqual(loadOpenerSession(), initialOpenerSession());
});

test("clear resets the simulated session while retaining the selected controls", () => {
  const state = { ...open(), mode: "stack", setId: "gym2", showPrices: false };
  const cleared = openerReducer(state, { type: "clear" });
  assert.equal(cleared.pack, null);
  assert.equal(cleared.history.length, 0);
  assert.equal(cleared.packsOpened, 0);
  assert.equal(cleared.setId, "gym2");
  assert.equal(cleared.mode, "stack");
  assert.equal(cleared.showPrices, false);
});

test("pack prices match sourced unlimited products and include no invented quotes", () => {
  for (const set of OPENER_SETS) {
    const quote = OPENER_MARKET.packs[set.id];
    assert.ok(set.priceCents > 0 && Number.isSafeInteger(set.priceCents));
    assert.equal(set.priceCents, Math.round(quote.usd * 100));
    assert.match(quote.name, /Unlimited/);
    assert.match(quote.source, new RegExp(`/product/${quote.productId}/`));
    assert.equal(quote.variant, "Normal");
  }
});

test("new players start with simulated money and confirmed purchases can take it negative", () => {
  const base = OPENER_SETS.find((set) => set.id === "base1");
  const jungle = OPENER_SETS.find((set) => set.id === "jungle");
  let state = { ...initialOpenerSession(), mode: "row" };
  assert.equal(state.balanceCents, OPENER_STARTING_BALANCE_CENTS);
  assert.equal(state.balanceCents, 1000000);
  const unpurchased = openerReducer(state, {
    type: "open",
    ids: rollOpenerPack("base1"),
    instant: true,
  });
  assert.equal(unpurchased, state, "opening cannot bypass the purchase");
  state = openerReducer(state, {
    type: "purchase",
    id: "base1",
    priceCents: 1,
  });
  assert.equal(
    state.balanceCents,
    1000000 - base.priceCents,
    "the cached price controls the charge",
  );
  assert.equal(
    openerReducer(state, { type: "purchase", id: "base1" }),
    state,
    "duplicate confirms cannot charge twice",
  );
  state = open(state);
  for (let i = 0; i < 11; i++)
    state = openerReducer(state, { type: "reveal", index: i });
  state = { ...state, balanceCents: 1 };
  const balance = state.balanceCents;
  state = openerReducer(state, { type: "purchase", id: "jungle" });
  assert.equal(state.balanceCents, balance - jungle.priceCents);
  assert.ok(state.balanceCents < 0, "a purchase is allowed below zero");
  state = open(state);
  for (let i = 0; i < 11; i++)
    state = openerReducer(state, { type: "reveal", index: i });
  const debt = state.balanceCents;
  state = openerReducer(state, { type: "purchase", id: "jungle" });
  assert.equal(
    state.balanceCents,
    debt - jungle.priceCents,
    "existing debt does not block another purchase",
  );
});

test("closing or clearing a session cannot refill the wallet or charge a reserved pack twice", () => {
  const storage = new Map();
  const session = new Map();
  const oldLocal = globalThis.localStorage;
  const oldSession = globalThis.sessionStorage;
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.sessionStorage = {
    getItem: (key) => session.get(key) ?? null,
    setItem: (key, value) => session.set(key, value),
  };
  try {
    let state = openerReducer(initialOpenerSession(), {
      type: "purchase",
      id: "gym2",
    });
    const balance = state.balanceCents;
    saveOpenerSession(state);
    state = loadOpenerSession();
    assert.equal(state.stage, "sealed");
    assert.equal(state.purchase.setId, "gym2");
    assert.equal(state.balanceCents, balance);
    state = openerReducer(state, { type: "clear" });
    assert.equal(state.balanceCents, balance);
    assert.equal(
      state.purchase.setId,
      "gym2",
      "clearing the gallery keeps an unopened paid pack",
    );
    state = open(state);
    assert.equal(state.balanceCents, balance, "ripping does not charge again");
    state = openerReducer(state, { type: "reveal", index: 0 });
    assert.equal(
      state.balanceCents,
      balance,
      "revealed card values are not wallet credits",
    );
    saveOpenerSession(state);
    assert.ok(storage.has(OPENER_WALLET_KEY));
    session.delete(OPENER_STORAGE_KEY);
    assert.equal(
      loadOpenerSession().balanceCents,
      balance,
      "a new tab retains the wallet",
    );
    storage.set(
      OPENER_WALLET_KEY,
      JSON.stringify({ version: 1, balanceCents: -12345 }),
    );
    assert.equal(loadOpenerSession().balanceCents, 887655);
    storage.set(OPENER_WALLET_KEY, "broken");
    assert.equal(loadOpenerSession().balanceCents, 1000000);
  } finally {
    if (oldLocal === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = oldLocal;
    if (oldSession === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = oldSession;
  }
});

test("older $1,000 wallets receive the $9,000 increase only once and preserve spending", () => {
  const storage = new Map([
    [OPENER_WALLET_KEY, JSON.stringify({ version: 1, balanceCents: 8354 })],
  ]);
  const sessions = new Map();
  const previousLocal = globalThis.localStorage;
  const previousSession = globalThis.sessionStorage;
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.sessionStorage = {
    getItem: (key) => sessions.get(key) ?? null,
    setItem: (key, value) => sessions.set(key, value),
  };
  try {
    const migrated = loadOpenerSession();
    assert.equal(migrated.balanceCents, 908354);
    saveOpenerSession(migrated);
    assert.equal(JSON.parse(storage.get(OPENER_WALLET_KEY)).version, 2);
    assert.equal(loadOpenerSession().balanceCents, 908354);
    sessions.clear();
    assert.equal(loadOpenerSession().balanceCents, 908354);
    const legacy = { ...initialOpenerSession(), balanceCents: -12345 };
    delete legacy.startingBalanceCents;
    assert.equal(
      restoreOpenerSession(JSON.stringify(legacy)).balanceCents,
      887655,
    );
  } finally {
    if (previousLocal === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousLocal;
    if (previousSession === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previousSession;
  }
});

test("individual sales credit each revealed copy once without changing the pack", () => {
  let state = open();
  assert.equal(
    openerReducer(state, { type: "sell", key: "1:0" }),
    state,
    "hidden cards cannot be sold",
  );
  state = openerReducer(state, { type: "reveal", index: 0 });
  const entry = state.history[0];
  const before = state.balanceCents;
  const pack = state.pack;
  state = openerReducer(state, { type: "sell", key: entry.key });
  assert.equal(state.balanceCents, before + saleValueCents(entry.cardId));
  assert.equal(state.history[0].soldForCents, saleValueCents(entry.cardId));
  assert.deepEqual(state.pack, pack);
  assert.equal(openerReducer(state, { type: "sell", key: entry.key }), state);
  const restored = restoreOpenerSession(JSON.stringify(state));
  assert.equal(restored.history[0].soldForCents, state.history[0].soldForCents);
  assert.equal(
    openerReducer(restored, { type: "sell", key: entry.key }),
    restored,
  );
});

test("bulk sales use the requested copies and skip sold cards or unavailable quotes", () => {
  let state = open();
  for (let index = 0; index < 11; index++)
    state = openerReducer(state, { type: "reveal", index });
  const before = state.balanceCents;
  const selected = state.history.slice(0, 3);
  const amount = selected.reduce(
    (sum, entry) => sum + saleValueCents(entry.cardId),
    0,
  );
  state = openerReducer(state, {
    type: "sell_all",
    keys: selected.map((entry) => entry.key),
  });
  assert.equal(state.balanceCents, before + amount);
  assert.equal(
    state.history.filter((entry) => entry.soldForCents !== undefined).length,
    3,
  );
  const after = state.balanceCents;
  const remaining = state.history.filter(
    (entry) => entry.soldForCents === undefined,
  );
  state = openerReducer(state, { type: "sell_all" });
  assert.equal(
    state.balanceCents,
    after +
      remaining.reduce((sum, entry) => sum + saleValueCents(entry.cardId), 0),
  );
  assert.equal(openerReducer(state, { type: "sell_all" }), state);
  const missing = OPENER_CARDS.find((card) => saleValueCents(card.id) === null);
  const unavailable = {
    ...initialOpenerSession(),
    history: [{ key: "1:0", packNumber: 1, cardId: missing.id }],
  };
  assert.equal(
    openerReducer(unavailable, { type: "sell", key: "1:0" }),
    unavailable,
  );
});


test("inventory prices are independent, survive restoration, and preserve cards and money", () => {
  const state = openerReducer(open(), { type: "reveal", index: 0 });
  assert.equal(state.showInventoryPrices, true);
  const hidden = openerReducer(state, { type: "inventory_prices" });
  assert.deepEqual(hidden, { ...state, showInventoryPrices: false });
  assert.equal(hidden.showPrices, true);
  assert.equal(openerReducer(hidden, { type: "clear" }).showInventoryPrices, false);
  assert.equal(restoreOpenerSession(JSON.stringify(hidden)).showInventoryPrices, false);
  const legacy = { ...hidden };
  delete legacy.showInventoryPrices;
  assert.equal(restoreOpenerSession(JSON.stringify(legacy)).showInventoryPrices, true);
});


test("recording seeds reproduce pack order and leave regular pack collation intact", () => {
  const seed = "CHARIZARD-STREAM-1715";
  const pack = rollSeededOpenerPack("base1", seed);
  assert.deepEqual(pack, rollSeededOpenerPack("base1", seed));
  assert.equal(pack.length, 11);
  assert.equal(OPENER_BY_ID[pack.at(-1)].name, "Charizard");
  assert.equal(OPENER_BY_ID[pack.at(-1)].rarity, "Rare Holo");
  assert.equal(pack.filter((id) => OPENER_BY_ID[id].supertype === "energy").length, 2);
  assert.equal(pack.slice(0, 5).every((id) => OPENER_BY_ID[id].rarity === "Common"), true);
  assert.notDeepEqual(pack, rollSeededOpenerPack("base1", seed, 2));
  assert.notDeepEqual(pack, rollSeededOpenerPack("base1", "different-seed"));
});

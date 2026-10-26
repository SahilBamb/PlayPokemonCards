import test from "node:test";
import assert from "node:assert/strict";
import {
  OPENER_BY_ID,
  OPENER_CARDS,
  OPENER_MARKET,
  OPENER_SETS,
  initialOpenerSession,
  isShinyPull,
  loadOpenerSession,
  openedValue,
  openerReducer,
  quoteFor,
  restoreOpenerSession,
  rollOpenerPack,
  saveOpenerSession,
} from "../src/lib/cardOpener.js";

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const open = (state = initialOpenerSession(), instant = true) =>
  openerReducer(state, {
    type: "open",
    ids: rollOpenerPack(state.setId, rng(9)),
    instant,
  });

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

test("taking a shop pack prepares a sealed wrapper and cannot replace an unfinished pack", () => {
  let state = openerReducer(initialOpenerSession(), {
    type: "prepare",
    id: "jungle",
  });
  assert.equal(state.setId, "jungle");
  assert.equal(state.stage, "sealed");
  assert.equal(state.packsOpened, 0);
  state = open(state);
  assert.equal(openerReducer(state, { type: "prepare", id: "fossil" }), state);
  for (let index = 0; index < 11; index += 1)
    state = openerReducer(state, { type: "reveal", index });
  state = openerReducer(state, { type: "prepare", id: "fossil" });
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

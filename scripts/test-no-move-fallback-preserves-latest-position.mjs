import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  preserveLatestPositionForNoMove,
} from "../src/utils/combat/noMovePositionPreservation.js";

const makeLogger = () => {
  const entries = [];
  return {
    entries,
    log(message, type) {
      entries.push({ message, type });
    },
  };
};

{
  const logger = makeLogger();
  const enemy = preserveLatestPositionForNoMove({
    latestFighter: {
      id: "enemy-knight",
      name: "Knight [enemy]",
      x: 28,
      y: 13,
      position: { x: 28, y: 13 },
      remainingActions: 1,
    },
    staleActor: {
      id: "enemy-knight",
      name: "Knight [enemy]",
      x: 27,
      y: 15,
      position: { x: 27, y: 15 },
    },
    patch: {
      x: 27,
      y: 15,
      position: { x: 27, y: 15 },
      remainingActions: 0,
    },
    log: logger.log,
  });

  assert.equal(enemy.x, 28, "enemy no-move fallback should preserve latest x");
  assert.equal(enemy.y, 13, "enemy no-move fallback should preserve latest y");
  assert.deepEqual(enemy.position, { x: 28, y: 13 }, "enemy no-move fallback should preserve latest position");
  assert.equal(enemy.remainingActions, 0, "enemy no-move fallback should still consume/finalize the action");
  assert.match(logger.entries[0]?.message || "", /no-move fallback preserved latest position over stale snapshot/);
  assert.match(logger.entries[0]?.message || "", /stale=\(27,15\) latest=\(28,13\)/);
}

{
  const party = preserveLatestPositionForNoMove({
    latestFighter: {
      id: "party-knight",
      name: "Knight [party]",
      x: 24,
      y: 9,
      position: { x: 24, y: 9 },
      remainingActions: 1,
    },
    staleActor: {
      id: "party-knight",
      name: "Knight [party]",
      x: 27,
      y: 15,
      position: { x: 27, y: 15 },
    },
    patch: {
      position: { x: 27, y: 15 },
      remainingActions: 0,
      moraleState: { survivalIntent: "cower" },
    },
  });

  assert.equal(party.x, 24, "party survival cower should preserve latest x");
  assert.equal(party.y, 9, "party survival cower should preserve latest y");
  assert.deepEqual(party.position, { x: 24, y: 9 }, "party survival cower should preserve latest post-flee position");
  assert.equal(party.remainingActions, 0, "party survival cower should still consume the action");
  assert.equal(party.moraleState.survivalIntent, "cower", "party survival cower should still apply no-move metadata");
}

{
  const afterFleeThenCower = preserveLatestPositionForNoMove({
    latestFighter: {
      id: "party-knight",
      name: "Knight [party]",
      x: 24,
      y: 9,
      position: { x: 24, y: 9 },
      moraleState: { lastRoutePosition: { x: 24, y: 9 } },
    },
    staleActor: {
      id: "party-knight",
      name: "Knight [party]",
      x: 27,
      y: 15,
      position: { x: 27, y: 15 },
    },
    patch: {
      x: 27,
      y: 15,
      position: { x: 27, y: 15 },
      moraleState: {
        lastRoutePosition: { x: 24, y: 9 },
        survivalIntent: "cower",
      },
    },
  });

  assert.deepEqual(
    afterFleeThenCower.position,
    { x: 24, y: 9 },
    "panic flee followed by cower/hold must not teleport fighter back to pre-flee position",
  );
  assert.equal(afterFleeThenCower.moraleState.survivalIntent, "cower");
}

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const helperSource = readFileSync(new URL("../src/utils/combat/noMovePositionPreservation.js", import.meta.url), "utf8");

assert.match(combatPageSource, /const preserveNoMovePosition = useCallback/);
assert.match(combatPageSource, /const finalizeNoMovePreservingPosition = useCallback/);
assert.match(combatPageSource, /const resolveLatestNoMovePosition = useCallback/);
assert.match(combatPageSource, /resolveLatestNoMovePosition\(latestFighter\.id, staleActor, latestFighter, source\)/);
assert.match(combatPageSource, /const lastMovementCommitRef = useRef\(\{\}\)/);
assert.match(combatPageSource, /lastMovementCommit: lastMovementCommitRef\.current\?\.\[fighterId\]/);
assert.match(combatPageSource, /cannot find a safe \$\{fallbackLabel\} path and cowers in place/);
assert.match(combatPageSource, /finalizeNoMovePreservingPosition\(\{\s*[\s\S]*?source: "survival-cower"/);
assert.match(combatPageSource, /finalizeNoMovePreservingPosition\(\{\s*[\s\S]*?source: "exhausted-cower"/);
assert.match(combatPageSource, /finalizeNoMovePreservingPosition\(\{\s*[\s\S]*?source: approachFinalizerSource/);
assert.match(combatPageSource, /const consumeBlockedMovementAction = \(fighterLike, reason = "blocked-movement"\) => \{\s*[\s\S]*?finalizeNoMovePreservingPosition\(\{\s*[\s\S]*?source: reason/s);
assert.match(helperSource, /no-move fallback preserved latest position over stale snapshot/);

console.log("no-move fallback preserves latest position tests passed");

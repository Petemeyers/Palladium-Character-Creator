import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  preserveLatestPositionAcrossStores,
} from "../src/utils/combat/noMovePositionPreservation.js";

function createLog() {
  const entries = [];
  return {
    entries,
    log(message, type) {
      entries.push({ message, type });
    },
  };
}

{
  const logger = createLog();
  const result = preserveLatestPositionAcrossStores({
    fighterId: "enemy-knight",
    staleActor: { id: "enemy-knight", name: "Knight [enemy]", position: { x: 27, y: 15 } },
    updatedFighters: [{ id: "enemy-knight", name: "Knight [enemy]", position: { x: 27, y: 15 }, remainingActions: 1 }],
    positions: { "enemy-knight": { x: 27, y: 15 } },
    lastKnownPositions: { "enemy-knight": { x: 28, y: 13 } },
    patch: { remainingActions: 0, position: { x: 27, y: 15 }, x: 27, y: 15 },
    log: logger.log,
  });

  assert.deepEqual(result.positions["enemy-knight"], { x: 28, y: 13 });
  assert.deepEqual(result.fighters[0].position, { x: 28, y: 13 });
  assert.equal(result.fighters[0].remainingActions, 0);
  assert.match(logger.entries.map((entry) => entry.message).join("\n"), /preserved canonical position over stale snapshot/);
}

{
  const result = preserveLatestPositionAcrossStores({
    fighterId: "party-knight",
    staleActor: { id: "party-knight", name: "Knight [party]", position: { x: 27, y: 15 } },
    updatedFighters: [{ id: "party-knight", name: "Knight [party]", position: { x: 27, y: 15 } }],
    positions: { "party-knight": { x: 27, y: 15 } },
    lastKnownPositions: { "party-knight": { x: 29, y: 15 } },
    patch: { moraleState: { survivalIntent: "cower" }, position: { x: 27, y: 15 } },
  });

  assert.deepEqual(result.positions["party-knight"], { x: 29, y: 15 });
  assert.deepEqual(result.fighters[0].position, { x: 29, y: 15 });
  assert.equal(result.fighters[0].moraleState.survivalIntent, "cower");
}

{
  const result = preserveLatestPositionAcrossStores({
    fighterId: "enemy-knight",
    staleActor: { id: "enemy-knight", position: { x: 27, y: 15 } },
    updatedFighters: [
      { id: "enemy-knight", name: "Knight [enemy]", position: { x: 27, y: 15 } },
      { id: "party-knight", name: "Knight [party]", position: { x: 27, y: 15 } },
    ],
    positions: {
      "enemy-knight": { x: 27, y: 15 },
      "party-knight": { x: 27, y: 15 },
    },
    lastKnownPositions: {
      "enemy-knight": { x: 28, y: 13 },
      "party-knight": { x: 27, y: 15 },
    },
    patch: { position: { x: 27, y: 15 } },
  });

  assert.deepEqual(
    result.positions["enemy-knight"],
    { x: 28, y: 13 },
    "no-move fallback must reject stale same-hex overlap and preserve committed enemy position",
  );
  assert.notDeepEqual(result.positions["enemy-knight"], result.positions["party-knight"]);
}

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const helperSource = readFileSync(new URL("../src/utils/combat/noMovePositionPreservation.js", import.meta.url), "utf8");

assert.match(combatPageSource, /const committedPositionsRef = useRef\(positions\)/);
assert.match(combatPageSource, /const lastMovementCommitRef = useRef\(\{\}\)/);
assert.match(combatPageSource, /const resolveLatestNoMovePosition = useCallback/);
assert.match(combatPageSource, /resolveNoMovePositionAuthority\(\{/);
assert.match(combatPageSource, /lastMovementCommit: lastMovementCommitRef\.current\?\.\[fighterId\]/);
assert.match(helperSource, /position authority candidates: actor=/);
assert.match(helperSource, /position authority repaired from last movement commit: actor=/);
assert.match(combatPageSource, /positionsRef\.current = repairedPositions/);
assert.match(combatPageSource, /committedPositionsRef\.current = \{/);
assert.match(combatPageSource, /positions: \{\s+\.\.\.\(positionsRef\.current \?\? \{\}\),\s+\[latestFighter\.id\]: \{ \.\.\.canonicalPosition \},\s+\}/);
assert.match(combatPageSource, /lastKnownPositions: \{\s+\.\.\.\(committedPositionsRef\.current \?\? \{\}\),\s+\[latestFighter\.id\]: \{ \.\.\.canonicalPosition \},\s+\}/);
assert.match(combatPageSource, /resolveLatestNoMovePosition\(\s*enemy\.id,\s*enemy,\s*latestEnemyForSnapshot,\s*approachFinalizerSource,\s*\) \|\| currentPos/);
assert.match(combatPageSource, /committedPositionsRef\.current = \{\s+\.\.\.\(committedPositionsRef\.current \|\| \{\}\),\s+\[fighter\.id\]: \{ \.\.\.destination \}/);
assert.match(combatPageSource, /committedPositionsRef\.current = \{\s+\.\.\.\(committedPositionsRef\.current \|\| \{\}\),\s+\[enemy\.id\]: \{ x: targetX, y: targetY \}/);
assert.match(combatPageSource, /const livePositions = pickNonEmptyObject\(\s+committedPositionsRef\.current/);

console.log("no-move fallback canonical position store tests passed");

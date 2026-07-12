import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  resolveNoMovePositionAuthority,
} from "../src/utils/combat/noMovePositionPreservation.js";

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

for (const latest of [{ x: 19, y: 9 }, { x: 20, y: 15 }]) {
  const resolved = resolveNoMovePositionAuthority({
    lastMovementCommit: latest,
    committedPosition: { x: 22, y: 15 },
    refPosition: { x: 22, y: 15 },
    latestFighter: { id: "party-knight", position: { x: 22, y: 15 } },
    staleActor: { id: "party-knight", position: { x: 22, y: 15 } },
    source: "exhausted-cower",
  });
  assert.deepEqual(
    { x: resolved.x, y: resolved.y },
    latest,
    `cower should preserve last real move ${latest.x},${latest.y} instead of stale 22,15`,
  );
}

assert.match(combatPageSource, /const lastMovementCommitRef = useRef\(\{\}\)/);
assert.match(combatPageSource, /resolveNoMovePositionAuthority\(\{/);
assert.match(combatPageSource, /lastMovementCommit: lastMovementCommitRef\.current\?\.\[fighterId\]/);
assert.match(combatPageSource, /source: "survival-cower"/);
assert.match(combatPageSource, /source: "exhausted-cower"/);
assert.match(combatPageSource, /positions: \{\s+\.\.\.\(positionsRef\.current \?\? \{\}\),\s+\[latestFighter\.id\]: \{ \.\.\.canonicalPosition \},\s+\}/);
assert.match(combatPageSource, /lastKnownPositions: \{\s+\.\.\.\(committedPositionsRef\.current \?\? \{\}\),\s+\[latestFighter\.id\]: \{ \.\.\.canonicalPosition \},\s+\}/);

console.log("cower stale-latest prevention tests passed");

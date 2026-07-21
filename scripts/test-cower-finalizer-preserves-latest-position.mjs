import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  preserveLatestPositionAcrossStores,
} from "../src/utils/combat/noMovePositionPreservation.js";

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const helperSource = readFileSync(new URL("../src/utils/combat/noMovePositionPreservation.js", import.meta.url), "utf8");

{
  const result = preserveLatestPositionAcrossStores({
    fighterId: "party-knight",
    staleActor: { id: "party-knight", name: "Knight [party]", position: { x: 22, y: 15 }, x: 22, y: 15 },
    updatedFighters: [
      { id: "party-knight", name: "Knight [party]", position: { x: 22, y: 15 }, hex: { x: 22, y: 15 } },
    ],
    positions: { "party-knight": { x: 19, y: 9 } },
    lastKnownPositions: { "party-knight": { x: 19, y: 9 } },
    patch: {
      x: 22,
      y: 15,
      position: { x: 22, y: 15 },
      remainingActions: 0,
      moraleState: { survivalIntent: "cower" },
    },
  });

  assert.deepEqual(result.positions["party-knight"], { x: 19, y: 9 });
  assert.deepEqual(result.fighters[0].position, { x: 19, y: 9 });
  assert.deepEqual(result.fighters[0].hex, { x: 19, y: 9 });
  assert.equal(result.fighters[0].remainingActions, 0);
}

assert.match(combatPageSource, /const resolveLatestNoMovePosition = useCallback/);
assert.match(combatPageSource, /const lastMovementCommitRef = useRef\(\{\}\)/);
assert.match(combatPageSource, /resolveNoMovePositionAuthority\(\{/);
assert.match(combatPageSource, /lastMovementCommit: lastMovementCommitRef\.current\?\.\[fighterId\]/);
assert.match(combatPageSource, /const finalizeNoMovePreservingPosition = useCallback/);
assert.match(combatPageSource, /stripPositionFields\(actorPatch\)/);
assert.match(helperSource, /position authority candidates: actor=/);
assert.match(helperSource, /position authority repaired from last movement commit: actor=/);
assert.match(combatPageSource, /cower preserve position check: actor=/);
assert.match(combatPageSource, /cower preserve position committed: actor=/);
assert.match(combatPageSource, /position store mismatch after no-move: actor=/);
assert.match(combatPageSource, /source: "survival-cower"/);
assert.match(combatPageSource, /source: "routed-exhausted-cower"/);
assert.match(combatPageSource, /cannot find a safe \$\{fallbackLabel\} path and cowers in place/);
assert.match(combatPageSource, /is too exhausted to keep fleeing and cowers in place/);

console.log("cower finalizer preserves latest position tests passed");

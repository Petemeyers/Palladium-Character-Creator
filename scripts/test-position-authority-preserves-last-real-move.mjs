import assert from "node:assert/strict";

import {
  resolveNoMovePositionAuthority,
} from "../src/utils/combat/noMovePositionPreservation.js";

const logs = [];
const resolved = resolveNoMovePositionAuthority({
  lastMovementCommit: {
    x: 19,
    y: 9,
    source: "routed-flee",
    generation: 3,
    combatRound: 2,
    turnSerial: 14,
    sequence: 7,
  },
  committedPosition: { x: 22, y: 15 },
  refPosition: { x: 22, y: 15 },
  latestFighter: { id: "party-knight", name: "Knight [party]", position: { x: 22, y: 15 } },
  staleActor: { id: "party-knight", name: "Knight [party]", position: { x: 22, y: 15 } },
  source: "survival-cower",
  actorLabel: "Knight [party]",
  log: (message, type) => logs.push({ message, type }),
});

assert.deepEqual(
  { x: resolved.x, y: resolved.y },
  { x: 19, y: 9 },
  "last real movement commit should outrank stale committed/ref/fighter/stale positions",
);
assert.match(
  logs.map((entry) => entry.message).join("\n"),
  /position authority candidates: actor=Knight \[party\] source=survival-cower lastMove=\(19,9\) committed=\(22,15\) positionsRef=\(22,15\) fighter=\(22,15\) stale=\(22,15\)/,
);
assert.match(
  logs.map((entry) => entry.message).join("\n"),
  /position authority repaired from last movement commit: actor=Knight \[party\] from=\(22,15\) to=\(19,9\) source=survival-cower/,
);

console.log("position authority preserves last real move tests passed");

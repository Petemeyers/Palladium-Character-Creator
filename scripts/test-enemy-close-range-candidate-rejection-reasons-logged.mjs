import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  diagnoseReachableAttackHexRejections,
} from "../src/utils/enemyMovementFallback.js";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /diagnoseReachableAttackHexRejections/);
assert.match(source, /enemy close-range candidate rejected: actor=/);
assert.match(source, /reason=\$\{entry\.reason\}/);
assert.match(source, /enemy close-range approach candidates summary: attackReach=/);
assert.match(source, /rejectedOccupied=.*rejectedBlocked=.*rejectedReach=.*rejectedPath=/s);

const offsets = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const getNeighbors = (x, y) => offsets.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
const getDistance = (a, b) => (
  (Math.abs(a.x - b.x) + Math.abs(a.x + a.y - b.x - b.y) + Math.abs(a.y - b.y)) / 2
) * 5;

const diagnostics = diagnoseReachableAttackHexRejections({
  currentPosition: { x: 2, y: 2 },
  target: { id: "target" },
  targetPosition: { x: 4, y: 2 },
  maxHexes: 1,
  getNeighbors,
  isLegalCenter: (position) => position.x === 3 && position.y === 2,
  canAttackFrom: (position, _target, targetPosition) => getDistance(position, targetPosition) <= 5,
  getDistance,
  classifyCandidate: (position) => {
    if (position.x < 0 || position.y < 0) return { reason: "out-of-bounds" };
    if (position.x === 3 && position.y === 1) return { reason: "blocked" };
    if (position.x === 2 && position.y === 3) return { reason: "same-side-occupied" };
    return null;
  },
});

assert.equal(diagnostics.summary.legal, 1);
assert.ok(diagnostics.summary.rejectedBlocked >= 1);
assert.ok(diagnostics.summary.rejectedSameSideOccupied >= 1);

console.log("enemy close-range candidate rejection diagnostics tests passed");

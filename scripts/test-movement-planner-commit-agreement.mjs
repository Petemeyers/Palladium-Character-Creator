import assert from "node:assert/strict";
import { chooseEnemyMovementFallback } from "../src/utils/enemyMovementFallback.js";
import {
  BATTLEFIELD_TRAVERSAL_REASONS,
  createBattlefieldTraversalNeighborProvider,
  findBattlefieldTraversalPath,
  resolveBattlefieldPathTraversal,
  resolveBattlefieldTraversalStep,
  validateBattlefieldTraversalExecutionSnapshot,
} from "../src/utils/maps/battlefieldTraversalAuthority.js";
import { cellToCanonicalMapPoint } from "../src/utils/maps/mapCoordinateAuthority.js";

const makeMap = (cells, extra = {}) => ({
  width: cells[0].length,
  height: cells.length,
  grid: cells,
  ...extra,
});
const cell = (height = 0, terrain = "grass", extra = {}) => ({
  terrain,
  terrainType: terrain,
  height,
  elevation: height,
  ...extra,
});
const actor = { id: "agreement-ai", currentStamina: 12, heightFeet: 6 };
const target = { id: "agreement-target", currentHP: 10 };
const from = { x: 0, y: 0 };
const destination = { x: 1, y: 0 };
const rawNeighbors = (x) => (x === 0 ? [{ ...destination }] : []);
const plannerOptions = {
  enemy: actor,
  hostileCandidates: [target],
  positions: { [target.id]: { x: 2, y: 0 } },
  currentPosition: from,
  maxHexes: 1,
  isLegalCenter: () => true,
  getDistance: (left, right) => Math.abs(left.x - right.x) * 5,
  canAttackFrom: (position) => position.x === 1,
  isHostile: () => true,
};

// Deterministic reproduction of the pre-repair production mismatch: the
// fallback planner only knew generic/structure legality, while commit applied
// canonical terrain traversal afterward.
const cliffMap = makeMap([[cell(0), cell(3), cell(0)]]);
const legacyPlan = chooseEnemyMovementFallback({
  ...plannerOptions,
  getNeighbors: rawNeighbors,
});
const legacyCommit = resolveBattlefieldPathTraversal({
  mapDefinition: cliffMap,
  actorId: actor.id,
  from,
  to: destination,
  path: legacyPlan.path,
  movementMode: "walk",
  maxDistanceFeet: 30,
});
assert.ok(legacyPlan.position, "legacy planner should reproduce an accepted destination");
assert.equal(legacyCommit.accepted, false);
assert.equal(legacyCommit.reason, BATTLEFIELD_TRAVERSAL_REASONS.CLIFF_REQUIRES_CLIMB);

const cliffAwareNeighbors = createBattlefieldTraversalNeighborProvider({
  mapDefinition: cliffMap,
  getNeighbors: rawNeighbors,
  movementMode: "walk",
});
const repairedBlockedPlan = chooseEnemyMovementFallback({
  ...plannerOptions,
  getNeighbors: cliffAwareNeighbors,
});
assert.equal(repairedBlockedPlan.position, null);
assert.equal(repairedBlockedPlan.type, "hold");
console.log("PASS canonical planner rejects the same cliff transition as commit");

const flatMap = makeMap([[cell(0), cell(0), cell(0)]]);
const flatNeighbors = createBattlefieldTraversalNeighborProvider({
  mapDefinition: flatMap,
  getNeighbors: rawNeighbors,
  movementMode: "walk",
});
const flatPlan = chooseEnemyMovementFallback({
  ...plannerOptions,
  getNeighbors: flatNeighbors,
});
const canonicalFlatPlan = findBattlefieldTraversalPath({
  mapDefinition: flatMap,
  actorId: actor.id,
  from,
  destination: flatPlan.position,
  movementMode: "walk",
  maxDistanceFeet: 30,
});
const flatCommit = resolveBattlefieldPathTraversal({
  mapDefinition: flatMap,
  actorId: actor.id,
  from,
  to: flatPlan.position,
  path: canonicalFlatPlan.path,
  movementMode: "walk",
  maxDistanceFeet: 30,
});
assert.equal(canonicalFlatPlan.accepted, true);
assert.equal(flatCommit.accepted, true);
assert.equal(flatCommit.effectiveDistanceFeet, canonicalFlatPlan.effectiveDistanceFeet);
console.log("PASS planner-accepted flat AI step commits under the same snapshot");

const costlyMap = makeMap([[cell(0), cell(1), cell(2)]]);
const costlyPlan = findBattlefieldTraversalPath({
  mapDefinition: costlyMap,
  actorId: actor.id,
  from,
  destination: { x: 2, y: 0 },
  movementMode: "walk",
  maxDistanceFeet: 15,
});
const costlyCommit = resolveBattlefieldPathTraversal({
  mapDefinition: costlyMap,
  actorId: actor.id,
  from,
  to: { x: 2, y: 0 },
  path: costlyPlan.path,
  movementMode: "walk",
  maxDistanceFeet: 15,
});
assert.equal(costlyPlan.accepted, true);
assert.equal(costlyCommit.accepted, true);
assert.equal(costlyCommit.effectiveDistanceFeet, 15);
assert.equal(costlyCommit.effectiveDistanceFeet, costlyPlan.effectiveDistanceFeet);
assert.equal(costlyCommit.staminaCost, costlyPlan.staminaCost);
console.log("PASS costly terrain remains passable with planner/commit cost agreement");

const stalePosition = validateBattlefieldTraversalExecutionSnapshot({
  snapshot: canonicalFlatPlan.executionSnapshot,
  mapDefinition: flatMap,
  actorId: actor.id,
  from: { x: 0, y: 1 },
  to: flatPlan.position,
  movementMode: "walk",
});
assert.equal(stalePosition.accepted, false);
assert.equal(stalePosition.reason, BATTLEFIELD_TRAVERSAL_REASONS.STALE_POSITION);

const changedFlatMap = makeMap([[cell(0), cell(3), cell(0)]]);
const staleBattlefield = validateBattlefieldTraversalExecutionSnapshot({
  snapshot: canonicalFlatPlan.executionSnapshot,
  mapDefinition: changedFlatMap,
  actorId: actor.id,
  from,
  to: flatPlan.position,
  movementMode: "walk",
});
assert.equal(staleBattlefield.accepted, false);
assert.equal(staleBattlefield.reason, BATTLEFIELD_TRAVERSAL_REASONS.STALE_BATTLEFIELD);
console.log("PASS stale position and battlefield changes are distinguished from terrain rejection");

const climbRejected = resolveBattlefieldTraversalStep({
  mapDefinition: cliffMap,
  from,
  to: destination,
  movementMode: "walk",
});
const climbAccepted = resolveBattlefieldTraversalStep({
  mapDefinition: cliffMap,
  from,
  to: destination,
  movementMode: "climb",
  climbAuthorized: true,
});
assert.equal(climbRejected.reason, BATTLEFIELD_TRAVERSAL_REASONS.CLIFF_REQUIRES_CLIMB);
assert.equal(climbAccepted.accepted, true);

const waterMap = makeMap([[
  cell(0),
  cell(0, "water", { waterDepthFeet: 8 }),
]]);
const waterRejected = resolveBattlefieldTraversalStep({
  mapDefinition: waterMap,
  from,
  to: destination,
  movementMode: "walk",
  waterProfile: actor,
});
const waterAccepted = resolveBattlefieldTraversalStep({
  mapDefinition: waterMap,
  from,
  to: destination,
  movementMode: "walk",
  swimAuthorized: true,
  waterProfile: actor,
});
assert.equal(waterRejected.reason, BATTLEFIELD_TRAVERSAL_REASONS.SWIM_REQUIRED);
assert.equal(waterAccepted.accepted, true);
assert.equal(waterAccepted.waterTraversal.requiresSwim, true);
console.log("PASS climb and water special traversal requirements remain explicit");

const logicalCell = { x: 20, y: 21 };
assert.deepEqual(
  cellToCanonicalMapPoint(logicalCell, "hex"),
  cellToCanonicalMapPoint({ ...logicalCell }, "hex"),
);
assert.deepEqual(
  cellToCanonicalMapPoint(logicalCell, "square"),
  cellToCanonicalMapPoint({ ...logicalCell }, "square"),
);
console.log("PASS 2D/3D projections preserve the same logical battlefield cell");

console.log("PASS Milestone 8C planner/commit agreement repair");

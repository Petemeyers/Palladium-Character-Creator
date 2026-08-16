import assert from "node:assert/strict";
import {
  createStructureSpatialIndex,
} from "../src/utils/maps/structureSpatialQueryAuthority.js";
import {
  STRUCTURE_AWARE_MOVEMENT_ID,
  admitStructureAwareCombatMovement,
  bypassesGroundStructureMovement,
  filterStructureAwareCombatNeighbors,
  findStructureAwareCombatPath,
  normalizeStructureAwareMovementPath,
} from "../src/utils/combat/structureAwareMovementAuthority.js";

const makeGrid = (w = 8, h = 8) =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => ({ terrain: "grass", terrainType: "grass" })));

const wall = {
  id: "route-wall",
  runId: "route-run",
  kind: "wall",
  material: "stone",
  heightFeet: 10,
  ownerCell: { x: 0, y: 0 },
  a: { x: 2, z: -1 },
  b: { x: 2, z: 1 },
};

const mapDefinition = {
  mapType: "hex",
  grid: makeGrid(),
  structures: { orthogonalSegments: [wall] },
};
const index = createStructureSpatialIndex(mapDefinition);

assert.equal(STRUCTURE_AWARE_MOVEMENT_ID, "structure-aware-movement-v1");
assert.equal(bypassesGroundStructureMovement("FLY"), true);
assert.equal(bypassesGroundStructureMovement("MOVE"), false);
console.log("PASS 3B movement mode ownership");

const normalized = normalizeStructureAwareMovementPath({
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
  path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
});
assert.deepEqual(normalized.map(({ x, y }) => ({ x, y })), [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
]);
console.log("PASS 3B path normalization");

const direct = admitStructureAwareCombatMovement({
  mapDefinition,
  index,
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
  path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
  movementMode: "MOVE",
});
assert.equal(direct.accepted, false);
assert.equal(direct.reason, "structure-blocked");
assert.equal(direct.blockerId, "route-wall");
assert.equal(direct.blockedStepIndex, 1);
assert.match(direct.obstacle, /stone wall/i);
console.log("PASS 3B exact path step is rejected before movement commit");

const fly = admitStructureAwareCombatMovement({
  mapDefinition,
  index,
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
  movementMode: "FLY",
});
assert.equal(fly.accepted, true);
assert.equal(fly.reason, "non-ground-movement");
console.log("PASS 3B ground authority does not regress flight");

// Live combat neighbor expansion uses odd-r offset parity (see
// movementRules.getHexNeighbors); the previous axial-style helper encoded a
// coordinate contract live combat never uses.
const oddROffsetNeighbors = (x, y) => {
  const parity = y & 1;
  const directions = parity === 0
    ? [[+1, 0], [0, -1], [-1, -1], [-1, 0], [-1, +1], [0, +1]]
    : [[+1, 0], [+1, -1], [0, -1], [-1, 0], [0, +1], [+1, +1]];
  return directions.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
};
const legalCenter = ({ x, y }) => x >= -2 && x <= 4 && y >= -4 && y <= 4;

const filtered = filterStructureAwareCombatNeighbors({
  mapDefinition,
  index,
  from: { x: 1, y: 0 },
  neighbors: oddROffsetNeighbors(1, 0),
});
assert.ok(filtered.rejected.length >= 1);
assert.ok(filtered.neighbors.length >= 1);
console.log("PASS 3B neighbor expansion removes wall crossing but preserves alternatives");

const route = findStructureAwareCombatPath({
  mapDefinition,
  index,
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 0 },
  getNeighbors: oddROffsetNeighbors,
  isLegalCenter: legalCenter,
  maxSteps: 12,
});
assert.equal(route.found, true);
assert.ok(route.path.length > 3, `expected detour, got ${JSON.stringify(route.path)}`);
for (let i = 0; i < route.path.length - 1; i += 1) {
  const step = admitStructureAwareCombatMovement({
    mapDefinition,
    index,
    from: route.path[i],
    to: route.path[i + 1],
  });
  assert.equal(step.accepted, true, `detour step ${i} should be legal`);
}
console.log("PASS 3B pathfinder routes around a blocking wall");

const openGateMap = {
  ...mapDefinition,
  structures: {
    orthogonalSegments: [{
      ...wall,
      id: "open-gate",
      kind: "gate",
      type: "gate",
      open: true,
      gateOpen: true,
    }],
  },
};
const openGate = admitStructureAwareCombatMovement({
  mapDefinition: openGateMap,
  index: createStructureSpatialIndex(openGateMap),
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
  path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
});
assert.equal(openGate.accepted, true);
console.log("PASS 3B open gate remains traversable");

console.log("PASS Milestone 8C-8C.3B structure-aware movement authority");

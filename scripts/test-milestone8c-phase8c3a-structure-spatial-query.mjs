import assert from "node:assert/strict";
import {
  STRUCTURE_SPATIAL_QUERY_ID,
  createStructureSpatialIndex,
  getCombatMovementStructureBlock,
  hasCombatStructureLineOfSight,
  getCombatProjectileStructureImpact,
  getCombatStructureCover,
  isPathBlockedByStructures,
  getMovementStructureBlock,
  MAP_POSITION_SPACES,
} from "../src/utils/maps/structureSpatialQueryAuthority.js";

const makeGrid = (w = 4, h = 3) =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => ({ terrain: "grass", terrainType: "grass" })));

const wall = {
  id: "test-wall",
  runId: "run-1",
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
  structures: {
    orthogonalSegments: [wall],
  },
};

const index = createStructureSpatialIndex(mapDefinition);
assert.equal(index.id, STRUCTURE_SPATIAL_QUERY_ID);
assert.equal(index.stats.orthogonalCount, 1);
console.log("PASS canonical structure spatial index");

// Combat adapters consume live odd-r offset positions (CombatPage's storage
// space). Row 0 is used here; mid-map row coverage lives in
// test-structure-combat-coordinate-space.mjs.
const movement = getCombatMovementStructureBlock({
  mapDefinition,
  index,
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
});
assert.equal(movement.blocked, true);
assert.equal(movement.blocker.segment.id, "test-wall");
console.log("PASS combat odd-r offset movement crossing blocked by wall");

const path = isPathBlockedByStructures({
  index,
  mapDefinition,
  mapType: "hex",
  coordinateSpace: MAP_POSITION_SPACES.AXIAL,
  path: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ],
});
assert.equal(path.blocked, true);
assert.equal(path.segmentIndex, 1);
console.log("PASS step path reports exact blocked transition");

const los = hasCombatStructureLineOfSight({
  mapDefinition,
  index,
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
  fromHeightFeet: 5.5,
  toHeightFeet: 5.5,
});
assert.equal(los.clear, false);
console.log("PASS wall blocks combat line of sight");

const overWall = hasCombatStructureLineOfSight({
  mapDefinition,
  index,
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
  fromHeightFeet: 12,
  toHeightFeet: 12,
});
assert.equal(overWall.clear, true);
console.log("PASS height-aware sight can pass over lower wall");

const projectile = getCombatProjectileStructureImpact({
  mapDefinition,
  index,
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
  fromHeightFeet: 4,
  toHeightFeet: 4,
});
assert.equal(projectile.impacted, true);
assert.equal(projectile.structure.id, "test-wall");
console.log("PASS projectile query returns first structural impact");

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
const openGateIndex = createStructureSpatialIndex(openGateMap);
const gateMove = getCombatMovementStructureBlock({
  mapDefinition: openGateMap,
  index: openGateIndex,
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
});
assert.equal(gateMove.blocked, false);
const gateLos = hasCombatStructureLineOfSight({
  mapDefinition: openGateMap,
  index: openGateIndex,
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
});
assert.equal(gateLos.clear, true);
console.log("PASS open gate removes movement and LOS block");

const fenceMap = {
  ...mapDefinition,
  structures: {
    orthogonalSegments: [{
      ...wall,
      id: "fence",
      kind: "fence",
      type: "fence",
      heightFeet: 4,
    }],
  },
};
const fenceIndex = createStructureSpatialIndex(fenceMap);
const fenceLos = hasCombatStructureLineOfSight({
  mapDefinition: fenceMap,
  index: fenceIndex,
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
});
assert.equal(fenceLos.clear, true);
const fenceCover = getCombatStructureCover({
  mapDefinition: fenceMap,
  index: fenceIndex,
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
});
assert.equal(fenceCover.cover, "partial");
console.log("PASS fence allows LOS while providing partial cover");

const climbMap = {
  ...mapDefinition,
  structures: {
    orthogonalSegments: [{ ...wall, id: "climb-wall", climbable: true, heightFeet: 8 }],
  },
};
const climbResult = getCombatMovementStructureBlock({
  mapDefinition: climbMap,
  index: createStructureSpatialIndex(climbMap),
  from: { x: 0, y: 0 },
  to: { x: 2, y: 0 },
  actorCanClimb: true,
});
assert.equal(climbResult.blocked, true);
assert.equal(climbResult.requiresClimb, true);
assert.equal(climbResult.canTraverseWithClimb, true);
assert.equal(climbResult.requiredClimbHeightFeet, 8);
console.log("PASS climbable blockers expose traversal requirement without silently bypassing wall");

const precisionGrid = makeGrid(2, 1);
precisionGrid[0][0] = {
  ...precisionGrid[0][0],
  walls: {
    E: { kind: "wall", material: "stone", heightFeet: 10 },
  },
};
precisionGrid[0][1] = {
  ...precisionGrid[0][1],
  walls: {
    W: { kind: "wall", material: "stone", heightFeet: 10 },
  },
};
const precisionMap = { mapType: "hex", grid: precisionGrid, structures: {} };
const precisionIndex = createStructureSpatialIndex(precisionMap);
assert.equal(precisionIndex.stats.precisionEdgeCount, 1);
const precisionMove = getMovementStructureBlock({
  mapDefinition: precisionMap,
  index: precisionIndex,
  mapType: "hex",
  coordinateSpace: MAP_POSITION_SPACES.OFFSET,
  from: { x: 0, y: 0 },
  to: { x: 1, y: 0 },
});
assert.equal(precisionMove.blocked, true);
console.log("PASS legacy precision hex edge participates in canonical collision queries");

console.log("PASS Milestone 8C-8C.3A structure spatial query authority");

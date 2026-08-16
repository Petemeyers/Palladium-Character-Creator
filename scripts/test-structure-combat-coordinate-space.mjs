/**
 * Milestone 8C P0 Repair 1 — Hex Structure Query Coordinate Authority
 *
 * Live CombatPage fighter positions are odd-r offset cells. The combat
 * structure adapters previously forced an axial interpretation, displacing
 * every hex query by floor(row / 2) columns, so walls stopped blocking
 * movement and LOS from row 2 onward. These regressions use the exact
 * coordinate shape CombatPage stores (odd-r offset) and mid-map rows.
 */
import assert from "node:assert/strict";
import {
  COMBAT_STRUCTURE_POSITION_SPACE,
  MAP_POSITION_SPACES,
  createStructureSpatialIndex,
  getCombatMovementStructureBlock,
  getCombatProjectileStructureImpact,
  getCombatStructureCover,
  getMovementStructureBlock,
  hasCombatStructureLineOfSight,
  hasStructureLineOfSight,
} from "../src/utils/maps/structureSpatialQueryAuthority.js";
import {
  admitStructureAwareCombatMovement,
  filterStructureAwareCombatNeighbors,
} from "../src/utils/combat/structureAwareMovementAuthority.js";
import { cellToCanonicalMapPoint } from "../src/utils/maps/mapCoordinateAuthority.js";
import { getHexNeighbors } from "../src/data/movementRules.js";

const makeGrid = (w, h) =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => ({ terrain: "grass", terrainType: "grass" })));

/**
 * Build a wall segment perpendicular to the line between two offset cells,
 * centered on the midpoint of their canonical map centers, so a transition
 * between the two cells must cross it.
 */
function wallBetweenOffsetCells(cellA, cellB, mapType = "hex", overrides = {}) {
  const a = cellToCanonicalMapPoint(cellA, mapType);
  const b = cellToCanonicalMapPoint(cellB, mapType);
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz) || 1;
  const perp = { x: dz / length, z: -dx / length };
  return {
    id: overrides.id || `wall-${cellA.x},${cellA.y}-${cellB.x},${cellB.y}`,
    runId: overrides.runId || "coordinate-space-run",
    kind: "wall",
    material: "stone",
    heightFeet: 10,
    ownerCell: { ...cellA },
    a: { x: mid.x - perp.x, z: mid.z - perp.z },
    b: { x: mid.x + perp.x, z: mid.z + perp.z },
    ...overrides,
  };
}

assert.equal(COMBAT_STRUCTURE_POSITION_SPACE, MAP_POSITION_SPACES.OFFSET);
console.log("PASS combat structure position space is offset");

// --- Hex row 2: movement + LOS blocked through the wall ---------------------

const row2Wall = wallBetweenOffsetCells({ x: 1, y: 2 }, { x: 2, y: 2 }, "hex", { id: "row2-wall" });
const hexMap = {
  mapType: "hex",
  grid: makeGrid(8, 8),
  structures: { orthogonalSegments: [row2Wall] },
};
const hexIndex = createStructureSpatialIndex(hexMap);

const row2Move = getCombatMovementStructureBlock({
  mapDefinition: hexMap,
  index: hexIndex,
  from: { x: 1, y: 2 },
  to: { x: 2, y: 2 },
});
assert.equal(row2Move.blocked, true, "row-2 wall must block odd-r offset movement");
assert.equal(row2Move.blocker.segment.id, "row2-wall");
console.log("PASS hex row 2 wall blocks live odd-r movement crossing");

const row2Los = hasCombatStructureLineOfSight({
  mapDefinition: hexMap,
  index: hexIndex,
  from: { x: 1, y: 2 },
  to: { x: 2, y: 2 },
  fromHeightFeet: 5.5,
  toHeightFeet: 5.5,
});
assert.equal(row2Los.clear, false, "row-2 wall must block odd-r offset LOS");
console.log("PASS hex row 2 wall blocks live odd-r line of sight");

const row2OpenLos = hasCombatStructureLineOfSight({
  mapDefinition: hexMap,
  index: hexIndex,
  from: { x: 4, y: 2 },
  to: { x: 5, y: 2 },
  fromHeightFeet: 5.5,
  toHeightFeet: 5.5,
});
assert.equal(row2OpenLos.clear, true, "unobstructed row-2 line must remain clear (no overblocking)");
console.log("PASS unobstructed hex row 2 line of sight remains clear");

const row2Projectile = getCombatProjectileStructureImpact({
  mapDefinition: hexMap,
  index: hexIndex,
  from: { x: 1, y: 2 },
  to: { x: 2, y: 2 },
  fromHeightFeet: 4,
  toHeightFeet: 4,
});
assert.equal(row2Projectile.impacted, true, "row-2 wall must intercept projectiles in offset space");
console.log("PASS hex row 2 wall intercepts projectile query");

// --- Planner and commit agree with the same structure reason ----------------

const plannerFilter = filterStructureAwareCombatNeighbors({
  mapDefinition: hexMap,
  index: hexIndex,
  from: { x: 1, y: 2 },
  neighbors: getHexNeighbors(1, 2),
});
const plannerRejected = plannerFilter.rejected.find(
  (entry) => entry.position.x === 2 && entry.position.y === 2,
);
assert.ok(plannerRejected, "planner neighbor filter must reject the blocked row-2 crossing");
assert.equal(plannerRejected.admission.reason, "structure-blocked");
assert.equal(plannerFilter.neighbors.some((n) => n.x === 2 && n.y === 2), false);

const commitAdmission = admitStructureAwareCombatMovement({
  mapDefinition: hexMap,
  index: hexIndex,
  from: { x: 1, y: 2 },
  to: { x: 2, y: 2 },
  movementMode: "MOVE",
});
assert.equal(commitAdmission.accepted, false);
assert.equal(commitAdmission.reason, "structure-blocked");
assert.equal(commitAdmission.reason, plannerRejected.admission.reason,
  "planner and commit must reject the same transition with the same reason");
console.log("PASS planner filter and commit admission agree: structure-blocked at row 2");

// --- Deeper row (row 4, previous displacement would be +2 columns) ----------

const row4Wall = wallBetweenOffsetCells({ x: 3, y: 4 }, { x: 4, y: 4 }, "hex", { id: "row4-wall" });
const deepMap = {
  mapType: "hex",
  grid: makeGrid(10, 10),
  structures: { orthogonalSegments: [row4Wall] },
};
const deepIndex = createStructureSpatialIndex(deepMap);
const row4Move = getCombatMovementStructureBlock({
  mapDefinition: deepMap,
  index: deepIndex,
  from: { x: 3, y: 4 },
  to: { x: 4, y: 4 },
});
assert.equal(row4Move.blocked, true, "row-4 wall must block movement (old defect shifted +2 columns)");
const row4Los = hasCombatStructureLineOfSight({
  mapDefinition: deepMap,
  index: deepIndex,
  from: { x: 3, y: 4 },
  to: { x: 4, y: 4 },
  fromHeightFeet: 5.5,
  toHeightFeet: 5.5,
});
assert.equal(row4Los.clear, false);
console.log("PASS hex row 4 wall blocks movement and line of sight");

// --- Renderer independence: adapter equals explicit offset-space query ------

const explicitOffset = getMovementStructureBlock({
  mapDefinition: deepMap,
  index: deepIndex,
  mapType: "hex",
  coordinateSpace: MAP_POSITION_SPACES.OFFSET,
  from: { x: 3, y: 4 },
  to: { x: 4, y: 4 },
});
assert.equal(row4Move.blocked, explicitOffset.blocked);
assert.equal(row4Move.blocker.segment.id, explicitOffset.blocker.segment.id);
console.log("PASS combat adapter matches explicit offset-space logical query");

// --- Explicit axial override remains available for genuinely axial callers --

const axialEquivalent = getCombatMovementStructureBlock({
  mapDefinition: hexMap,
  index: hexIndex,
  coordinateSpace: MAP_POSITION_SPACES.AXIAL,
  // axial (0,2)/(1,2) convert to odd-r offset (1,2)/(2,2)
  from: { x: 0, y: 2 },
  to: { x: 1, y: 2 },
});
assert.equal(axialEquivalent.blocked, true);
assert.equal(axialEquivalent.blocker.segment.id, "row2-wall");
console.log("PASS explicit axial coordinateSpace override still converts correctly");

// --- Square map regression ---------------------------------------------------

const squareWall = wallBetweenOffsetCells({ x: 2, y: 3 }, { x: 3, y: 3 }, "square", { id: "square-wall" });
const squareMap = {
  mapType: "square",
  grid: makeGrid(8, 8),
  structures: { orthogonalSegments: [squareWall] },
};
const squareIndex = createStructureSpatialIndex(squareMap);
const squareMove = getCombatMovementStructureBlock({
  mapDefinition: squareMap,
  index: squareIndex,
  from: { x: 2, y: 3 },
  to: { x: 3, y: 3 },
});
assert.equal(squareMove.blocked, true, "square-grid wall must still block movement");
const squareClear = getCombatMovementStructureBlock({
  mapDefinition: squareMap,
  index: squareIndex,
  from: { x: 5, y: 5 },
  to: { x: 6, y: 5 },
});
assert.equal(squareClear.blocked, false, "square-grid open transition must remain clear");
const squareLos = hasStructureLineOfSight({
  mapDefinition: squareMap,
  index: squareIndex,
  mapType: "square",
  coordinateSpace: MAP_POSITION_SPACES.OFFSET,
  from: { x: 2, y: 3 },
  to: { x: 3, y: 3 },
  fromHeightFeet: 5.5,
  toHeightFeet: 5.5,
});
assert.equal(squareLos.clear, false);
console.log("PASS square-grid wall blocking preserved");

// --- Orthogonal square-first walls on hex: H run, V run, true 90° corner ----

// Corner at canonical (4, 6): vertical arm up from z=3, horizontal arm right to x=7.
const cornerVertical = {
  id: "corner-vertical",
  runId: "corner-run",
  kind: "wall",
  material: "stone",
  heightFeet: 10,
  ownerCell: { x: 2, y: 2 },
  a: { x: 4, z: 3 },
  b: { x: 4, z: 6 },
};
const cornerHorizontal = {
  id: "corner-horizontal",
  runId: "corner-run",
  kind: "wall",
  material: "stone",
  heightFeet: 10,
  ownerCell: { x: 2, y: 2 },
  a: { x: 4, z: 6 },
  b: { x: 7, z: 6 },
};
const cornerMap = {
  mapType: "hex",
  grid: makeGrid(10, 10),
  structures: { orthogonalSegments: [cornerVertical, cornerHorizontal] },
};
const cornerIndex = createStructureSpatialIndex(cornerMap);

// Row 3 (odd, z=4.5): offset (1,3) center x≈2.598, (2,3) center x≈4.33 — crosses x=4.
const verticalCross = getCombatMovementStructureBlock({
  mapDefinition: cornerMap,
  index: cornerIndex,
  from: { x: 1, y: 3 },
  to: { x: 2, y: 3 },
});
assert.equal(verticalCross.blocked, true, "vertical orthogonal run must block a mid-map row crossing");
assert.equal(verticalCross.blocker.segment.id, "corner-vertical");

// Column crossing rows 3→4 (z 4.5→6→... centers z=4.5 and z=6): offset (3,3) x≈6.06, (3,4) x≈5.196 — crosses z=6 within x 4..7.
const horizontalCross = getCombatMovementStructureBlock({
  mapDefinition: cornerMap,
  index: cornerIndex,
  from: { x: 3, y: 3 },
  to: { x: 3, y: 4 },
});
assert.equal(horizontalCross.blocked, true, "horizontal orthogonal run must block a row-to-row crossing");
assert.equal(horizontalCross.blocker.segment.id, "corner-horizontal");

// A transition far from both arms remains clear.
const cornerClear = getCombatMovementStructureBlock({
  mapDefinition: cornerMap,
  index: cornerIndex,
  from: { x: 7, y: 1 },
  to: { x: 8, y: 1 },
});
assert.equal(cornerClear.blocked, false, "orthogonal corner must not overblock distant transitions");
console.log("PASS orthogonal horizontal/vertical runs and 90-degree corner preserved on hex");

// --- Cover query shares the same coordinate contract -------------------------

const fenceMap = {
  mapType: "hex",
  grid: makeGrid(8, 8),
  structures: {
    orthogonalSegments: [
      { ...row2Wall, id: "row2-fence", kind: "fence", type: "fence", heightFeet: 4, providesCover: "partial" },
    ],
  },
};
const fenceCover = getCombatStructureCover({
  mapDefinition: fenceMap,
  index: createStructureSpatialIndex(fenceMap),
  from: { x: 1, y: 2 },
  to: { x: 2, y: 2 },
});
assert.equal(fenceCover.cover, "partial", "cover queries must use the same offset contract");
console.log("PASS cover query honors live odd-r offset positions");

console.log("PASS Milestone 8C P0 Repair 1 — hex structure query coordinate authority");

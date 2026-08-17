import assert from "node:assert/strict";
import {
  DEFAULT_TERRAIN_GEOMETRY_MODE,
  TERRAIN_GEOMETRY_MODES,
  computeTerrainBoundaryBottomY,
  normalizeTerrainGeometryMode,
  resolveTerracedEdgeWall,
} from "../src/utils/maps/terrainMeshAuthority.js";

assert.equal(DEFAULT_TERRAIN_GEOMETRY_MODE, "terraced");
assert.equal(normalizeTerrainGeometryMode(undefined), "terraced");
assert.equal(normalizeTerrainGeometryMode("minecraft"), "terraced");
assert.equal(normalizeTerrainGeometryMode("sloped"), "slope-aware");
assert.equal(normalizeTerrainGeometryMode("hybrid"), "slope-aware");

{
  const plan = resolveTerracedEdgeWall({
    ownTopY: 1,
    neighborTopY: 1,
    hasNeighbor: true,
  });
  assert.equal(plan.draw, false);
  assert.equal(plan.kind, "shared-flat");
}

{
  const plan = resolveTerracedEdgeWall({
    ownTopY: 2,
    neighborTopY: 1,
    hasNeighbor: true,
  });
  assert.equal(plan.draw, true);
  assert.equal(plan.kind, "interior-step");
  assert.equal(plan.upperY, 2);
  assert.equal(plan.lowerY, 1);
}

{
  const plan = resolveTerracedEdgeWall({
    ownTopY: 1,
    neighborTopY: 2,
    hasNeighbor: true,
  });
  assert.equal(plan.draw, false);
  assert.equal(plan.kind, "neighbor-higher");
}

{
  const bottom = computeTerrainBoundaryBottomY([0.25, 0.75, 1.25], 0.5, 0.25);
  assert.equal(bottom, -0.25);

  const plan = resolveTerracedEdgeWall({
    ownTopY: 0.75,
    hasNeighbor: false,
    boundaryBottomY: bottom,
  });
  assert.equal(plan.draw, true);
  assert.equal(plan.kind, "boundary");
  assert.equal(plan.lowerY, -0.25);
}

console.log("PASS terrain mesh authority");

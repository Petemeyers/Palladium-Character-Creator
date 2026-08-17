import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("src/utils/three/mapBuilder3D.js", "utf8");

assert.ok(source.includes('from "../maps/terrainMeshAuthority.js"'));
assert.ok(source.includes("function createTerracedHexColumnGeometry("));
assert.ok(source.includes("function createSlopeAwareHexColumnGeometry("));
assert.ok(source.includes("function createHexColumnGeometry("));
assert.ok(source.includes("getTerrainGeometryMode(tile)"));
assert.ok(source.includes("resolveTerracedEdgeWall({"));
assert.ok(source.includes("terrainGeometryMode: TERRAIN_GEOMETRY_MODES.TERRACED"));
assert.ok(source.includes("terrainGeometryMode: TERRAIN_GEOMETRY_MODES.SLOPE_AWARE"));
assert.ok(source.includes("hasBottomCap: false"));
assert.ok(source.includes("boundaryWallCount"));
assert.ok(source.includes("interiorWallCount"));

// Active geometry builders must not add per-hex bottom caps.
const terracedStart = source.indexOf("function createTerracedHexColumnGeometry(");
const meshStart = source.indexOf("\nexport function createHexMesh", terracedStart);
const activeGeometry = source.slice(terracedStart, meshStart);
assert.ok(!activeGeometry.includes("addBottomFace("));

// The legacy helper may remain for compatibility, but it cannot be used
// by the active terrain builders after stabilization.
assert.ok(source.includes("function addBottomFace("));

console.log("PASS Milestone 8C-7 terrain mesh source contract");

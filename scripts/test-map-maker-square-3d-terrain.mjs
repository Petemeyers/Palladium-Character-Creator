import fs from "node:fs";
import assert from "node:assert/strict";

const arena = fs.readFileSync("src/utils/three/HexArena.js", "utf8");
const builder = fs.readFileSync("src/utils/three/mapBuilder3D.js", "utf8");
const square = fs.readFileSync(
  "src/utils/three/squareMapBuilder3D.js",
  "utf8"
);

assert.ok(builder.includes("export function createTerrainTexture("));
assert.ok(builder.includes("export function normalizeTerrainName("));

assert.ok(arena.includes('from "./squareMapBuilder3D.js"'));
assert.ok(arena.includes("function normalizeArenaMapType(value)"));
assert.ok(arena.includes("|map:${mapType}|"));
assert.ok(arena.includes('mapType === "square"'));
assert.ok(arena.includes("buildSquare3DFromGrid(grid, SQUARE_TILE_SIZE)"));
assert.ok(arena.includes("syncSquareGridDiffToGroup({"));
assert.ok(arena.includes("tileMesh.position.x"));
assert.ok(arena.includes("tileMesh.position.z"));

assert.ok(square.includes("export const SQUARE_TILE_SIZE"));
assert.ok(square.includes("function squareSurfaceWorldY"));
assert.ok(square.includes("resolveTerracedEdgeWall({"));
assert.ok(square.includes("export function buildSquare3DFromGrid"));
assert.ok(square.includes("export function syncSquareGridDiffToGroup"));
assert.ok(square.includes('mapType: "square"'));
assert.ok(square.includes("hasBottomCap: false"));
assert.ok(square.includes("SQUARE_DIRECTIONS"));

console.log("PASS square map 3D terrain source contract");

import assert from "node:assert/strict";
import {
  applyGridStructureEdgeEdit,
  deleteGridCellStructures,
  getGridCellStructureEdge,
  getGridStructureDirections,
  gridStructureBlocksLineOfSight,
  gridStructureBlocksMovement,
} from "../src/utils/maps/gridStructureAuthority.js";
import {
  applyGridStructureWallLine,
  buildHexStructureCellPath,
} from "../src/utils/maps/gridStructureGenerator.js";
import {
  getSquareCellStructureEdge,
} from "../src/utils/maps/squareStructureAuthority.js";

const makeGrid = (width = 9, height = 9) =>
  Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({
      terrain: "grass",
      terrainType: "grass",
      height: 0,
      elevation: 0,
    }))
  );

assert.deepEqual(
  getGridStructureDirections("square").map((d) => d.key),
  ["N", "E", "S", "W"]
);
assert.deepEqual(
  getGridStructureDirections("hex").map((d) => d.key),
  ["E", "SE", "SW", "W", "NW", "NE"]
);

{
  const grid = makeGrid();
  const result = applyGridStructureEdgeEdit({
    grid,
    mapType: "hex",
    x: 4,
    y: 4,
    direction: "E",
    edge: { kind: "wall", material: "stone", heightFeet: 12 },
  });
  assert.equal(result.accepted, true);
  assert.equal(getGridCellStructureEdge(result.grid[4][4], "E", "hex")?.kind, "wall");
  assert.equal(getGridCellStructureEdge(result.grid[4][5], "W", "hex")?.kind, "wall");
  assert.equal(gridStructureBlocksMovement(result.grid[4][4], "E", "hex"), true);
  assert.equal(gridStructureBlocksLineOfSight(result.grid[4][4], "E", "hex"), true);
}

{
  const grid = makeGrid();
  const result = applyGridStructureEdgeEdit({
    grid,
    mapType: "hex",
    x: 4,
    y: 4,
    direction: "SE",
    edge: { kind: "gate", material: "wood", open: true },
  });
  assert.equal(result.accepted, true);
  assert.equal(getGridCellStructureEdge(result.grid[4][4], "SE", "hex")?.open, true);
  assert.equal(getGridCellStructureEdge(result.grid[5][4], "NW", "hex")?.kind, "gate");
  assert.equal(gridStructureBlocksMovement(result.grid[4][4], "SE", "hex"), false);
  assert.equal(gridStructureBlocksLineOfSight(result.grid[4][4], "SE", "hex"), false);
}

{
  const grid = makeGrid();
  const result = applyGridStructureEdgeEdit({
    grid,
    mapType: "square",
    x: 3,
    y: 3,
    direction: "S",
    edge: { kind: "wall", material: "brick" },
  });
  assert.equal(result.accepted, true);
  assert.equal(getGridCellStructureEdge(result.grid[3][3], "S", "square")?.kind, "wall");
  assert.equal(getGridCellStructureEdge(result.grid[4][3], "N", "square")?.kind, "wall");
}

{
  let grid = makeGrid();
  for (const direction of ["E", "SE", "SW", "W", "NW", "NE"]) {
    const result = applyGridStructureEdgeEdit({
      grid,
      mapType: "hex",
      x: 4,
      y: 4,
      direction,
      edge: { kind: direction === "E" ? "palisade" : "fence", material: "wood" },
    });
    assert.equal(result.accepted, true);
    grid = result.grid;
  }
  const removed = deleteGridCellStructures({ grid, mapType: "hex", x: 4, y: 4 });
  assert.equal(removed.accepted, true);
  assert.equal(Object.keys(removed.grid[4][4].walls || {}).length, 0);
}

{
  const path = buildHexStructureCellPath({ x: 1, y: 2 }, { x: 6, y: 2 });
  assert.ok(path.length >= 6);
  assert.deepEqual(path[0], { x: 1, y: 2 });
  assert.deepEqual(path[path.length - 1], { x: 6, y: 2 });

  const left = applyGridStructureWallLine({
    grid: makeGrid(),
    mapType: "hex",
    start: { x: 1, y: 2 },
    end: { x: 6, y: 2 },
    side: "left",
    edge: { kind: "palisade", material: "wood", heightFeet: 8 },
  });
  const right = applyGridStructureWallLine({
    grid: makeGrid(),
    mapType: "hex",
    start: { x: 1, y: 2 },
    end: { x: 6, y: 2 },
    side: "right",
    edge: { kind: "wall", material: "stone" },
  });
  assert.equal(left.accepted, true);
  assert.equal(right.accepted, true);
  assert.ok(left.appliedEdges >= 6);
  assert.ok(right.appliedEdges >= 6);
  assert.equal(left.side, "left");
  assert.equal(right.side, "right");
}

{
  const grid = makeGrid();
  const result = applyGridStructureEdgeEdit({
    grid,
    mapType: "square",
    x: 2,
    y: 2,
    direction: "E",
    edge: { kind: "door", material: "wood", open: false, heightFeet: 10 },
  });
  assert.equal(result.accepted, true);
  assert.equal(getSquareCellStructureEdge(result.grid[2][2], "E")?.kind, "door");
  assert.equal(getSquareCellStructureEdge(result.grid[2][3], "W")?.kind, "door");
}

console.log("PASS universal grid structure authority");

import assert from "node:assert/strict";
import {
  applySquareStructureEdgeEdit,
  getSquareCellStructureEdge,
  squareStructureBlocksLineOfSight,
  squareStructureBlocksMovement,
} from "../src/utils/maps/squareStructureAuthority.js";

const grid = Array.from({ length: 3 }, () =>
  Array.from({ length: 3 }, () => ({ terrain: "stone-floor", height: 0, elevation: 0 }))
);

{
  const result = applySquareStructureEdgeEdit({
    grid, x: 1, y: 1, direction: "E",
    edge: { kind: "wall", material: "stone", heightFeet: 12 },
  });
  assert.equal(result.accepted, true);
  const east = getSquareCellStructureEdge(result.grid[1][1], "E");
  const west = getSquareCellStructureEdge(result.grid[1][2], "W");
  assert.equal(east.kind, "wall");
  assert.equal(west.kind, "wall");
  assert.equal(east.heightFeet, 12);
  assert.equal(squareStructureBlocksMovement(result.grid[1][1], "E"), true);
  assert.equal(squareStructureBlocksLineOfSight(result.grid[1][1], "E"), true);
}

{
  const result = applySquareStructureEdgeEdit({
    grid, x: 1, y: 1, direction: "N",
    edge: { kind: "window", material: "wood", heightFeet: 8 },
  });
  assert.equal(squareStructureBlocksMovement(result.grid[1][1], "N"), true);
  assert.equal(squareStructureBlocksLineOfSight(result.grid[1][1], "N"), false);
}

{
  const closed = applySquareStructureEdgeEdit({
    grid, x: 1, y: 1, direction: "S", edge: { kind: "door", open: false },
  });
  assert.equal(squareStructureBlocksMovement(closed.grid[1][1], "S"), true);
  assert.equal(squareStructureBlocksLineOfSight(closed.grid[1][1], "S"), true);

  const open = applySquareStructureEdgeEdit({
    grid, x: 1, y: 1, direction: "S", edge: { kind: "door", open: true },
  });
  assert.equal(squareStructureBlocksMovement(open.grid[1][1], "S"), false);
  assert.equal(squareStructureBlocksLineOfSight(open.grid[1][1], "S"), false);
}

{
  const applied = applySquareStructureEdgeEdit({
    grid, x: 1, y: 1, direction: "W", edge: { kind: "archway" },
  });
  assert.equal(squareStructureBlocksMovement(applied.grid[1][1], "W"), false);
  assert.equal(squareStructureBlocksLineOfSight(applied.grid[1][1], "W"), false);

  const removed = applySquareStructureEdgeEdit({
    grid: applied.grid, x: 1, y: 1, direction: "W", remove: true,
  });
  assert.equal(getSquareCellStructureEdge(removed.grid[1][1], "W"), null);
  assert.equal(getSquareCellStructureEdge(removed.grid[1][0], "E"), null);
}


{
  const applied = applySquareStructureEdgeEdit({
    grid,
    x: 1,
    y: 1,
    direction: "E",
    edge: { kind: "wall", material: "brick", heightFeet: 9 },
  });
  const roundTrip = JSON.parse(JSON.stringify(applied.grid));
  assert.equal(getSquareCellStructureEdge(roundTrip[1][1], "E").material, "brick");
  assert.equal(getSquareCellStructureEdge(roundTrip[1][2], "W").heightFeet, 9);
}

console.log("PASS square structural edge authority");

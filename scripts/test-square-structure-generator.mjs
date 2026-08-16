import assert from "node:assert/strict";
import {
  applySquareStructureRoom,
  applySquareStructureWallLine,
  generateSquareBuilding,
} from "../src/utils/maps/squareStructureGenerator.js";
import {
  getSquareCellStructureEdge,
} from "../src/utils/maps/squareStructureAuthority.js";

const makeGrid = (width = 14, height = 12) =>
  Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({
      terrain: "stone-floor",
      terrainType: "stone-floor",
      height: 0,
      elevation: 0,
    }))
  );

{
  const grid = makeGrid();
  const result = applySquareStructureRoom({
    grid,
    start: { x: 2, y: 2 },
    end: { x: 6, y: 5 },
    edge: { kind: "wall", material: "stone", heightFeet: 10 },
  });
  assert.equal(result.accepted, true);
  assert.equal(getSquareCellStructureEdge(result.grid[2][2], "N")?.kind, "wall");
  assert.equal(getSquareCellStructureEdge(result.grid[5][6], "S")?.kind, "wall");
  assert.equal(getSquareCellStructureEdge(result.grid[3][2], "W")?.kind, "wall");
  assert.equal(getSquareCellStructureEdge(result.grid[4][6], "E")?.kind, "wall");
  // Mirrored shared edge outside the room boundary.
  assert.equal(getSquareCellStructureEdge(result.grid[3][1], "E")?.kind, "wall");
}

{
  const grid = makeGrid();
  const result = applySquareStructureWallLine({
    grid,
    start: { x: 2, y: 3 },
    end: { x: 8, y: 3 },
    edge: { kind: "wall", material: "wood", heightFeet: 8 },
  });
  assert.equal(result.accepted, true);
  assert.equal(result.orientation, "horizontal");
  assert.ok(result.appliedEdges >= 7);
}

{
  const gridA = makeGrid();
  const gridB = makeGrid();
  const input = {
    start: { x: 2, y: 2 },
    end: { x: 10, y: 8 },
    seed: "tavern-428763",
    template: "tavern",
    material: "wood",
    heightFeet: 10,
    wealth: "common",
    windowStyle: "auto",
    furnish: true,
  };

  const a = generateSquareBuilding({ grid: gridA, ...input });
  const b = generateSquareBuilding({ grid: gridB, ...input });

  assert.equal(a.accepted, true);
  assert.equal(a.template, "tavern");
  assert.equal(a.windowStyle, "leaded");
  assert.ok(a.appliedEdges > 20);
  assert.ok(a.propSuggestions.some((prop) => prop.type === "table"));
  assert.ok(a.propSuggestions.some((prop) => prop.type === "hearth"));

  const signature = (result) => JSON.stringify({
    walls: result.grid.flat().map((cell) => cell.walls || {}),
    props: result.propSuggestions,
    entrance: result.entrance,
  });
  assert.equal(signature(a), signature(b));

  const entrance = getSquareCellStructureEdge(
    a.grid[a.entrance.y][a.entrance.x],
    a.entrance.direction
  );
  assert.equal(entrance?.kind, "door");
  assert.equal(entrance?.open, false);

  const generatedWindows = a.grid
    .flat()
    .flatMap((cell) => Object.values(cell.walls || {}))
    .filter((edge) => edge?.kind === "window");
  assert.ok(generatedWindows.length > 0);
  assert.ok(generatedWindows.some((edge) => edge.windowStyle === "leaded"));
}

{
  const poor = generateSquareBuilding({
    grid: makeGrid(),
    start: { x: 3, y: 3 },
    end: { x: 8, y: 7 },
    seed: "poor-cottage",
    template: "cottage",
    wealth: "poor",
    windowStyle: "auto",
    furnish: false,
  });
  assert.equal(poor.windowStyle, "shuttered");

  const chapel = generateSquareBuilding({
    grid: makeGrid(),
    start: { x: 2, y: 2 },
    end: { x: 9, y: 9 },
    seed: "wealthy-chapel",
    template: "chapel",
    wealth: "wealthy",
    windowStyle: "auto",
    furnish: false,
  });
  assert.equal(chapel.windowStyle, "stained");
}

console.log("PASS square structure drag and seeded building generator");

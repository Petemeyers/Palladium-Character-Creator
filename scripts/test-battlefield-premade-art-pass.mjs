import assert from "node:assert/strict";
import {
  BATTLEFIELD_PRESET_ART_VERSION,
  applyBattlefieldPresetArtPass,
} from "../src/utils/maps/battlefieldPresetArtPass.js";

const makeGrid = (width = 40, height = 30) =>
  Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      x,
      y,
      terrain: "grass",
      terrainType: "grass",
      visualTerrain: "grass",
      formationType: "open-ground",
      combatTerrainType: "open-ground",
      elevation: 0,
      height: 0,
      walkable: true,
      isWalkable: true,
      cover: 0,
    }))
  );

const cells = (grid) => grid.flat();
const countTerrain = (grid, terrain) =>
  cells(grid).filter((cell) => cell.terrain === terrain).length;

{
  const grid = makeGrid();
  const props = [];
  const result = applyBattlefieldPresetArtPass({
    presetKey: "mountain-pass",
    grid,
    props,
    seed: "mcs-mountain-pass-1",
  });

  const elevations = cells(grid).map((cell) => Number(cell.elevation) || 0);
  const roads = countTerrain(grid, "road");
  const rockLike = cells(grid).filter((cell) =>
    ["rock", "rubble"].includes(cell.terrain)
  ).length;
  const crowns = cells(grid).filter(
    (cell) => cell.presetFeature === "mountain-crown"
  ).length;
  const shoulders = cells(grid).filter(
    (cell) => cell.presetFeature === "mountain-shoulder"
  ).length;

  assert.equal(result.version, BATTLEFIELD_PRESET_ART_VERSION);
  assert.ok(Math.max(...elevations) >= 7, "mountain crowns should be visibly high");
  assert.ok(roads >= 30, "pass floor should span most of the map");
  assert.ok(rockLike >= 100, "mountains should read as rock/rubble rather than flat grass");
  assert.ok(crowns > 0);
  assert.ok(shoulders > 0);

  // Deployment shelves should remain low/readable.
  for (const x of [0, 1, 2, 37, 38, 39]) {
    assert.ok(grid.every((row) => Number(row[x].elevation) <= 1));
    assert.ok(grid.every((row) => row[x].walkable !== false));
  }
}

{
  const grid = makeGrid();
  const props = [];
  const result = applyBattlefieldPresetArtPass({
    presetKey: "river-crossing",
    grid,
    props,
    seed: "mcs-river-crossing-1",
  });

  const water = cells(grid).filter((cell) => cell.terrain === "water");
  const ford = water.filter((cell) => cell.waterTraversal === "wade");
  const swim = water.filter((cell) => cell.waterTraversal === "swim");
  const depths = new Set(water.map((cell) => Number(cell.waterDepthFeet) || 0));

  assert.equal(result.preset, "river-crossing");
  assert.ok(water.length > 40);
  assert.ok(ford.length > 0);
  assert.ok(ford.every((cell) => cell.walkable !== false));
  assert.ok(swim.length > 0);
  assert.ok(swim.some((cell) => cell.walkable === false));
  assert.ok(depths.size >= 2);
  assert.ok(water.every((cell) => cell.waterCurrent?.direction === "S"));
}

{
  const grid = makeGrid();
  const props = [];
  applyBattlefieldPresetArtPass({
    presetKey: "mixed-wilderness",
    grid,
    props,
    seed: "mcs-forest-road-1",
  });

  assert.ok(countTerrain(grid, "road") >= 35);
  assert.ok(countTerrain(grid, "forest") >= 300);
  assert.ok(props.some((prop) => prop.type === "tree"));
}

{
  const grid = makeGrid();
  const props = [];
  applyBattlefieldPresetArtPass({
    presetKey: "hilltop-defense",
    grid,
    props,
    seed: "mcs-hilltop-defense-1",
  });

  const center = grid[Math.floor(grid.length / 2)][Math.floor(grid[0].length / 2)];
  const edge = grid[Math.floor(grid.length / 2)][0];
  assert.ok(Number(center.elevation) >= 5);
  assert.ok(Number(edge.elevation) <= 1);
  assert.ok(countTerrain(grid, "road") > 0);
}

{
  const one = makeGrid();
  const two = makeGrid();
  const oneProps = [];
  const twoProps = [];

  applyBattlefieldPresetArtPass({
    presetKey: "mountain-pass",
    grid: one,
    props: oneProps,
    seed: "determinism-check",
  });
  applyBattlefieldPresetArtPass({
    presetKey: "mountain-pass",
    grid: two,
    props: twoProps,
    seed: "determinism-check",
  });

  const signature = (grid, props) => JSON.stringify({
    cells: grid.flat().map((cell) => [
      cell.terrain,
      cell.elevation,
      cell.walkable,
      cell.presetFeature,
    ]),
    props: props.map((prop) => [
      prop.type,
      prop.x,
      prop.y,
      prop.rotation,
      prop.scale,
    ]),
  });

  assert.equal(signature(one, oneProps), signature(two, twoProps));
}

console.log("PASS battlefield premade preset art authority");

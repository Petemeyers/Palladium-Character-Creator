import assert from "node:assert/strict";
import {
  WATER_DEPTH_BANDS,
  WATER_TRAVERSAL_REASONS,
  applyWaterEnvironmentToCell,
  assessWaterTraversalRisk,
  getWaterDepthBand,
  getWaterEnvironmentFromCell,
  getWaterTraversalSurfacesAt,
  projectWaterCurrentDrift,
  resolveBattlefieldWaterTraversalStep,
  resolveWaterLayerTransition,
} from "../src/utils/maps/waterTraversalAuthority.js";
import {
  createBridgeOnMap,
} from "../src/utils/maps/bridgeLayerAuthority.js";

const makeCell = (terrain = "grass", height = 0) => ({
  terrain,
  terrainType: terrain,
  height,
  elevation: height,
  walkable: true,
  isWalkable: true,
});

const makeMap = (width = 8, height = 6, mapType = "hex") => ({
  mapType,
  width,
  height,
  size: { width, height },
  mapSize: { width, height },
  grid: Array.from({ length: height }, () =>
    Array.from({ length: width }, () => makeCell())
  ),
});

{
  const adult = { heightFeet: 6 };
  assert.equal(getWaterDepthBand(0, adult), WATER_DEPTH_BANDS.DRY);
  assert.equal(getWaterDepthBand(0.4, adult), WATER_DEPTH_BANDS.ANKLE);
  assert.equal(getWaterDepthBand(1, adult), WATER_DEPTH_BANDS.SHIN);
  assert.equal(getWaterDepthBand(1.7, adult), WATER_DEPTH_BANDS.KNEE);
  assert.equal(getWaterDepthBand(2.8, adult), WATER_DEPTH_BANDS.WAIST);
  assert.equal(getWaterDepthBand(4, adult), WATER_DEPTH_BANDS.CHEST);
  assert.equal(getWaterDepthBand(5, adult), WATER_DEPTH_BANDS.SWIMMING);
  assert.equal(getWaterDepthBand(7, adult), WATER_DEPTH_BANDS.DEEP);
}

{
  const child = { heightFeet: 4 };
  const tall = { heightFeet: 8 };
  assert.equal(getWaterDepthBand(3.2, child), WATER_DEPTH_BANDS.SWIMMING);
  assert.equal(getWaterDepthBand(3.2, tall), WATER_DEPTH_BANDS.WAIST);
}

{
  const cell = applyWaterEnvironmentToCell(makeCell("grass"), {
    waterDepthFeet: 3,
    waterCurrentStrength: "moderate",
    waterCurrentDirection: "E",
    waterBottomTerrain: "mud",
    waterTemperatureF: 48,
  });
  const env = getWaterEnvironmentFromCell(cell, { heightFeet: 6 });
  assert.equal(cell.terrain, "water");
  assert.equal(env.depthFeet, 3);
  assert.equal(env.depthBand, WATER_DEPTH_BANDS.WAIST);
  assert.equal(env.current.strength, "moderate");
  assert.equal(env.current.direction, "E");
  assert.equal(env.bottomTerrain, "mud");
  assert.equal(env.temperatureF, 48);
}

{
  const map = makeMap();
  map.grid[2][2] = applyWaterEnvironmentToCell(makeCell("water"), {
    waterDepthFeet: 3,
    waterCurrentStrength: "moderate",
    waterCurrentDirection: "E",
    waterBottomTerrain: "mud",
  });

  const result = resolveBattlefieldWaterTraversalStep({
    mapDefinition: map,
    from: { x: 1, y: 2 },
    to: { x: 2, y: 2 },
    movementMode: "walk",
    actorProfile: { heightFeet: 6 },
    baseDistanceFeet: 5,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.enteredWater, true);
  assert.equal(result.depthBand, WATER_DEPTH_BANDS.WAIST);
  assert.equal(result.requiresWalk, true);
  assert.ok(result.extraDistanceFeet > 2);
  assert.ok(result.staminaCost >= 2);
  assert.equal(result.currentRelation.relation, "downstream");
  assert.equal(result.bottomTerrain, "mud");
}

{
  const map = makeMap();
  map.grid[2][2] = applyWaterEnvironmentToCell(makeCell("water"), {
    waterDepthFeet: 5.5,
    waterCurrentStrength: "none",
  });

  const walk = resolveBattlefieldWaterTraversalStep({
    mapDefinition: map,
    from: { x: 1, y: 2 },
    to: { x: 2, y: 2 },
    movementMode: "walk",
    actorProfile: { heightFeet: 6 },
  });
  assert.equal(walk.accepted, false);
  assert.equal(walk.reason, WATER_TRAVERSAL_REASONS.SWIM_REQUIRED);

  const swim = resolveBattlefieldWaterTraversalStep({
    mapDefinition: map,
    from: { x: 1, y: 2 },
    to: { x: 2, y: 2 },
    movementMode: "swim",
    actorProfile: { heightFeet: 6 },
  });
  assert.equal(swim.accepted, true);
  assert.equal(swim.requiresSwim, true);
}

{
  const map = makeMap();
  map.grid[2][2] = applyWaterEnvironmentToCell(makeCell("water"), {
    waterDepthFeet: 2,
  });

  const charge = resolveBattlefieldWaterTraversalStep({
    mapDefinition: map,
    from: { x: 1, y: 2 },
    to: { x: 2, y: 2 },
    movementMode: "charge",
    actorProfile: { heightFeet: 6 },
  });

  assert.equal(charge.accepted, false);
  assert.equal(charge.reason, WATER_TRAVERSAL_REASONS.CHARGE_BLOCKED);
}

{
  const map = makeMap();
  map.grid[2][2] = applyWaterEnvironmentToCell(makeCell("water"), {
    waterDepthFeet: 5,
    waterCurrentStrength: "rapid",
    waterCurrentDirection: "S",
  });

  const loose = projectWaterCurrentDrift({
    mapDefinition: map,
    position: { x: 2, y: 2 },
    actorProfile: { heightFeet: 6 },
  });

  const rope = projectWaterCurrentDrift({
    mapDefinition: map,
    position: { x: 2, y: 2 },
    actorProfile: {
      heightFeet: 6,
      holdingSafetyLine: true,
    },
  });

  assert.equal(loose.active, true);
  assert.equal(loose.direction, "S");
  assert.ok(loose.driftCells > rope.driftCells);
  assert.ok(rope.driftCells >= 0);
}

{
  const map = makeMap(8, 6, "hex");
  for (let x = 1; x <= 6; x += 1) {
    map.grid[3][x] = applyWaterEnvironmentToCell(
      makeCell("water", -2),
      {
        waterDepthFeet: 7,
        waterCurrentStrength: "moderate",
        waterCurrentDirection: "E",
      }
    );
  }

  const bridgeResult = createBridgeOnMap({
    mapDefinition: map,
    start: { x: 1, y: 3 },
    end: { x: 6, y: 3 },
    deckRiseFeet: 1,
    seed: "water-authority-bridge",
  });
  assert.equal(bridgeResult.accepted, true);

  const bridged = bridgeResult.mapDefinition;
  const surfaces = getWaterTraversalSurfacesAt(
    bridged,
    { x: 3, y: 3 },
    { heightFeet: 6 }
  );

  assert.equal(surfaces[0].type, "water");
  assert.ok(surfaces.some((surface) => surface.type === "bridge-deck"));

  const deckStep = resolveBattlefieldWaterTraversalStep({
    mapDefinition: bridged,
    from: { x: 2, y: 3 },
    to: { x: 3, y: 3 },
    fromLayer: "bridge-deck",
    toLayer: "bridge-deck",
    movementMode: "walk",
  });
  assert.equal(deckStep.accepted, true);
  assert.equal(deckStep.isWaterTraversal, false);
  assert.equal(deckStep.surfaceType, "bridge-deck");

  const layerChange = resolveWaterLayerTransition({
    mapDefinition: bridged,
    position: { x: 3, y: 3 },
    fromLayer: "lower",
    toLayer: "bridge-deck",
    accessAuthorized: false,
  });
  assert.equal(layerChange.accepted, false);
  assert.equal(
    layerChange.reason,
    WATER_TRAVERSAL_REASONS.VERTICAL_LAYER_ACCESS
  );
}

{
  const map = makeMap(6, 6, "square");
  map.grid[2][2] = applyWaterEnvironmentToCell(makeCell("water"), {
    waterDepthFeet: 4,
    waterCurrentStrength: "strong",
    waterCurrentDirection: "N",
  });
  const env = getWaterEnvironmentFromCell(map.grid[2][2], {
    heightFeet: 5,
  });
  assert.equal(env.isWater, true);
  assert.equal(env.current.direction, "N");
}


{
  const shallowRisk = assessWaterTraversalRisk({
    cell: applyWaterEnvironmentToCell(makeCell("water"), {
      waterDepthFeet: 1,
      waterCurrentStrength: "light",
    }),
    actorProfile: {
      heightFeet: 6,
      armorWaterBurden: "none",
    },
  });

  const armoredRapidRisk = assessWaterTraversalRisk({
    cell: applyWaterEnvironmentToCell(makeCell("water"), {
      waterDepthFeet: 5.5,
      waterCurrentStrength: "strong",
    }),
    actorProfile: {
      heightFeet: 6,
      armorWaterBurden: "severe",
      carriedLoadFraction: 0.8,
    },
  });

  const safetyLineRisk = assessWaterTraversalRisk({
    cell: applyWaterEnvironmentToCell(makeCell("water"), {
      waterDepthFeet: 5.5,
      waterCurrentStrength: "strong",
    }),
    actorProfile: {
      heightFeet: 6,
      armorWaterBurden: "severe",
      carriedLoadFraction: 0.8,
      holdingSafetyLine: true,
    },
  });

  assert.equal(shallowRisk.category, "low");
  assert.ok(armoredRapidRisk.score >= 75);
  assert.equal(armoredRapidRisk.category, "severe");
  assert.ok(safetyLineRisk.score < armoredRapidRisk.score);
  assert.ok(armoredRapidRisk.flags.includes("swimming-required"));
  assert.ok(armoredRapidRisk.flags.includes("heavy-water-burden"));
}

console.log("PASS water traversal authority");

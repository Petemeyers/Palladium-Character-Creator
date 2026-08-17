import assert from "node:assert/strict";
import {
  resolveBattlefieldTraversalStep,
  resolveBattlefieldPathTraversal,
} from "../src/utils/maps/battlefieldTraversalAuthority.js";
import {
  applyWaterEnvironmentToCell,
  WATER_TRAVERSAL_REASONS,
} from "../src/utils/maps/waterTraversalAuthority.js";
import {
  createBridgeOnMap,
} from "../src/utils/maps/bridgeLayerAuthority.js";

const makeCell = () => ({
  terrain: "grass",
  terrainType: "grass",
  height: 0,
  elevation: 0,
  walkable: true,
});

const map = {
  mapType: "hex",
  width: 7,
  height: 5,
  size: { width: 7, height: 5 },
  mapSize: { width: 7, height: 5 },
  grid: Array.from({ length: 5 }, () =>
    Array.from({ length: 7 }, makeCell)
  ),
};

map.grid[2][2] = applyWaterEnvironmentToCell(makeCell(), {
  waterDepthFeet: 3,
  waterCurrentStrength: "strong",
  waterCurrentDirection: "E",
  waterBottomTerrain: "mud",
});

{
  const traversal = resolveBattlefieldTraversalStep({
    mapDefinition: map,
    from: { x: 1, y: 2 },
    to: { x: 2, y: 2 },
    movementMode: "walk",
    waterProfile: {
      heightFeet: 6,
      armorWaterBurden: "moderate",
    },
  });

  assert.equal(traversal.accepted, true);
  assert.equal(traversal.waterTraversal?.isWaterTraversal, true);
  assert.ok(traversal.effectiveDistanceFeet > 5);
  assert.ok(traversal.staminaCost >= 2);
}

map.grid[2][3] = applyWaterEnvironmentToCell(makeCell(), {
  waterDepthFeet: 5.5,
  waterCurrentStrength: "moderate",
  waterCurrentDirection: "E",
});

{
  const blocked = resolveBattlefieldTraversalStep({
    mapDefinition: map,
    from: { x: 2, y: 2 },
    to: { x: 3, y: 2 },
    movementMode: "walk",
    waterProfile: { heightFeet: 6 },
  });
  assert.equal(blocked.accepted, false);
  assert.equal(blocked.reason, WATER_TRAVERSAL_REASONS.SWIM_REQUIRED);

  const swim = resolveBattlefieldTraversalStep({
    mapDefinition: map,
    from: { x: 2, y: 2 },
    to: { x: 3, y: 2 },
    movementMode: "swim",
    swimAuthorized: true,
    waterProfile: { heightFeet: 6 },
  });
  assert.equal(swim.accepted, true);
  assert.equal(swim.waterTraversal.requiresSwim, true);
}

{
  const path = resolveBattlefieldPathTraversal({
    mapDefinition: map,
    from: { x: 1, y: 2 },
    to: { x: 3, y: 2 },
    path: [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ],
    movementMode: "swim",
    swimAuthorized: true,
    waterProfile: { heightFeet: 6 },
    maxDistanceFeet: 50,
  });

  assert.equal(path.accepted, true);
  assert.equal(path.transitions.length, 2);
  assert.ok(path.extraDistanceFeet > 0);
  assert.ok(path.staminaCost > 0);
}

{
  const bridgeMap = {
    ...map,
    grid: map.grid.map((row) =>
      row.map((cell) => ({
        ...cell,
        verticalLayers: Array.isArray(cell.verticalLayers)
          ? [...cell.verticalLayers]
          : [],
      }))
    ),
  };

  const bridge = createBridgeOnMap({
    mapDefinition: bridgeMap,
    start: { x: 1, y: 2 },
    end: { x: 4, y: 2 },
    seed: "d1-integration-bridge",
  });
  assert.equal(bridge.accepted, true);

  const deckTraversal = resolveBattlefieldTraversalStep({
    mapDefinition: bridge.mapDefinition,
    from: { x: 2, y: 2 },
    to: { x: 3, y: 2 },
    movementMode: "walk",
    fromLayer: "bridge-deck",
    toLayer: "bridge-deck",
  });

  assert.equal(deckTraversal.accepted, true);
  assert.equal(deckTraversal.waterTraversal?.surfaceType, "bridge-deck");
  assert.equal(deckTraversal.waterTraversal?.isWaterTraversal, false);
}

console.log("PASS canonical traversal consumes water authority");

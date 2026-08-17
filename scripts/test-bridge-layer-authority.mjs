import assert from "node:assert/strict";
import {
  createBridgeOnMap,
  deleteBridgeFromMap,
  getBridgeDeckLayersAt,
  getVerticalTraversalLayersAt,
} from "../src/utils/maps/bridgeLayerAuthority.js";

const makeMap = (mapType = "hex") => {
  const width = 9;
  const height = 7;
  const grid = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      terrain: x >= 2 && x <= 6 ? "water" : "grass",
      terrainType: x >= 2 && x <= 6 ? "water" : "grass",
      height: x >= 2 && x <= 6 ? -2 : 0,
      elevation: x >= 2 && x <= 6 ? -2 : 0,
      walkable: x < 2 || x > 6,
      waterDepthFeet: x >= 2 && x <= 6 ? 7 : 0,
    }))
  );
  return { mapType, width, height, mapSize: { width, height }, grid };
};

for (const mapType of ["hex", "square"]) {
  const base = makeMap(mapType);
  const result = createBridgeOnMap({
    mapDefinition: base,
    start: { x: 1, y: 3 },
    end: { x: 7, y: 3 },
    material: "wood",
    widthFeet: 8,
    deckRiseFeet: 0.75,
    railings: true,
    supports: true,
    supportSpacingCells: 2,
    seed: `river-bridge-${mapType}`,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.bridge.mapType, mapType);
  assert.equal(result.bridge.path.length, 7);
  assert.equal(result.bridge.deckElevationFeet, 0.75);
  assert.ok(result.mapDefinition.structures.bridges.some((bridge) => bridge.id === result.bridge.id));

  const middleLayers = getBridgeDeckLayersAt(result.mapDefinition, 4, 3);
  assert.equal(middleLayers.length, 1);
  assert.equal(middleLayers[0].traversal.lowerLayerPreserved, true);
  assert.equal(middleLayers[0].traversal.underpassAllowed, true);
  assert.equal(result.mapDefinition.grid[3][4].terrain, "water", "bridge must not replace lower water terrain");
  assert.equal(result.mapDefinition.grid[3][4].height, -2, "bridge must preserve water elevation");
  assert.ok(middleLayers[0].clearanceFeet >= 5);

  const traversal = getVerticalTraversalLayersAt(result.mapDefinition, 4, 3);
  assert.equal(traversal[0].layer, "ground");
  assert.equal(traversal[0].terrain, "water");
  assert.equal(traversal[1].layer, "bridge-deck");

  const deleted = deleteBridgeFromMap(result.mapDefinition, result.bridge.id);
  assert.equal(deleted.accepted, true);
  assert.equal(getBridgeDeckLayersAt(deleted.mapDefinition, 4, 3).length, 0);
  assert.equal(deleted.mapDefinition.grid[3][4].terrain, "water");
  assert.equal(deleted.mapDefinition.structures.bridges.length, 0);
}

console.log("PASS bridge over-under vertical layer authority");

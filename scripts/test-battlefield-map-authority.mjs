import assert from "node:assert/strict";
import {
  BATTLEFIELD_FOG,
  BATTLEFIELD_LIGHTING,
  getCombatTerrainAtCell,
  normalizeBattlefieldLighting,
  normalizeBattlefieldMap,
  normalizeEnvironmentalFog,
  validateBattlefieldMap,
} from "../src/utils/maps/battlefieldMapAuthority.js";

const legacy = {
  id: "legacy-1",
  name: "Old Forest",
  mapType: "hex",
  terrain: "DENSE_FOREST",
  lighting: "TRAIDERHLIGHT",
  mapSize: { width: 2, height: 2 },
  fogOfWarEnabled: true,
  grid: [
    [{ terrainType: "grass" }, { terrainType: "forest" }],
    [{ terrainType: "mud" }, { terrainType: "water", isWalkable: false }],
  ],
};

const normalized = normalizeBattlefieldMap(legacy);
assert.equal(normalized.schemaVersion, 2);
assert.equal(normalized.environment.lighting, BATTLEFIELD_LIGHTING.TORCHLIGHT);
assert.equal(normalized.environment.fogOfWar.enabled, true);
assert.equal(normalized.environment.environmentalFog.type, BATTLEFIELD_FOG.CLEAR);
assert.equal(getCombatTerrainAtCell(normalized.grid[0][0]), "open-ground");
assert.equal(getCombatTerrainAtCell(normalized.grid[0][1]), "forest");
assert.equal(getCombatTerrainAtCell(normalized.grid[1][0]), "mud");
assert.equal(getCombatTerrainAtCell(normalized.grid[1][1]), "deep-water");
assert.equal(normalized.grid[1][1].walkable, false);
assert.equal(normalizeBattlefieldLighting("darkness"), BATTLEFIELD_LIGHTING.DARKNESS);
assert.equal(normalizeEnvironmentalFog("dense fog"), BATTLEFIELD_FOG.DENSE_FOG);
assert.equal(validateBattlefieldMap(normalized).valid, true);
console.log("battlefield map authority: ok");

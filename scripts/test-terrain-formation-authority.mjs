import assert from "node:assert/strict";
import {
  FORMATION_TERRAIN_TYPES,
  normalizeFormationTerrainType,
  resolveFormationFacingPressure,
  resolveTerrainFormationContext,
} from "../src/utils/combat/terrainFormationAuthority.js";

assert.equal(normalizeFormationTerrainType("dense forest"), FORMATION_TERRAIN_TYPES.FOREST);
assert.equal(normalizeFormationTerrainType({ terrain: "broken rubble" }), FORMATION_TERRAIN_TYPES.RUBBLE);
assert.equal(normalizeFormationTerrainType("open field"), FORMATION_TERRAIN_TYPES.OPEN);

const front = resolveFormationFacingPressure({
  actorPosition: { x: 0, y: 0 },
  targetPosition: { x: 2, y: 0 },
  actorFacing: 0,
});
assert.equal(front.arc, "front");
assert.equal(front.flanked, false);

const rear = resolveFormationFacingPressure({
  actorPosition: { x: 0, y: 0 },
  targetPosition: { x: -2, y: 0 },
  actorFacing: 0,
});
assert.equal(rear.arc, "rear");
assert.equal(rear.supportModifier, -2);

const rubbleRear = resolveTerrainFormationContext({
  actorPosition: { x: 0, y: 0 },
  targetPosition: { x: -2, y: 0 },
  terrain: "rubble",
  targetTerrain: "open-ground",
});
assert.equal(rubbleRear.terrainType, FORMATION_TERRAIN_TYPES.RUBBLE);
assert.equal(rubbleRear.rearPressure, true);
assert.ok(rubbleRear.cohesionModifier <= -3);

const highGround = resolveTerrainFormationContext({
  actorPosition: { x: 0, y: 0 },
  targetPosition: { x: 2, y: 0 },
  terrain: "high ground",
  targetTerrain: "open ground",
});
assert.equal(highGround.elevatedAgainstLower, true);
assert.ok(highGround.cohesionModifier >= 1);
console.log("terrain formation authority test passed");

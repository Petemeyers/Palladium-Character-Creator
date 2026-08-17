import assert from "node:assert/strict";
import {
  PROP_INTERACTION_CAPABILITIES as C,
  getPropGameplayProfile,
  propHasCapability,
} from "../src/utils/maps/propCapabilityCatalog.js";
import { EXPANDED_BATTLEFIELD_PROP_DEFINITIONS } from "../src/utils/maps/expandedBattlefieldPropCatalog.js";

const table = getPropGameplayProfile("table");
assert.equal(propHasCapability(table, C.THROWABLE), true);
assert.equal(propHasCapability(table, C.DESTRUCTIBLE), true);
assert.equal(propHasCapability("barrel", C.ROLLABLE), true);
assert.equal(propHasCapability("barrel", C.LOOTABLE), true);
assert.equal(propHasCapability("wheat", C.HARVESTABLE), true);
assert.equal(propHasCapability("ladder", C.CLIMBABLE), true);
assert.equal(propHasCapability("document", C.READABLE), true);
assert.equal(propHasCapability("document", C.QUEST), true);
assert.equal(propHasCapability("rowboat", C.MOVABLE), true);

for (const type of [
  "table",
  "chair",
  "barrel",
  "hearth",
  "weapon-rack",
  "market-stall",
  "wheat",
  "barricade",
  "ladder",
  "rowboat",
]) {
  assert.ok(EXPANDED_BATTLEFIELD_PROP_DEFINITIONS[type], `missing ${type}`);
  assert.ok(EXPANDED_BATTLEFIELD_PROP_DEFINITIONS[type].gameplay);
}

console.log("PASS expanded prop capability vocabulary");

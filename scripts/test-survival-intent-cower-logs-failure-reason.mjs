import assert from "node:assert/strict";
import fs from "node:fs";
import { getSurvivalMovementFailureReason } from "../src/utils/routingSystem.js";
import { SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const base = {
  intent: SURVIVAL_INTENTS.REGROUP_WITH_ALLY,
  context: { nearbyAllies: [{ id: "ally" }] },
  positions: { ally: { x: 8, y: 5 } },
  currentPos: { x: 5, y: 5 },
  maxSteps: 3,
  getHexNeighbors: () => [],
  gridWidth: 40,
  gridHeight: 30,
};
assert.equal(getSurvivalMovementFailureReason(base), "all-candidates-blocked");
assert.equal(
  getSurvivalMovementFailureReason({ ...base, gridWidth: { terrain: true } }),
  "invalid-grid-arguments gridWidthType=object gridHeightType=number",
);
assert.equal(
  getSurvivalMovementFailureReason({ ...base, context: { nearbyAllies: [] } }),
  "no-valid-destination",
);

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const failure = source.indexOf("survival movement failed fighter=${fighter.name}");
const cower = source.indexOf("cannot find a safe ${fallbackLabel} path and cowers in place");
assert.ok(failure >= 0 && failure < cower, "browser cower is preceded by one diagnostic log");
console.log("survival intent cower failure-reason test passed");

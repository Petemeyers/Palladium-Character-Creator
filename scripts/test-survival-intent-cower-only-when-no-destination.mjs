import assert from "node:assert/strict";
import fs from "node:fs";
import { findSurvivalIntentDestination } from "../src/utils/routingSystem.js";
import { SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const getHexNeighbors = (x, y) => [
  { x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 },
];

const currentPos = { x: 5, y: 5 };
const blocked = findSurvivalIntentDestination({
  intent: SURVIVAL_INTENTS.REGROUP_WITH_ALLY,
  context: { nearbyAllies: [{ id: "ally" }] },
  positions: { ally: { x: 8, y: 5 } },
  currentPos,
  threatPositions: [{ x: 4, y: 5 }],
  maxSteps: 3,
  isHexOccupied: () => true,
  getHexNeighbors,
  isValidPosition: () => true,
  calculateDistance: (left, right) => Math.hypot(left.x - right.x, left.y - right.y) * 5,
});
assert.equal(blocked, null, "a fully blocked actor has no movement destination");

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /cannot find a safe \$\{fallbackLabel\} path and cowers in place/);
assert.match(combatPage, /survival movement failed fighter=\$\{fighter\.name\} intent=\$\{survivalIntent\} reason=\$\{failureReason\}/);
assert.doesNotMatch(combatPage, /holds a defensive position and cowers from the threat/);
assert.ok(
  combatPage.indexOf("survival movement failed fighter=${fighter.name}") <
    combatPage.indexOf("cannot find a safe ${fallbackLabel} path and cowers in place"),
  "cower always follows a single explicit movement failure reason",
);
console.log("survival intent cower fallback test passed");

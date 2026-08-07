import fs from "node:fs";
import assert from "node:assert/strict";

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const tacticalMap = fs.readFileSync(new URL("../src/components/TacticalMap.jsx", import.meta.url), "utf8");

assert.match(combatPage, /planDefaultTacticalMovement/);
assert.match(combatPage, /tacticalWalkPlansByActorRef/);
assert.match(combatPage, /mode: "walk"/);
assert.match(combatPage, /remainingPath/);
assert.match(combatPage, /incomingCharge \|\| closeBraceThreat/);
assert.match(combatPage, /targetPulseMs = Math\.max\(120, getSimulationDelay\(650/);
assert.match(combatPage, /pendingTacticalMovePresentationByActorRef/);
assert.doesNotMatch(
  combatPage,
  /\[actorId\]: \{ \.\.\.\(renderPositionsRef\.current\?\.\[actorId\] \|\| \{\}\), x: to\.x, y: to\.y \}/,
  "tactical commits must not snap renderPositions to the destination",
);
assert.match(tacticalMap, /isWalkingAnimation/);
assert.match(tacticalMap, /Math\.sin\(Math\.PI \* 4 \* movementProgress\)/);
assert.match(tacticalMap, /data-walk-ground-contact/);

const braceAllowed = ({ targetDistance, incomingCharge, caution = 60, aggression = 40, canBrace = true, pathLength = 4 }) => {
  const closeBraceThreat = targetDistance <= 15;
  return canBrace && caution > aggression && pathLength >= 2 && (incomingCharge || closeBraceThreat);
};
assert.equal(braceAllowed({ targetDistance: 90, incomingCharge: false }), false);
assert.equal(braceAllowed({ targetDistance: 15, incomingCharge: false }), true);
assert.equal(braceAllowed({ targetDistance: 90, incomingCharge: true }), true);

const remainingPath = (path, current) => {
  const reachedIndex = path.findIndex((step) => step.x === current.x && step.y === current.y);
  return reachedIndex >= 0 ? path.slice(reachedIndex + 1) : path.slice();
};
const path = [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
assert.deepEqual(remainingPath(path, { x: 1, y: 0 }), [{ x: 2, y: 0 }, { x: 3, y: 0 }]);
assert.deepEqual(remainingPath(path, { x: 2, y: 0 }), [{ x: 3, y: 0 }]);

console.log("tactical walk-action presentation regression: passed");

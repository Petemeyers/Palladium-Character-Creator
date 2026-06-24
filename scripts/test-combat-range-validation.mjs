import assert from "node:assert/strict";

import {
  getAttackReachOrRange,
  getDistanceBetweenCombatants,
  validateAttackRange,
} from "../src/utils/combatRangeValidation.js";
import { buildCombatActionCatalog } from "../src/utils/combatActionCatalog.js";

const hasFunction = (value) => {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(hasFunction);
};

const attacker = {
  id: "attacker-1",
  name: "Shield Bearer",
  position: { x: 0, y: 0 },
  remainingActions: 1,
  currentStamina: 2,
};
const closeTarget = {
  id: "target-close",
  name: "Close Raider",
  position: { x: 1, y: 0 },
};
const farTarget = {
  id: "target-far",
  name: "Far Raider",
  distanceFt: 16,
};
const meleeAttack = {
  name: "Shortsword",
  attackType: "melee",
  reach: "5 ft",
};
const rangedAttack = {
  name: "Shortbow",
  attackType: "ranged",
  range: "80 ft",
};

const inputSnapshot = JSON.stringify({ attacker, closeTarget, farTarget, meleeAttack, rangedAttack });

const farMelee = validateAttackRange({ attacker, target: farTarget, attack: meleeAttack });
assert.equal(farMelee.distanceFt, 16, "explicit target distance is used");
assert.equal(farMelee.reachFt, 5);
assert.equal(farMelee.rangeType, "melee");
assert.equal(farMelee.inRange, false, "5 ft melee reach cannot hit a 16 ft target");
assert.equal(farMelee.message, "Target out of reach. Move closer or choose a ranged weapon.");
assert.ok(farMelee.suggestedAction.includes("Move"), "out-of-reach melee suggests movement");

const closeMelee = validateAttackRange({ attacker, target: closeTarget, attack: meleeAttack });
assert.equal(closeMelee.distanceFt, 5, "map distance uses 5 ft grid steps");
assert.equal(closeMelee.inRange, true, "5 ft melee reach can hit a 5 ft target");

const ranged = validateAttackRange({
  attacker,
  target: { ...closeTarget, distanceFt: 30 },
  attack: rangedAttack,
});
assert.equal(ranged.rangeFt, 80);
assert.equal(ranged.rangeType, "ranged");
assert.equal(ranged.inRange, true, "80 ft ranged attack can hit a 30 ft target");

const missingDistance = validateAttackRange({
  attacker: { id: "a" },
  target: { id: "t" },
  attack: meleeAttack,
});
assert.equal(missingDistance.distanceFt, null);
assert.equal(missingDistance.inRange, null);
assert.equal(missingDistance.message, "Range unknown.");

const malformed = validateAttackRange({ attacker, target: closeTarget, attack: true });
assert.equal(malformed.rangeType, "unknown");
assert.equal(malformed.inRange, null);
assert.doesNotThrow(() => validateAttackRange({ attacker: null, target: null, attack: null }));

assert.deepEqual(getAttackReachOrRange(null), {
  reachFt: null,
  rangeFt: null,
  rangeType: "unknown",
});
assert.equal(getDistanceBetweenCombatants(attacker, closeTarget), 5);
assert.equal(hasFunction(farMelee), false, "range validation output is display-safe");

const catalog = buildCombatActionCatalog({
  actor: attacker,
  targets: [farTarget],
  selectedTarget: farTarget,
  equippedWeapons: [meleeAttack],
});
const catalogAttack = catalog.find((action) => action.name === "Attack with Shortsword");
assert.equal(catalogAttack.enabled, false, "catalog attack is disabled when target is clearly out of reach");
assert.equal(catalogAttack.disabledReason, "Target out of reach. Move closer or choose a ranged weapon.");
assert.equal(catalogAttack.metadata.distanceFt, 16);
assert.equal(catalogAttack.metadata.rangeType, "melee");
assert.equal(hasFunction(catalogAttack), false, "catalog range metadata is display-safe");

assert.equal(JSON.stringify({ attacker, closeTarget, farTarget, meleeAttack, rangedAttack }), inputSnapshot, "range utility does not mutate inputs");

console.log("combat range validation tests passed");

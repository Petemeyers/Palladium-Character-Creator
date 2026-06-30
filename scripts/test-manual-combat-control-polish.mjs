import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildManualQuickAttackState,
  chooseManualAttackTarget,
  chooseManualAttackWeapon,
} from "../src/utils/manualCombatControlPolish.js";
import { endCurrentManualAction } from "../src/utils/combatCommandStateCleanup.js";
import { validateAttackRange } from "../src/utils/combatRangeValidation.js";
import { getRangedAttackRangeModifier } from "../src/utils/rangedAttackRangeModifier.js";

const targets = [
  { id: "goblin-1", summary: { name: "Goblin Warrior" } },
];
assert.equal(chooseManualAttackTarget(targets, ""), "goblin-1");
assert.equal(chooseManualAttackTarget([...targets, { id: "wolf-1" }], ""), "");
assert.equal(chooseManualAttackTarget([...targets, { id: "wolf-1" }], "goblin-1"), "goblin-1");

const attackChoices = [
  { index: 0, attack: { name: "Longbow Shot" }, validation: { inRange: true } },
  { index: 1, attack: { name: "Knife Attack" }, validation: { inRange: false, message: "Knife Attack is out of melee range." } },
];
assert.equal(chooseManualAttackWeapon(attackChoices, "0").attackIndex, "0");
assert.deepEqual(chooseManualAttackWeapon(attackChoices, "1"), {
  attackIndex: "0",
  invalidReason: "Knife Attack is out of melee range.",
});
assert.equal(chooseManualAttackWeapon([
  ...attackChoices,
  { index: 2, attack: { name: "Sling" }, validation: { inRange: true } },
], "1").attackIndex, "", "multiple legal weapons require a manual choice");

const rangedQuickAction = buildManualQuickAttackState({
  attacker: { id: "longbowman-1", name: "Longbowman" },
  target: { id: "goblin-1", name: "Goblin Warrior" },
  attack: { name: "Longbow Shot" },
  rangeValidation: { inRange: true, distanceFt: 40, rangeType: "ranged" },
  rangedRangeModifier: {
    isRanged: true,
    distanceFt: 40,
    maxRangeFt: 150,
    bandLabel: "Effective Range",
  },
  remainingActions: 2,
});
assert.equal(rangedQuickAction.enabled, true);
assert.equal(
  rangedQuickAction.label,
  "Shoot Goblin Warrior with Longbow Shot - 40/150 ft, Effective Range"
);

const meleeBlocked = buildManualQuickAttackState({
  attacker: { name: "Longbowman" },
  target: { name: "Goblin Warrior" },
  attack: { name: "Knife Attack" },
  rangeValidation: { inRange: false, distanceFt: 40, reachFt: 5, rangeType: "melee" },
  remainingActions: 2,
});
assert.equal(meleeBlocked.enabled, false);
assert.match(meleeBlocked.disabledReason, /Knife Attack is melee-only at 40 ft/);
assert.equal(buildManualQuickAttackState({ attacker: {}, remainingActions: 1 }).disabledReason, "Choose a target.");
assert.equal(buildManualQuickAttackState({ attacker: {}, target: {}, remainingActions: 1 }).disabledReason, "Choose a weapon.");
assert.equal(buildManualQuickAttackState({ attacker: {}, target: {}, attack: {}, remainingActions: 0 }).disabledReason, "No actions remaining.");
assert.equal(buildManualQuickAttackState({ combatOver: true }).disabledReason, "Combat is over.");

const outOfRangeBow = { name: "Longbow Shot", type: "ranged", range: 150 };
const bowValidation = validateAttackRange({
  attacker: { position: { x: 0, y: 0 } },
  target: { distanceFt: 180 },
  attack: outOfRangeBow,
});
assert.equal(bowValidation.inRange, false, "out-of-range ranged weapons are invalid");
assert.equal(
  getRangedAttackRangeModifier({ attack: outOfRangeBow, distanceFt: 180 }).canAttack,
  false,
  "out-of-range ranged weapons carry a disabled reason"
);
const knifeValidation = validateAttackRange({
  attacker: { position: { x: 0, y: 0 } },
  target: { distanceFt: 40 },
  attack: { name: "Knife Attack", type: "melee", range: 60, reach: 5 },
});
assert.equal(knifeValidation.rangeType, "melee", "Knife Attack remains melee-only");
assert.equal(knifeValidation.inRange, false);

const fighters = [{ id: "actor-1", remainingActions: 2 }, { id: "actor-2", remainingActions: 1 }];
const endedCurrent = endCurrentManualAction(fighters, fighters[0]);
assert.equal(endedCurrent[0].remainingActions, 1);
assert.equal(endedCurrent[1].remainingActions, 1);
assert.equal(fighters[0].remainingActions, 2, "ending a current action does not mutate fighters");

const resolverSource = readFileSync("src/components/ManualPublicAttackTest.jsx", "utf8");
assert.match(resolverSource, /isDisabled=\{!quickAttackState\.enabled \|\| Boolean\(disabledReason\)\}/);
assert.match(resolverSource, /formatRangeModifier\(ranged\.finalModifier\)/);
assert.doesNotMatch(resolverSource, /\balert\s*\(/i, "invalid attack feedback does not use alerts");
const statusSource = readFileSync("src/components/CombatTurnStatusPanel.jsx", "utf8");
assert.match(statusSource, /onEndCurrentAction/);
assert.match(statusSource, /onEndAllActions/);

console.log("manual combat control polish tests passed");

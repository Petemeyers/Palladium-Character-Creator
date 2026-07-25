import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CANONICAL_RANGED_AND_REACH_WEAPON_FIXTURES as WEAPONS,
} from "../src/data/canonicalCombatActors.js";
import { buildCombatActionCatalog } from "../src/utils/combatActionCatalog.js";
import { buildCombatDamageLogEvent } from "../src/utils/combatActorIdentity.js";
import { buildCombatCommandLayoutSummary } from "../src/utils/combatCommandLayout.js";
import { getWeaponLength } from "../src/utils/combatEnvironmentLogic.js";
import { runEnemyApproachPlanner } from "../src/utils/enemyApproachPlannerContract.js";
import { dispatchOwnedSurvivalAction } from "../src/utils/ownedSurvivalAction.js";
import { validateCapturedFlankingAttackIdentity } from "../src/utils/playerAiContinuation.js";
import { resolvePanicFleeStaminaSpend } from "../src/utils/survivalIntent.js";

assert.equal(getWeaponLength(WEAPONS.pike), WEAPONS.pike.lengthFt);
assert.notEqual(getWeaponLength(WEAPONS.longbow), WEAPONS.longbow.normalRangeFeet);

const flee = resolvePanicFleeStaminaSpend({
  fighter: { currentStamina: 10, maxStamina: 10 },
  distanceFeet: 30,
  movementCommitted: true,
  actionToken: "turn:1",
  activeActionToken: "turn:1",
});
assert.equal(flee.spent, 3);

const captured = {
  executionKey: "attack:1",
  grantId: "grant:1",
  generation: "generation:1",
  combatSession: "session:1",
  initiativeTurnId: "turn:1",
  actorId: "actor:1",
  targetId: "target:1",
  actionSequence: 2,
};
assert.equal(validateCapturedFlankingAttackIdentity(captured, captured).accepted, true);

const approach = runEnemyApproachPlanner({
  actor: { id: "enemy:1" },
  target: { id: "party:1" },
  planner: () => ({ type: "hold", position: null }),
});
assert.equal(approach.result, "no-legal-path");

assert.equal(dispatchOwnedSurvivalAction({
  actor: { id: "party:1" },
  actionToken: "turn:1",
  activeActionToken: "turn:1",
  dispatch: () => ({ actionType: "cower" }),
}).accepted, true);

const duplicateRoster = [
  { id: "party-guard", name: "Guard", team: "party" },
  { id: "enemy-guard", name: "Guard", team: "enemy" },
];
assert.equal(
  buildCombatDamageLogEvent({
    actor: duplicateRoster[0],
    target: duplicateRoster[1],
    roster: duplicateRoster,
    damage: 2,
  }).message,
  "Guard [enemy] takes 2 damage from Guard [party].",
);

const catalog = buildCombatActionCatalog({
  actor: { id: "actor:1", remainingActions: 1, currentStamina: 3 },
  selectedTarget: { id: "target:1" },
});
assert.equal(
  catalog.filter((action) => action.playerVisible).every((action) => action.executorIdentity),
  true,
);

const layout = buildCombatCommandLayoutSummary();
assert.equal(layout.order[0], "Combat Command Center");
assert.equal(layout.order.at(-1), "Advanced Combat Tools");
const combatPage = readFileSync("src/pages/CombatPage.jsx", "utf8");
assert.equal((combatPage.match(/<CombatActionCatalogPanel/g) || []).length, 1);
assert.doesNotMatch(combatPage, /presceneBattles|Quick Start Fight|quickStartBattle/);

const environmentSource = readFileSync("src/utils/combatEnvironmentLogic.js", "utf8");
assert.match(environmentSource, /explicitPhysicalLength/);
assert.match(environmentSource, /Projectile normal\/long range remains separate combat metadata/);

console.log("baseline failure repair umbrella tests passed: 10 invariants");

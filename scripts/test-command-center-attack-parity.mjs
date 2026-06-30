import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  formatCommandActionCount,
  getCommandCenterAttackGate,
  getLegacyManualTurnOrderGate,
} from "../src/utils/combatCommandParity.js";
import { buildManualQuickAttackState } from "../src/utils/manualCombatControlPolish.js";
import { endCurrentManualAction, endManualTurnActions } from "../src/utils/combatCommandStateCleanup.js";
import { validateAttackRange } from "../src/utils/combatRangeValidation.js";
import { getRangedAttackRangeModifier } from "../src/utils/rangedAttackRangeModifier.js";
import { spendAction } from "../src/utils/publicActionBudget.js";
import { buildCombatCommandLayoutSummary } from "../src/utils/combatCommandLayout.js";

const actor = {
  id: "longbowman-1",
  name: "Longbowman",
  remainingActions: 2,
  maxActions: 2,
  originalActorMetadata: { attributes: { deftness: 15, awareness: 13 } },
};
const target = { id: "goblin-1", name: "Goblin Warrior", distanceFt: 40 };
const longbow = { name: "Longbow Shot", type: "ranged", range: 150 };
const knife = { name: "Knife Attack", type: "melee", range: 60, reach: 5 };

const bowRange = getRangedAttackRangeModifier({ actor, attack: longbow, distanceFt: 40 });
assert.equal(bowRange.isRanged, true);
assert.equal(bowRange.canAttack, true);
const knifeRange = getRangedAttackRangeModifier({ actor, attack: knife, distanceFt: 40 });
assert.equal(knifeRange.isRanged, false, "Knife Attack remains melee-only");
assert.equal(validateAttackRange({ attacker: actor, target, attack: knife }).inRange, false);

const liveGate = getCommandCenterAttackGate({
  combatActive: true,
  combatOver: false,
  schedulerSource: "live-initiative",
});
assert.equal(liveGate.enabled, false, "duplicate Command Center attack path is disabled during live initiative");
assert.match(liveGate.reason, /disabled while scheduled combat is active/i);
assert.equal(getCommandCenterAttackGate({ combatActive: false }).enabled, true);

const manualTurnGate = getLegacyManualTurnOrderGate({ combatActive: true, combatOver: false });
assert.equal(manualTurnGate.enabled, false);
assert.equal(
  manualTurnGate.reason,
  "Legacy manual turn order is disabled while scheduled combat is active."
);
assert.equal(getLegacyManualTurnOrderGate({ combatActive: false }).enabled, true);

const spent = spendAction(actor, 1);
assert.equal(spent.ok, true);
assert.equal(spent.remainingActions, 1);
assert.equal(formatCommandActionCount(spent.remainingActions, spent.maxActions), "Actions remaining: 1/2.");
const finalSpend = spendAction(spent.updated, 1);
assert.equal(formatCommandActionCount(finalSpend.remainingActions, finalSpend.maxActions), "No actions remaining.");
assert.equal(spendAction(finalSpend.updated, 1).ok, false, "no-action attacks remain blocked");

const quickAttack = buildManualQuickAttackState({
  attacker: actor,
  target,
  attack: longbow,
  rangeValidation: { inRange: true, distanceFt: 40 },
  rangedRangeModifier: bowRange,
  remainingActions: 2,
});
assert.equal(quickAttack.enabled, true);
assert.match(quickAttack.label, /Shoot Goblin Warrior with Longbow Shot/);
assert.equal(buildManualQuickAttackState({
  attacker: actor,
  target,
  attack: longbow,
  rangeValidation: { inRange: true, distanceFt: 40 },
  rangedRangeModifier: bowRange,
  remainingActions: 0,
}).enabled, false);

const fighters = [actor, { id: "ally-1", remainingActions: 2 }];
assert.equal(endCurrentManualAction(fighters, actor)[0].remainingActions, 1);
assert.equal(endManualTurnActions(fighters, actor)[0].remainingActions, 0);

const layout = buildCombatCommandLayoutSummary();
assert.equal(layout.order.at(-1), "Legacy / Compatibility Tools");
assert.equal(layout.defaultCompatibilityCollapsed, true);

const combatPageSource = readFileSync("src/pages/CombatPage.jsx", "utf8");
assert.match(combatPageSource, /if \(!legacyManualTurnOrderGate\.enabled\)/);
assert.match(combatPageSource, /if \(!commandCenterAttackGate\.enabled\)/);
assert.match(combatPageSource, /setManualPublicTurnOrder\(\[\]\)/);
assert.match(combatPageSource, /await attack\(currentFighter, targetToExecute\.id\)/, "scheduled manual attacks retain the common resolver");
const commandAttackApplySource = combatPageSource.slice(
  combatPageSource.indexOf("function applyManualPublicAttackDamage"),
  combatPageSource.indexOf("function applyManualPublicRecovery")
);
assert.match(commandAttackApplySource, /formatCommandActionCount/);
assert.doesNotMatch(commandAttackApplySource, /Action spent:/, "Command Center attack log uses clear action-count wording");
const resolverSource = readFileSync("src/components/ManualPublicAttackTest.jsx", "utf8");
assert.match(resolverSource, /getRangedAttackRangeModifier/);
assert.match(resolverSource, /disabledReason/);
assert.doesNotMatch(resolverSource, /\balert\s*\(/i);

console.log("command center attack parity tests passed");

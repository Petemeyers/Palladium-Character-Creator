import assert from "node:assert/strict";

import { applyStaminaRecovery, getRecoveryAmount } from "../src/utils/combatRecovery.js";
import { spendAction } from "../src/utils/publicActionBudget.js";

const base = {
  id: "fighter-1",
  name: "Mimi",
  currentStamina: 5,
  maxStamina: 10,
  remainingActions: 1,
  maxActions: 1,
};
const snapshot = JSON.stringify(base);

const recovered = applyStaminaRecovery(base, 2);
assert.equal(recovered.ok, true, "recovery succeeds below max stamina");
assert.equal(recovered.oldStamina, 5);
assert.equal(recovered.newStamina, 7);
assert.equal(recovered.maxStamina, 10);
assert.equal(recovered.updated.currentStamina, 7);

const clamped = applyStaminaRecovery({ ...base, currentStamina: 9 }, 2);
assert.equal(clamped.ok, true, "recovery succeeds when clamping");
assert.equal(clamped.newStamina, 10, "recovery clamps at max stamina");
assert.equal(clamped.recovered, 1);

const full = applyStaminaRecovery({ ...base, currentStamina: 10 }, 2);
assert.equal(full.ok, false, "full stamina is disabled");
assert.equal(full.message, "Stamina already full.");

const missingCurrent = applyStaminaRecovery({ maxStamina: 10 }, 2);
assert.equal(missingCurrent.ok, false, "missing current stamina reports disabled");
assert.deepEqual(missingCurrent.missingFields, ["currentStamina"]);

const missingMax = applyStaminaRecovery({ currentStamina: 5 }, 2);
assert.equal(missingMax.ok, false, "missing max stamina reports disabled");
assert.deepEqual(missingMax.missingFields, ["maxStamina"]);

assert.doesNotThrow(() => applyStaminaRecovery(null, 2), "null input does not throw");
assert.doesNotThrow(() => applyStaminaRecovery({ currentStamina: "bad", maxStamina: true }, 2), "malformed fields do not throw");

assert.equal(JSON.stringify(base), snapshot, "recovery does not mutate original object");
assert.equal(getRecoveryAmount(base, {}), 3, "default Catch Breath recovery is 3");
assert.equal(getRecoveryAmount(base, { metadata: { recoveryAmount: 3 } }), 3, "action metadata can set recovery amount");

const spentOnce = spendAction({ ...recovered.updated, remainingActions: 1, maxActions: 1 }, 1);
assert.equal(spentOnce.ok, true, "integrated action spend succeeds");
assert.equal(spentOnce.remainingActions, 0);
const spentAgain = spendAction(spentOnce.updated, 1);
assert.equal(spentAgain.ok, false, "spending action cannot go below zero");
assert.equal(spentAgain.remainingActions, 0);

const booleanActions = spendAction({ ...base, remainingActions: true }, 1);
assert.equal(booleanActions.ok, true, "boolean remaining actions falls back to max action budget");
assert.equal(booleanActions.remainingActions, 0);

console.log("combat recovery tests passed");

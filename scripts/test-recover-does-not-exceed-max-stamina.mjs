import assert from "node:assert/strict";
import { applyRecoveryAction } from "../src/utils/combatRecovery.js";

const result = applyRecoveryAction({ currentStamina: 9, maxStamina: 10, remainingActions: 1 });
assert.equal(result.ok, true);
assert.equal(result.recovered, 1);
assert.equal(result.updated.currentStamina, 10);
assert.equal(result.updated.remainingActions, 0);
console.log("recover maximum stamina cap tests passed");

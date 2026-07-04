import assert from "node:assert/strict";
import { applyRecoveryAction } from "../src/utils/combatRecovery.js";

const result = applyRecoveryAction({ currentStamina: 2, maxStamina: 10, remainingActions: 2 });
assert.equal(result.ok, true);
assert.equal(result.recovered, 3);
assert.equal(result.updated.currentStamina, 5);
assert.equal(result.updated.remainingActions, 1);
console.log("recover action stamina/action tests passed");

import assert from "node:assert/strict";
import { markCombatantSurrendered } from "../src/utils/combatBrokenState.js";
import { isActiveCombatantForHostility } from "../src/utils/combatHostilityState.js";

const surrendered = markCombatantSurrendered({ id: "knight", currentHP: 12, status: "active", canAct: true });
assert.equal(isActiveCombatantForHostility(surrendered), false);
assert.equal(surrendered.remainingActions, 0);
assert.equal(surrendered.active, false);
console.log("exhausted cower initiative exclusion tests passed");

import assert from "node:assert/strict";
import { isCombatantFled, markCombatantFled } from "../src/utils/combatFledState.js";
import { isPendingSurrenderResolution } from "../src/utils/combat/surrenderState.js";

const fled = markCombatantFled({ id: "enemy", currentHP: 3, conscious: true, moraleState: { status: "ROUTED" } }, "routed-off-field");
assert.equal(isCombatantFled(fled), true);
assert.equal(fled.canAct, false);
assert.equal(fled.moraleState.hasFled, true);
assert.equal(isPendingSurrenderResolution(fled), false);
console.log("routed fighter who fled remains terminal test passed");

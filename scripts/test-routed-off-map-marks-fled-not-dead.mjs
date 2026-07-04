import assert from "node:assert/strict";
import { markCombatantFled } from "../src/utils/combatFledState.js";
import { hasCrossedRoutedEscapeBoundary } from "../src/utils/routingSystem.js";

const fighter = { id: "knight", status: "active", currentHP: 24, condition: "healthy", canAct: true };
assert.equal(hasCrossedRoutedEscapeBoundary({ x: -1, y: 10 }, { minX: 0, minY: 0, maxX: 39, maxY: 29 }), true);
const fled = markCombatantFled(fighter, "routed-off-field");
assert.equal(fled.status, "fled");
assert.equal(fled.isFled, true);
assert.equal(fled.defeatReason, "fled");
assert.equal(fled.state.fledReason, "routed-off-field");
assert.equal(fled.currentHP, 24);
assert.notEqual(fled.isDead, true);
assert.notEqual(String(fled.condition).toLowerCase(), "unconscious");
console.log("routed off-map fled-not-dead test passed");

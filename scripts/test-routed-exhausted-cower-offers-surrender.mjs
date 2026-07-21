import assert from "node:assert/strict";
import { offerRoutedExhaustedCowerSurrender } from "../src/utils/combat/surrenderState.js";

const fighter = { id: "enemy", currentHP: 3, conscious: true, currentStamina: 0, position: { x: 7, y: 4 }, equipment: ["plate"], moraleState: { status: "ROUTED" } };
const offered = offerRoutedExhaustedCowerSurrender(fighter, { offeredToId: "victor", actionToken: "turn:1" });
assert.equal(offered.surrenderState.status, "offered");
assert.equal(offered.surrenderState.reason, "routed-exhausted-cower");
assert.equal(offered.currentHP, 3);
assert.equal(offered.conscious, true);
assert.deepEqual(offered.position, fighter.position);
assert.deepEqual(offered.equipment, fighter.equipment);
assert.equal(offered.canAct, false);
assert.notEqual(offered.defeated, true);
console.log("routed exhausted cower surrender offer test passed");

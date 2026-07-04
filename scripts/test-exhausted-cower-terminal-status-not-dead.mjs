import assert from "node:assert/strict";
import { advanceExhaustedCower, isCombatantBroken } from "../src/utils/combatBrokenState.js";

const original = { currentHP: 23, hp: 23, HP: 23, moraleState: { status: "ROUTED", exhaustedCowerCount: 2 } };
const result = advanceExhaustedCower(original);
assert.equal(result.terminal, true);
assert.equal(result.actor.status, "surrendered");
assert.equal(result.actor.isSurrendered, true);
assert.equal(isCombatantBroken(result.actor), true);
assert.equal(result.actor.currentHP, 23);
assert.equal(result.actor.hp, 23);
assert.equal(result.actor.HP, 23);
assert.notEqual(result.actor.dead, true);
assert.notEqual(result.actor.isDead, true);
assert.notEqual(result.actor.unconscious, true);
assert.notEqual(result.actor.isUnconscious, true);
console.log("exhausted cower nonlethal terminal status tests passed");

import assert from "node:assert/strict";

import {
  initializeCombatStamina,
  readCombatStamina,
  spendCombatStamina,
} from "../src/utils/combatStamina.js";

const knight = initializeCombatStamina({
  id: "knight",
  name: "Knight",
  maxStamina: 28,
  currentStamina: null,
  combatStamina: { currentStamina: null },
  fatigueState: { currentStamina: null },
  staminaCurrent: 0,
  stamina: 0,
  training: { currentstamina: 0 },
});

assert.equal(knight.combatStamina.maxStamina, 28);
assert.equal(knight.combatStamina.currentStamina, 28, "null current stamina initializes to max, not legacy zero");
assert.equal(knight.currentStamina, 28);
assert.equal(knight.currentstamina, 28);
assert.equal(knight.fatigueState.currentStamina, 28);
assert.equal(knight.staminaAuthority, "combat-stamina");

const spentStart = initializeCombatStamina({
  maxStamina: 28,
  currentStamina: 0,
});
assert.equal(spentStart.combatStamina.currentStamina, 0, "explicit finite zero is preserved");

const first = spendCombatStamina({ fighter: knight, amount: 1, reason: "attack" });
assert.equal(first.accepted, true);
assert.equal(first.previousStamina, 28);
assert.equal(first.appliedSpend, 1);
assert.equal(first.nextStamina, 27);

const second = spendCombatStamina({ fighter: first.updated, amount: 1, reason: "attack" });
assert.equal(second.nextStamina, 26);

const zero = spendCombatStamina({
  fighter: initializeCombatStamina({ maxStamina: 28, currentStamina: 0 }),
  amount: 1,
  reason: "attack",
  allowOverexertion: true,
});
assert.equal(zero.accepted, true);
assert.equal(zero.appliedSpend, 1, "authorized overexertion must spend the complete action cost");
assert.equal(zero.nextStamina, -1, "authorized overexertion must preserve canonical stamina debt");
assert.equal(zero.overexertionApplied, true);
assert.equal(zero.overexertionActions, 1);

const invalid = spendCombatStamina({
  fighter: { maxStamina: Number.NaN, currentStamina: Number.NaN, staminaAuthority: "combat-stamina" },
  amount: Number.NaN,
});
assert.equal(invalid.accepted, false);
assert.equal(invalid.reason, "invalid-canonical-stamina");
assert.equal(invalid.nextStamina, null);

const read = readCombatStamina({ maxStamina: 28, currentStamina: Number.POSITIVE_INFINITY });
assert.equal(read.valid, true);
assert.equal(read.currentStamina, 28, "non-finite explicit current is reinitialized from max");

console.log("✅ Phase 3B1 canonical stamina tests passed");

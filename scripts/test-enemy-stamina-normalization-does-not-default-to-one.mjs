import assert from "node:assert/strict";
import { initializeCombatFatigue } from "../src/utils/combatFatigueSystem.js";

const normalized = initializeCombatFatigue({
  name: "Unconfigured Enemy",
  team: "enemy",
  fatigueState: { maxStamina: 1, currentStamina: 0 },
});

assert.ok(normalized.maxStamina > 1, "an unconfigured enemy must not inherit the one-point sentinel");
assert.equal(normalized.currentStamina, normalized.maxStamina);
console.log("enemy stamina normalization avoids one-point default");

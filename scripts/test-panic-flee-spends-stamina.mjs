import assert from "node:assert/strict";
import fs from "node:fs";
import { spendStamina } from "../src/utils/combatStamina.js";
import { calculateRoutedMovementStaminaCost, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const fighter = { currentStamina: 10, maxStamina: 10 };
const cost = calculateRoutedMovementStaminaCost({ fighter, distanceFeet: 30, movementType: "panic-run", survivalIntent: SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE });
const result = spendStamina(fighter, cost);
assert.equal(cost, 3);
assert.equal(result.currentStamina, 7);
const compatibilityResult = spendStamina({
  fatigueState: { currentStamina: 6, maxStamina: 8 },
  currentstamina: 6,
  maxstamina: 8,
}, 3);
assert.equal(compatibilityResult.currentStamina, 3);
assert.equal(compatibilityResult.updated.fatigueState.currentStamina, 3);
assert.equal(compatibilityResult.updated.currentstamina, 3);

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /spends \$\{panicStaminaSpent\} stamina panic-running/);
assert.match(source, /spendStamina\(candidate, panicStaminaCost\)/);
console.log("panic flee stamina spending test passed");

import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateRoutedMovementStaminaCost, SURVIVAL_INTENTS } from "../src/utils/survivalIntent.js";

const fighter = { armorClass: 18 };
const regroup = calculateRoutedMovementStaminaCost({ fighter, distanceFeet: 30, movementType: "controlled-withdrawal", survivalIntent: SURVIVAL_INTENTS.REGROUP_WITH_ALLY });
const panic = calculateRoutedMovementStaminaCost({ fighter, distanceFeet: 30, movementType: "panic-run", survivalIntent: SURVIVAL_INTENTS.PANIC_FLEE_TO_EDGE });
assert.equal(regroup, 2);
assert.ok(regroup < panic);

const source = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /spendStamina\(candidate, routedStaminaCost\)/);
assert.match(source, /spends \$\{routedStaminaSpent\} stamina \$\{staminaAction\}/);
console.log("controlled regroup stamina spending test passed");

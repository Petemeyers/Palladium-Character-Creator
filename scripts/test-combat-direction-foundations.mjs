import assert from "node:assert/strict";

import { ARMOR_MODEL_FOUNDATION } from "../src/utils/armorModelFoundation.js";
import { getCombatantTokenVisualState } from "../src/utils/combatantTokenVisualState.js";
import { SURVIVAL_INTENTS, normalizeSurvivalIntent } from "../src/utils/survivalIntent.js";

assert.equal(normalizeSurvivalIntent(SURVIVAL_INTENTS.REGROUP_WITH_ALLY), "regroup-with-ally");
assert.equal(normalizeSurvivalIntent("unknown"), SURVIVAL_INTENTS.HOLD);
assert.deepEqual(ARMOR_MODEL_FOUNDATION, {
  defense: "avoid-parry-block",
  armor: "reduce-injury",
  coverage: "determine-whether-armor-applies",
});
assert.deepEqual(getCombatantTokenVisualState({
  currentHP: 2,
  maxHP: 20,
  armor: { category: "heavy" },
  state: { moraleState: "routed" },
  statusEffects: ["BLEEDING"],
}), {
  bodyState: "critical",
  armorState: "heavy",
  moraleState: "panicked",
  statusMarkers: ["BLEEDING"],
});

console.log("combat direction foundation tests passed");

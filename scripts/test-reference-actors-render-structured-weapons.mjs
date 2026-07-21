import assert from "node:assert/strict";
import { buildPhase3B3BRenderScenarios } from "../src/utils/presentation/phase3b3bRenderScenarios.js";

const scenarios = buildPhase3B3BRenderScenarios();
assert.deepEqual(scenarios.map((entry) => entry.actorKey), ["knight", "goblin-warrior", "minotaur"]);
for (const scenario of scenarios) {
  assert.ok(scenario.weapons.length > 0);
  assert.ok(scenario.weapons.every((label) => typeof label === "string" && label !== "[object Object]"));
  assert.ok(scenario.equipment.every((label) => typeof label === "string" && label !== "[object Object]"));
  assert.match(scenario.alignment, /^(Lawful|Neutral|Chaotic|True) /);
}
console.log("Reference actors render structured weapons and alignments as text");

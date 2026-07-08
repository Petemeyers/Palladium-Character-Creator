import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /enemy close-range approach no attack hex available:/);
assert.match(source, /approachFinalizerSource = executableApproachPlan\?\.type === "hold" \|\| !executableApproachPlan\?\.position[\s\S]*\? "enemy-ai-no-move-fallback"/);
assert.match(source, /remainingActions: approachFinalizerSource === "enemy-ai-no-move-fallback"[\s\S]*\? 0/);
assert.match(source, /scheduleEnemyAIEndTurn\(getMoveDurationMs\(approachDistanceMoved\), approachFinalizerSource\)/);

console.log("enemy close-range no-attack-hex fallback tests passed");

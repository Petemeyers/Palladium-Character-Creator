import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync("src/pages/CombatPage.jsx", "utf8");

assert.match(combatPage, /eventType:\s*"fumble-turn-handoff-started"/);
assert.match(combatPage, /eventType:\s*"fumble-turn-handoff-completed"/);
assert.match(combatPage, /suppressEndTurn:\s*true/);
assert.match(combatPage, /resolveCombatActionCompletion\(\{[\s\S]*source:\s*"fumble-turn-handoff"/);
assert.match(combatPage, /explicitTurnEndingEffect:\s*true/);
assert.match(combatPage, /finalizerOwner:\s*"fumble"/);
assert.match(combatPage, /completionDecision:\s*fumbleCompletionDecision\?\.decision/);

console.log("✅ Phase 3B1 fumble completion arbiter source tests passed");

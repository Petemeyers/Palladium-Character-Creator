import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync("src/pages/CombatPage.jsx", "utf8");
const playerTurnAI = readFileSync("src/utils/ai/playerTurnAI.js", "utf8");
const enemyTurnAI = readFileSync("src/utils/ai/enemyTurnAI.js", "utf8");

assert.match(combatPage, /const getAuthoritativeCombatTurnSnapshot = useCallback/);
assert.match(combatPage, /eventType:\s*"combat-turn-snapshot-created"/);
assert.match(combatPage, /eventType:\s*"combat-turn-snapshot-mismatch"/);
assert.match(combatPage, /const resolveCombatActionCompletion = useCallback/);
assert.match(combatPage, /resolveCombatActionCompletion\(\{[\s\S]*source:\s*`grapple-action:\$\{actionType\}`/);
assert.doesNotMatch(combatPage, /eventType:\s*"combat-action-completion-committed-state-mismatch"/);
assert.match(combatPage, /eventType:\s*"grapple-completion-action-count-audit"/);
assert.match(combatPage, /eventType:\s*"combat-action-continuation-missing"|eventType:\s*"remaining-action-continuation-created"/);
assert.match(combatPage, /eventType:\s*"initiative-turn-reuse"/);

assert.match(playerTurnAI, /grapple-dispatch-required-but-missing/);
assert.match(enemyTurnAI, /grapple-dispatch-required-but-missing/);
assert.match(
  playerTurnAI,
  /const grappleResult = dispatchGrappleTurnAction\([\s\S]{0,500}?grappleRoute\.grappleAction\?\.actionType \|\| grappleRoute\.actionType[\s\S]{0,500}?continuationAuthorization,[\s\S]*if \(grappleResult\?\.terminal === true\) \{[\s\S]*return createPlayerAiActionResult\("grapple"/,
  "player active-clinch dispatch should return immediately with a grapple result",
);
assert.doesNotMatch(playerTurnAI, /player-ai-grapple-dispatch-missing"[\s\S]{0,400}selectedAttack/);

console.log("✅ Phase 3B1 grapple completion arbiter source tests passed");

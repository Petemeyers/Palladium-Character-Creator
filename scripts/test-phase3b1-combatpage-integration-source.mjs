import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/pages/CombatPage.jsx", "utf8");
const playerAi = readFileSync("src/utils/ai/playerTurnAI.js", "utf8");
const enemyAi = readFileSync("src/utils/ai/enemyTurnAI.js", "utf8");

assert.match(source, /armoredTacticalMemoryRef\s*=\s*useRef\(new Map\(\)\)/, "CombatPage should own a combat-scoped armored memory map");
assert.match(source, /getArmoredTacticalMemory:\s*getArmoredMemoryForCombatants/, "Player/enemy AI contexts should receive armored memory");
assert.match(source, /recordArmoredTacticalOutcome\(getArmoredMemoryStore\(\)/, "Armor contact outcomes should update the authoritative memory store");
assert.match(source, /eventType:\s*"armored-memory-write"/, "Memory writes should be structurally logged");
assert.match(source, /eventType:\s*"armored-tactical-outcome-recorded"/, "Canonical armored outcomes should be structurally logged");
assert.match(source, /eventType:\s*"attack-mode-propagated"/, "Attack-mode propagation should be structurally logged");
assert.match(source, /eventType:\s*"armor-impact-check"/, "Armor impact checks should be structurally logged");
assert.match(source, /turn advance blocked: actor=\$\{formatCombatActorLabel/, "Turn advance should be blocked when actions remain");
assert.match(source, /eventType:\s*"remaining-action-continuation"/, "Remaining-action continuation should be structurally logged");
assert.match(source, /eventType:\s*"remaining-action-decision"/, "Action spend should make an authoritative remaining-action decision");
assert.match(source, /eventType:\s*"remaining-action-continuation-created"/, "Same-fighter continuation should be created before initiative handoff");
assert.match(source, /eventType:\s*"stamina-boundary-applied"/, "Canonical fighter commits should guard against negative stamina storage");
assert.match(source, /eventType:\s*"armored-selector-bypassed"/, "Plate-aware attack backstop should detect selector bypasses");
assert.match(source, /resolveArmoredCombatAction\(\{[\s\S]*source:\s*"worker-ai-attack-fallback"/, "Worker/fallback AI attack path should use shared armored adapter");
assert.match(source, /handleEnemyTurnRef\.current\?\.\(liveCurrent,\s*"remaining-action-continuation"/, "Enemy remaining actions should re-enter authoritative scheduling");
assert.match(source, /handlePlayerAITurnRef\.current\?\.\(liveCurrent,\s*\{[\s\S]*remaining-action-continuation/, "Player AI remaining actions should re-enter authoritative scheduling");

assert.match(playerAi, /resolveArmoredCombatAction\(/, "Player AI should use shared armored action adapter");
assert.match(playerAi, /dispatchGrappleTurnAction\(player,\s*target,\s*null,\s*armoredAction\.armoredActionPlan,\s*\{[\s\S]*continuationAuthorization/, "Player AI grapple selection should route to the canonical grapple dispatcher with plan and receipt ownership");

assert.match(enemyAi, /resolveArmoredCombatAction\(/, "Enemy AI should use shared armored action adapter");
assert.match(enemyAi, /executeGrapple\(enemy,\s*target,\s*null,\s*armoredAction\.armoredActionPlan,\s*\{[\s\S]*continuationAuthorization/, "Enemy AI grapple selection should route to existing grapple callback with plan and receipt ownership");

console.log("✅ Phase 3B1 CombatPage/AI integration source tests passed");

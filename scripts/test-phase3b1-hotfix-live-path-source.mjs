import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync("src/pages/CombatPage.jsx", "utf8");
const adapter = readFileSync("src/utils/ai/resolveArmoredCombatAction.js", "utf8");
const selector = readFileSync("src/utils/ai/selectArmoredCombatTechnique.js", "utf8");

assert.match(combatPage, /rollArmoredTechniqueRng = useCallback/, "CombatPage should provide one authoritative armored technique RNG");
assert.doesNotMatch(combatPage, /1d1000000/, "armored technique RNG must not exceed the dice helper's 1000-side limit");
assert.match(combatPage, /rngStateRef\.current = \{ \.\.\.current, seed, counter \}/, "seeded armored RNG should advance the combat RNG state");
assert.match(combatPage, /source:\s*"worker-ai-attack-fallback"/, "worker/fallback attack path should invoke armored adapter");
assert.match(combatPage, /source:\s*"enemy-inline-attack"/, "legacy inline enemy attack path should invoke armored adapter");
assert.match(combatPage, /eventType:\s*"armored-selector-bypassed"/, "attack() should diagnose plate-aware selector bypasses");
assert.match(combatPage, /eventType:\s*"armored-action-plan-rejected"/, "missing armored plans should be rejected at attack boundary");
assert.match(combatPage, /eventType:\s*"armored-action-plan-consumed"/, "valid armored plans should be consumed at attack boundary");
assert.match(combatPage, /recordArmoredTacticalOutcome\(getArmoredMemoryStore\(\)/, "attack() should use canonical idempotent armored outcome writer");
assert.match(combatPage, /outcomeType:\s*"successful-gap-hit"/, "successful gap hits should be recorded before damage continues");
assert.match(combatPage, /eventType:\s*"remaining-action-decision"/, "finalizeAttackSpend should decide remaining-action continuation");
assert.match(combatPage, /remainingActionContinuationRegistryRef/, "same-fighter continuation should be registry-deduped");
assert.match(combatPage, /spendCombatStamina as spendCanonicalCombatStamina/, "fighter commits should use shared stamina authority");
assert.match(combatPage, /allowOverexertion:\s*overexertionPolicy\.allowOverexertion/, "fighter commits should preserve only policy-authorized stamina debt");

assert.match(adapter, /eventType:\s*"armored-selector-invoked"/, "adapter should log selector invocation");
assert.match(adapter, /eventType:\s*"armored-action-plan-created"/, "adapter should create structured armored action plans");
assert.match(adapter, /eventType:\s*"armored-memory-read"/, "adapter should log memory reads");
assert.match(adapter, /eventType:\s*"offensive-ai-suppressed"/, "adapter should suppress routed offensive AI");

assert.match(selector, /deterministicRoll/, "selector should return deterministic weighted roll metadata");
assert.doesNotMatch(selector, /sort\(\(a, b\) => b\.score/, "selector must not choose max score as fallback");

console.log("✅ Phase 3B1 hotfix live-path source tests passed");

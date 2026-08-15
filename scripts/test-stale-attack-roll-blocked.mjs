import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /const getAttackRollOwnershipBlockReason = \(phase = "attack-roll"\) =>/);
assert.match(source, /const logStaleAttackRollBlocked = \(block\) =>/);
assert.match(source, /stale attack roll blocked: actor=\$\{block\?\.latestAttacker\?\.name/);
assert.match(source, /executionKey=\$\{attackActionId\}/);
assert.match(source, /const entryAttackBlock = getAttackRollOwnershipBlockReason\("attack-entry-pre-roll"\)/);
assert.match(source, /const preRollAttackBlock = getAttackRollOwnershipBlockReason\("immediate-pre-roll"\)/);
assert.match(source, /if \(preRollAttackBlock\) \{\s+logStaleAttackRollBlocked\(preRollAttackBlock\);[\s\S]+return false;\s+\}/);
assert.match(source, /activeAttackActionIdRef\.current !== attackActionId/);
assert.match(source, /attacker-has-no-actions/);
assert.match(source, /active-fighter-mismatch/);
assert.match(source, /turn-token-mismatch/);
assert.match(source, /combat-session-mismatch/);
assert.match(source, /allowOutOfTurnAttack/);
assert.match(source, /source\s*=\s*"attack-of-opportunity"/);
assert.match(source, /const scheduleCanonicalOpportunityAttack = useCallback/);
assert.doesNotMatch(source, /stale attack promise resolved with actor mismatch: expected=/);
assert.match(source, /eventType:\s*"stale-attack-promise-ignored"/);
assert.match(source, /expectedEnemyAttackExecutionKey/);

const preRollIndex = source.indexOf('const preRollAttackBlock = getAttackRollOwnershipBlockReason("immediate-pre-roll")');
const staminaIndex = source.indexOf("calculateHybridWeaponAttackStaminaCost", preRollIndex);
const diceIndex = source.indexOf("CryptoSecureDice.parseAndRoll", preRollIndex);
assert.ok(preRollIndex > -1, "pre-roll stale attack guard should exist");
assert.ok(staminaIndex > preRollIndex, "stale attack guard should run before stamina spend");
assert.ok(diceIndex > preRollIndex, "stale attack guard should run before attack roll");
assert.match(source, /const fallbackCost = calculateAttackStaminaCost\(/);

assert.doesNotMatch(source, /stale attack roll detected: actor=/);

console.log("stale attack roll block tests passed");

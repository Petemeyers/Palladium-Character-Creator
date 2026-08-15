import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

const preClaimIndex = combatPageSource.indexOf("const entryActiveFighter = fightersRef.current?.[turnIndexRef.current]");
const claimIndex = combatPageSource.indexOf("activeAttackActionIdRef.current = attackActionId");
assert.ok(preClaimIndex !== -1, "attack should validate active fighter before claiming ownership");
assert.ok(claimIndex !== -1, "attack should still claim ownership for valid attacks");
assert.ok(preClaimIndex < claimIndex, "active-fighter mismatch must be blocked before activeAttackActionIdRef is claimed");

assert.match(combatPageSource, /stale combat roll blocked: actor=\$\{attacker\?\.name \|\| "unknown"\} reason=active-fighter-mismatch/);
assert.doesNotMatch(combatPageSource, /stale attack promise resolved with actor mismatch: expected=/);
assert.match(combatPageSource, /eventType:\s*"stale-attack-promise-ignored"/);
assert.match(combatPageSource, /const expectedMeleeRound = bonusModifiers\?\.meleeRound/);
assert.match(combatPageSource, /const expectedTurnCounter = bonusModifiers\?\.turnCounter/);
assert.match(combatPageSource, /round-mismatch/);
assert.match(combatPageSource, /turn-counter-mismatch/);
assert.match(combatPageSource, /target-invalid/);
assert.match(combatPageSource, /const preRollOwnershipBlock = getAttackRollOwnershipBlockReason\("attack-roll-pre-stamina"\)/);
assert.match(combatPageSource, /const preDamageOwnershipBlock = getAttackRollOwnershipBlockReason\("damage-roll-pre-hp"\)/);

const preStaminaIndex = combatPageSource.indexOf('getAttackRollOwnershipBlockReason("attack-roll-pre-stamina")');
const staminaIndex = combatPageSource.indexOf("calculateHybridWeaponAttackStaminaCost", preStaminaIndex);
const rollIndex = combatPageSource.indexOf("CryptoSecureDice.parseAndRoll", preStaminaIndex);
assert.ok(preStaminaIndex !== -1 && staminaIndex !== -1 && rollIndex !== -1);
assert.ok(preStaminaIndex < staminaIndex, "stale guard should run before attack stamina spend");
assert.ok(preStaminaIndex < rollIndex, "stale guard should run before attack roll");
assert.match(combatPageSource, /const fallbackCost = calculateAttackStaminaCost\(/);

console.log("low-level stale roll block tests passed");

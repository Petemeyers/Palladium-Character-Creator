import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const grappleActionsSource = readFileSync(
  new URL("../src/utils/combatActionHandlers/grappleActions.js", import.meta.url),
  "utf8",
);

assert.match(combatPageSource, /const validateCombatRollOwnership = useCallback/);
assert.match(combatPageSource, /reason=missing-execution-key executionKey=none source=\$\{attackSource\}/);
assert.match(combatPageSource, /stale combat roll blocked: actor=\$\{latestActor\?\.name \|\| actorId \|\| "unknown"\} reason=\$\{reasons\.join\("\|"\)\} executionKey=\$\{executionKey \|\| "none"\} source=\$\{source\}/);
assert.match(combatPageSource, /combat roll gate passed: actor=\$\{latestActor\?\.name \|\| actorId \|\| "unknown"\} source=\$\{source\} executionKey=\$\{executionKey \|\| "none"\}/);

assert.match(combatPageSource, /const immediateAttackRollBlock = getAttackRollOwnershipBlockReason\("attack-roll"\)/);
assert.match(combatPageSource, /const immediateDamageRollBlock = getAttackRollOwnershipBlockReason\("damage-roll"\)/);
assert.match(combatPageSource, /const hpMutationBlock = getAttackRollOwnershipBlockReason\("hp-mutation"\)/);

const attackRollGateIndex = combatPageSource.indexOf('const immediateAttackRollBlock = getAttackRollOwnershipBlockReason("attack-roll")');
const attackRollIndex = combatPageSource.indexOf("attackRollResult = CryptoSecureDice.parseAndRoll", attackRollGateIndex);
assert.ok(attackRollGateIndex !== -1 && attackRollIndex !== -1 && attackRollGateIndex < attackRollIndex);

const damageRollGateIndex = combatPageSource.indexOf('const immediateDamageRollBlock = getAttackRollOwnershipBlockReason("damage-roll")');
const damageRollIndex = combatPageSource.indexOf("damageRollResult = CryptoSecureDice.parseAndRoll", damageRollGateIndex);
assert.ok(damageRollGateIndex !== -1 && damageRollIndex !== -1 && damageRollGateIndex < damageRollIndex);

const hpGateIndex = combatPageSource.indexOf('const hpMutationBlock = getAttackRollOwnershipBlockReason("hp-mutation")');
const hpMutationIndex = combatPageSource.indexOf("applyHPToFighter(defender, newHP)", hpGateIndex);
assert.ok(hpGateIndex !== -1 && hpMutationIndex !== -1 && hpGateIndex < hpMutationIndex);

assert.match(combatPageSource, /source: "horror-action-consumed"/);
assert.match(combatPageSource, /round-mismatch/);
assert.match(combatPageSource, /turn-counter-mismatch/);
assert.match(combatPageSource, /turn-token-mismatch/);
assert.match(combatPageSource, /active-fighter-mismatch/);

assert.match(combatPageSource, /const diveAttackGrant = createAttackActionGrant\(updatedEnemy\.id, target\.id, "enemy-dive-attack"\)/);
assert.match(combatPageSource, /attackActionId: createAttackExecutionKey\(updatedEnemy\.id, target\.id, "enemy-dive-attack", \{/);
assert.match(combatPageSource, /attackActionGrant: diveAttackGrant/);
assert.match(combatPageSource, /attackActionId: createAttackExecutionKey\(updatedEnemyForRanged\.id, target\.id, "enemy-ranged-attack"\)/);
assert.match(combatPageSource, /attackActionId: createAttackExecutionKey\(updatedEnemyForArea\.id, lineTarget\.id, `enemy-area-attack:\$\{i\}`\)/);
assert.match(combatPageSource, /attackActionId: expectedEnemyAttackExecutionKey/);
assert.match(combatPageSource, /const inheritedEnemyAttackSource = allBonuses\?\.source \|\| null/);
assert.match(combatPageSource, /const enemyAttackSource = isCanonicalMeleeKnife[\s\S]*?inheritedEnemyAttackSource \|\| \(isRangedSelectedAttack \? "enemy-ranged-attack" : "enemy-melee-attack"\)/);
assert.match(combatPageSource, /source: enemyAttackSource/);

assert.match(combatPageSource, /attackActionId: createAttackExecutionKey\(currentFighter\.id, targetToExecute\.id, "manual-attack"\)/);
assert.match(combatPageSource, /source: "manual-attack"/);
assert.match(combatPageSource, /allowOutOfTurnAttack: true/);
assert.match(combatPageSource, /source: "attack-of-opportunity"/);

assert.match(combatPageSource, /validateCombatRollOwnership\(\{\s+actorId: liveAttacker\?\.id,\s+targetId: defenderId,\s+executionKey: validationActionId,\s+source,/);
assert.match(grappleActionsSource, /getStaleGrappleReason\("grapple-ground-attack-roll"\)/);
assert.match(grappleActionsSource, /getStaleGrappleReason\("grapple-damage-roll"\)/);
assert.match(grappleActionsSource, /getStaleGrappleReason\("grapple-hp-mutation"\)/);

console.log("final combat roll ownership gate tests passed");

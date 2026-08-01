import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /const inheritedEnemyAttackSource = allBonuses\?\.source \|\| null/);
assert.match(source, /const enemyAttackSource = isCanonicalMeleeKnife[\s\S]*?inheritedEnemyAttackSource \|\| \(isRangedSelectedAttack \? "enemy-ranged-attack" : "enemy-melee-attack"\)/);
assert.match(source, /const enemyMeleeGrant = createAttackActionGrant\(expectedEnemyAttackActorId, target\.id, enemyAttackSource\)/);
assert.match(source, /const expectedEnemyAttackExecutionKey = createAttackExecutionKey\(\s*expectedEnemyAttackActorId,\s*target\.id,\s*enemyAttackSource,\s*\{\s*grant: enemyMeleeGrant,\s*scheduledAtTurnToken: enemyMeleeGrant\.turnToken,\s*\},\s*\)/);
assert.match(source, /attackActionGrant: enemyMeleeGrant/);
assert.doesNotMatch(
  source,
  /const expectedEnemyAttackExecutionKey =\s*allBonuses\?\.attackActionId \|\|/,
  "active enemy melee branch must not reuse a possibly stale bonus attackActionId",
);

assert.match(source, /attack key context: actor=\$\{stateAttacker\?\.name \|\| attacker\?\.name \|\| "unknown"\}/);
assert.match(source, /keyRound=\$\{attackKeyMetadataForDiagnostics\?\.meleeRound \?\? "unknown"\} currentRound=/);
assert.match(source, /keyTurn=\$\{attackKeyMetadataForDiagnostics\?\.turnCounter \?\? "unknown"\} currentTurn=/);
assert.match(source, /keyToken=\$\{attackKeyMetadataForDiagnostics\?\.currentTurnToken \?\? "unknown"\} currentToken=/);

const keyCreationIndex = source.indexOf("const expectedEnemyAttackExecutionKey = createAttackExecutionKey");
const attackCallIndex = source.indexOf("const attackResult = await Promise.resolve(attack(updatedEnemy, target.id", keyCreationIndex);
const waitingIndex = source.indexOf("waiting for impact finalizer", attackCallIndex);
assert.ok(keyCreationIndex !== -1 && attackCallIndex !== -1 && keyCreationIndex < attackCallIndex);
assert.ok(attackCallIndex !== -1 && waitingIndex !== -1 && attackCallIndex < waitingIndex);

console.log("valid enemy attack key is minted fresh for the current turn");

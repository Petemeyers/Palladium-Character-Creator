import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /const enemyMeleeGrant = createAttackActionGrant\(expectedEnemyAttackActorId, target\.id, enemyAttackSource\)/);
assert.match(source, /createAttackExecutionKey\(\s*expectedEnemyAttackActorId,\s*target\.id,\s*enemyAttackSource,\s*\{\s*grant: enemyMeleeGrant,\s*scheduledAtTurnToken: enemyMeleeGrant\.turnToken,/);
assert.match(source, /const playerAttackGrant =/);
assert.match(source, /createAttackExecutionKey\(liveAttacker\.id, attackArgs\[0\], existingAttackSource, \{/);
assert.match(source, /attack key registry created: actor=/);
assert.match(source, /attack key registry validated: actor=/);

console.log("valid current turn attack paths create attack keys from current grants");

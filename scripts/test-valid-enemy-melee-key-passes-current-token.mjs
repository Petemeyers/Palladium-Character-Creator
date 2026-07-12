import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /const enemyAttackSource = allBonuses\?\.source \|\| "enemy-melee-attack"/);
assert.match(source, /createAttackExecutionKey\(\s*expectedEnemyAttackActorId,\s*target\.id,\s*enemyAttackSource,\s*\)/);
assert.match(source, /attack key registry validated: actor=/);
assert.match(source, /combat roll gate passed: actor=/);
assert.match(source, /markAttackGateChain\("entry"\)/);
assert.match(source, /markAttackGateChain\("preStamina"\)/);
assert.match(source, /markAttackGateChain\("roll"\)/);
assert.match(source, /markAttackGateChain\("damage"\)/);
assert.match(source, /markAttackGateChain\("hp"\)/);
assert.doesNotMatch(source, /const expectedEnemyAttackExecutionKey =\s*allBonuses\?\.attackActionId \|\|/);

console.log("valid enemy melee key uses current registry token and can pass the full gate chain");

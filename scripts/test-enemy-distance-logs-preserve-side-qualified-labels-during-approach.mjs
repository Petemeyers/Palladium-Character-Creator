import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");

assert.match(source, /const enemyLogLabel = formatCombatActorLabel\(enemy/);
assert.match(source, /const targetLogLabel = formatCombatActorLabel\(target/);
assert.match(source, /\$\{enemyLogLabel\} is \$\{Math\.round\(currentDistance\)\}ft from \$\{/);
assert.match(source, /const movementEnemyLabel = formatCombatActorLabel\(enemy/);
assert.match(source, /const movementTargetLabel = formatCombatActorLabel\(target/);
assert.doesNotMatch(source, /\$\{enemy\.name\} is \$\{Math\.round\(currentDistance\)\}ft from \$\{/);

console.log("enemy approach distance label tests passed");

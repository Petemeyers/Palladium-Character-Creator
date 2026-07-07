import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const enemyAi = readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");

assert.match(combatPage, /const enemyLogLabel = formatCombatActorLabel\(enemy/);
assert.match(combatPage, /const targetLogLabel = formatCombatActorLabel\(target/);
assert.match(combatPage, /\$\{enemyLogLabel\} is \$\{Math\.round\(currentDistance\)\}ft from \$\{targetLogLabel\}/);
assert.match(combatPage, /target filter: \$\{formatCombatActorLabel\(liveEnemy/);

assert.match(enemyAi, /const enemyLogLabel = formatCombatActorLabel\(enemy/);
assert.match(enemyAi, /const targetLogLabel = formatCombatActorLabel\(target/);
assert.match(enemyAi, /\$\{enemyLogLabel\} is \$\{Math\.round\(currentDistance\)\}ft from \$\{/);
assert.match(enemyAi, /analyzes movement toward \$\{movementTargetLabel\}/);
assert.doesNotMatch(enemyAi, /\$\{enemy\.name\} is \$\{Math\.round\(currentDistance\)\}ft from/);

console.log("enemy distance-log side-qualified label tests passed");

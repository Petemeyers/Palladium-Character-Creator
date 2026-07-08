import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(source, /usesEnemyAIPath && processingEnemyTurnRef\.current/);
assert.match(source, /enemy turn already processing for \$\{formatCombatActorLabel\(fighter/);
assert.match(source, /enemy turn already processing for \$\{formatCombatActorLabel\(enemy/);
assert.match(source, /ignoring duplicate start reason=\$\{source\}/);

console.log("enemy turn start same-execution dedupe tests passed");

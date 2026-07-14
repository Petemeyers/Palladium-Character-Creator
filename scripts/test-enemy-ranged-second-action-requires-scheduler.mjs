import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const enemyTurnAI = readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");

assert.match(combatPage, /ALWAYS end turn after each action/);
assert.match(combatPage, /If this fighter still has actions, they'll get another turn after others act/);
assert.match(combatPage, /scheduleNextTurnStart\(fightersNow\[nextIndex\], nextIndex, "endTurn-direct"\)/);

const rangedBranchStart = enemyTurnAI.indexOf('case "use_ranged"');
const rangedBranchEnd = enemyTurnAI.indexOf("// Fall back to movement if no ranged attack", rangedBranchStart);
assert.ok(rangedBranchStart > 0 && rangedBranchEnd > rangedBranchStart, "enemy ranged branch should be locatable");
const rangedBranch = enemyTurnAI.slice(rangedBranchStart, rangedBranchEnd);

assert.match(rangedBranch, /const rangedExecutionKey = makeEnemyAttackExecutionKey/);
assert.match(rangedBranch, /setTimeout\(\(\) => \{/);
assert.match(rangedBranch, /validateEnemyAttackCallbackEntry\(\{/);
assert.match(rangedBranch, /attack\(\s*\{ \.\.\.enemy, selectedAttack: rangedAttack \}/);
assert.doesNotMatch(
  rangedBranch,
  /runEnemyTurnAI|startEnemyTurn|scheduleNextTurnStart/,
  "ranged callback must not directly schedule the archer's second action",
);

console.log("enemy ranged second action must re-enter through scheduler");

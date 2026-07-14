import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const enemyTurnAI = readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");

assert.match(enemyTurnAI, /callbackSource: "enemy-turn-ai-ranged-callback"/);
assert.match(enemyTurnAI, /isDelayedCallback: true/);
assert.match(enemyTurnAI, /scheduledAtTurnToken: grant\?\.turnToken/);
assert.match(combatPage, /delayed-callback-scheduled-token-stale/);
assert.match(combatPage, /execution-key-round-stale/);
assert.match(combatPage, /clearAttackExecutionState\(`new-melee-round:\$\{nextRoundNumber\}`\)/);
assert.match(combatPage, /attackActionGrantRegistryRef\.current\.clear\(\)/);

const keyIndex = enemyTurnAI.indexOf("const rangedExecutionKey = makeEnemyAttackExecutionKey");
const timerIndex = enemyTurnAI.indexOf("setTimeout(() =>", keyIndex);
const validationIndex = enemyTurnAI.indexOf("validateEnemyAttackCallbackEntry", timerIndex);
const attackIndex = enemyTurnAI.indexOf("attack(", validationIndex);
assert.ok(keyIndex !== -1 && timerIndex !== -1 && keyIndex < timerIndex, "ranged key should be captured before timer execution");
assert.ok(validationIndex !== -1 && attackIndex !== -1 && validationIndex < attackIndex, "ranged callback validates before attack");

console.log("delayed ranged callbacks cannot cross round boundaries");

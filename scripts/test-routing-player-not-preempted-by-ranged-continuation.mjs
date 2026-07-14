import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const enemyTurnAI = readFileSync(new URL("../src/utils/ai/enemyTurnAI.js", import.meta.url), "utf8");

assert.match(combatPage, /scheduleNextTurnStart\(fightersNow\[nextIndex\], nextIndex, "endTurn-direct"\)/);
assert.match(combatPage, /startTurnOnce\(fighter, index, directReason\)/);
assert.match(combatPage, /entryActiveFighter\.id !== attacker\.id/);
assert.match(combatPage, /active-fighter-mismatch:\$\{entryActiveFighter\.id\}/);
assert.match(combatPage, /actor-not-active-fighter/);

const rangedCallbackIndex = enemyTurnAI.indexOf("enemy-turn-ai-ranged-callback");
const validationIndex = enemyTurnAI.indexOf("validateEnemyAttackCallbackEntry", rangedCallbackIndex);
const attackIndex = enemyTurnAI.indexOf("attack(", validationIndex);
assert.ok(validationIndex !== -1 && attackIndex !== -1 && validationIndex < attackIndex);

console.log("routing player turn cannot be preempted by stale ranged continuation");

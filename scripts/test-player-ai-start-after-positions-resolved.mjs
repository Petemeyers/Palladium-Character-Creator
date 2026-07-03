import assert from "node:assert/strict";
import fs from "node:fs";

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const positionsResolved = combatPage.indexOf("handlePlayerAITurn positions resolved fighter=");
const continuationDefinition = combatPage.indexOf("const claimPlayerAIContinuation =", positionsResolved);
const contextBuild = combatPage.indexOf("handlePlayerAITurn before build context fighter=", positionsResolved);
const contextLiteral = combatPage.indexOf("context = {", contextBuild);
const beforeExecutor = combatPage.indexOf("handlePlayerAITurn before runPlayerTurnAI fighter=", contextLiteral);

assert.ok(positionsResolved >= 0);
assert.ok(continuationDefinition > positionsResolved && continuationDefinition < contextLiteral,
  "continuation helpers are defined in player scope before the context references them");
assert.ok(contextBuild > positionsResolved && contextBuild < contextLiteral);
assert.ok(beforeExecutor > contextLiteral);
assert.match(combatPage, /handlePlayerAITurn context build failed fighter=/,
  "context construction failures are visible and safely finalized");

const playerAi = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
assert.match(playerAi, /runPlayerTurnAI entered fighter=/);
assert.match(playerAi, /runPlayerTurnAI before weapon selection fighter=/);
assert.match(playerAi, /runPlayerTurnAI after weapon selection fighter=/);

console.log("player AI post-position startup tests passed");

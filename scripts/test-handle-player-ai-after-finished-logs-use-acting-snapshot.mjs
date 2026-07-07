import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(source, /handlePlayerAITurn before runPlayerTurnAI fighter=\$\{playerAiActingActorLabel\}/);
assert.match(source, /handlePlayerAITurn after runPlayerTurnAI fighter=\$\{playerAiActingActorLabel\}/);
assert.match(source, /handlePlayerAITurn finished \$\{playerAiActingActorLabel\} result=/);
assert.doesNotMatch(source, /handlePlayerAITurn after runPlayerTurnAI fighter=\$\{latestPlayer\.name\}/);

console.log("Player-AI acting snapshot log tests passed");

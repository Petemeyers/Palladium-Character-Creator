import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const combatPageSource = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
const playerAiSource = readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");

assert.match(combatPageSource, /createAttackActionGrant,\s+createAttackExecutionKey,\s+clearPlayerAIContinuationAttack/);
assert.match(playerAiSource, /createAttackActionGrant,/);
assert.match(playerAiSource, /createAttackExecutionKey,/);
assert.match(playerAiSource, /createAttackActionGrant\(player\.id, liveTarget\.id, "player-ai-flanking-continuation"\)/);
assert.match(playerAiSource, /createAttackExecutionKey\(player\.id, liveTarget\.id, "player-ai-flanking-continuation", \{/);
assert.match(playerAiSource, /callbackSource: "player-ai-flanking-continuation"/);
assert.match(playerAiSource, /attackActionGrant: flankingAttackGrant/);
assert.doesNotMatch(playerAiSource, /\[\s*"player-ai-flank"[\s\S]{0,160}\]\.join\(":"\)/);
assert.doesNotMatch(playerAiSource, /"player-ai-flank",\s*combatSession/);

console.log("player AI flanking continuation uses registry-created attack keys");

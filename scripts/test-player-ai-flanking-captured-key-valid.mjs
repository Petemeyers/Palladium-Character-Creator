import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const playerAi = readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(combatPage, /createAttackActionGrant,\s+createAttackExecutionKey,\s+clearPlayerAIContinuationAttack/);
assert.match(playerAi, /const flankingAttackGrant =/);
assert.match(playerAi, /createAttackActionGrant\(player\.id, liveTarget\.id, "player-ai-flanking-continuation"\)/);
assert.match(playerAi, /createAttackExecutionKey\(player\.id, liveTarget\.id, "player-ai-flanking-continuation", \{/);
assert.match(playerAi, /callbackSource: "player-ai-flanking-continuation"/);
assert.match(playerAi, /isDelayedCallback: true/);
assert.match(playerAi, /attackActionGrant: flankingAttackGrant/);
assert.doesNotMatch(playerAi, /\[\s*"player-ai-flank"/);

console.log("player AI flanking continuation captures a grant/key before delayed attack execution");

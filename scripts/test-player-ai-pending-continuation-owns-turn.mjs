import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createPlayerAiContinuationOwnership,
  doesPlayerAiContinuationOwnTurn,
} from "../src/utils/playerAiContinuation.js";

const ownership = createPlayerAiContinuationOwnership({
  fighterId: "knight-3",
  turnIndex: 2,
  turnCounter: 17,
  turnToken: "turn-17-knight-3",
  source: "player-ai-flanking-continuation",
  claimedAt: 1000,
  timeoutMs: 6500,
});

assert.equal(doesPlayerAiContinuationOwnTurn(ownership, {
  fighterId: "knight-3",
  turnIndex: 2,
  turnCounter: 17,
  turnToken: "turn-17-knight-3",
}), true);
assert.equal(doesPlayerAiContinuationOwnTurn(ownership, {
  fighterId: "knight-3",
  turnIndex: 2,
  turnCounter: 18,
  turnToken: "turn-18-knight-3",
}), false, "a later turn cannot inherit continuation ownership");
assert.match(ownership.continuationKey, /knight-3.*player-ai-flanking-continuation/);

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /player AI start deferred: pending continuation owns turn fighter=/);
assert.match(combatPage, /if \(processingPlayerAIRef\.current\) return;[\s\S]{0,120}startTurnOnce\(nowFighter, nowIndex, "player-turn-start-busy-retry"\)/,
  "busy retry cannot restart an actor that is still processing");

const playerAi = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
assert.match(playerAi, /claimPlayerAIContinuation\?\.\(\{[\s\S]{0,180}source: "player-ai-flanking-continuation"/);
assert.match(playerAi, /claimPlayerAIContinuation\?\.\(\{[\s\S]{0,180}source: "player-ai-approach-continuation"/);

console.log("player AI pending-continuation ownership tests passed");

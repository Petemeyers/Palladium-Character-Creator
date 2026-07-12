import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createTurnFinalizerSnapshot,
  shouldAcceptTurnFinalizer,
} from "../src/utils/turnFinalizerOwnership.js";

const expected = createTurnFinalizerSnapshot({
  combatSession: 1,
  generation: 8,
  fighterId: "knight-1",
  turnIndex: 2,
  meleeRound: 3,
  turnCounter: 22,
  turnToken: "knight-1-token",
});
const advanced = createTurnFinalizerSnapshot({
  combatSession: 1,
  generation: 9,
  fighterId: "knight-3",
  turnIndex: 3,
  meleeRound: 3,
  turnCounter: 23,
  turnToken: "knight-3-token",
});
assert.equal(shouldAcceptTurnFinalizer(expected, advanced), false);
assert.equal(shouldAcceptTurnFinalizer(advanced, advanced), true);

const combatPage = fs.readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");
assert.match(combatPage, /const schedulePlayerAIEndTurn[\s\S]*if \(!canFinalizePlayerAITurn\(source, \{ logAccepted: true, consume: true \}\)\)[\s\S]*return false;[\s\S]*scheduleEndTurn\(delayOverride, source, \{[\s\S]*deferTurnStart: true,[\s\S]*actingActorSnapshot: playerAiActingActorSnapshot,[\s\S]*actingActorLabel: playerAiActingActorLabel,[\s\S]*\}\)/,
  "player AI wrapper rejects stale ownership before shared scheduling");
assert.match(combatPage, /stale no-actions finalizer ignored fighter=/);
assert.match(combatPage, /turn finalizer accepted fighter=/);
assert.match(combatPage, /duplicate turn finalizer ignored fighter=/);
assert.match(combatPage, /player AI start blocked: reason=turn-key-mismatch/,
  "turn-key mismatch guard remains intact");

const playerAi = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
const noActionsGuard = playerAi.indexOf('!canFinalizeTurn("player-ai-no-actions")');
const noActionsLog = playerAi.indexOf("has no actions remaining - passing to next fighter", noActionsGuard);
assert.ok(noActionsGuard >= 0 && noActionsLog > noActionsGuard,
  "stale ownership is checked before the no-actions log");

console.log("player AI stale-finalizer tests passed");

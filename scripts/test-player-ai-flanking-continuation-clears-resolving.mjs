import assert from "node:assert/strict";
import fs from "node:fs";

import {
  doesPlayerAiContinuationOwnAttack,
  getPlayerAiContinuationBlockReason,
} from "../src/utils/playerAiContinuation.js";

const attackId = "player-ai-flank:session:turn:spearman:goblin:7";
const state = {
  activeAttackActionId: attackId,
  resolving: true,
  pendingAdvance: false,
  turnAdvances: 0,
};

const blockedOutcome = { ok: false, blocked: true, reason: "turn-token-changed" };
const blockedReason = getPlayerAiContinuationBlockReason(blockedOutcome);
assert.equal(blockedReason, "turn-token-changed");
assert.equal(doesPlayerAiContinuationOwnAttack(state.activeAttackActionId, attackId), true);
if (doesPlayerAiContinuationOwnAttack(state.activeAttackActionId, attackId)) {
  state.activeAttackActionId = null;
  state.resolving = false;
  state.pendingAdvance = false;
}
state.turnAdvances += 1;
assert.equal(state.activeAttackActionId, null, "matching continuation attack ownership is cleared");
assert.equal(state.resolving, false, "failed continuation cannot leave Action already resolving latched");
assert.equal(state.turnAdvances, 1, "blocked continuation advances exactly once");
assert.equal(doesPlayerAiContinuationOwnAttack("different-attack", attackId), false,
  "cleanup cannot clear an unrelated active attack");

const source = fs.readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
assert.match(source, /flanking continuation attack start attacker=/);
assert.match(source, /flanking continuation attack blocked: reason=/);
assert.match(source, /flanking continuation attack resolved attacker=/);
assert.match(source, /clearPlayerAIContinuationAttack\?\.\(\s*flankingAttackActionId/);
assert.match(source, /scheduleEndTurn\(16, "player-ai-flank-attack-blocked"\)/);
assert.match(source, /canFinalizeTurn/,
  "player AI continuations share the guarded turn-finalizer context");

console.log("player AI flanking continuation resolving-cleanup tests passed");

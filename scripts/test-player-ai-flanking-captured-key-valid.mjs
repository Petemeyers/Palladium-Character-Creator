import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateCapturedFlankingAttackIdentity } from "../src/utils/playerAiContinuation.js";

const playerAi = readFileSync(new URL("../src/utils/ai/playerTurnAI.js", import.meta.url), "utf8");
const combatPage = readFileSync(new URL("../src/pages/CombatPage.jsx", import.meta.url), "utf8");

assert.match(combatPage, /createAttackActionGrant,\s+createAttackExecutionKey,\s+clearPlayerAIContinuationAttack/);
assert.match(playerAi, /createAttackActionGrant\(livePlayer\.id, liveTarget\.id, "player-ai-flanking-continuation"\)/);
assert.match(playerAi, /createAttackExecutionKey\(livePlayer\.id, liveTarget\.id, "player-ai-flanking-continuation", \{/);
assert.match(playerAi, /callbackSource: "player-ai-flanking-continuation"/);
assert.match(playerAi, /isDelayedCallback: true/);
assert.match(playerAi, /attackActionGrant: flankingAttackGrant/);
assert.match(playerAi, /flanking continuation rejected: canonical action grant unavailable/);
assert.match(playerAi, /flanking continuation rejected: captured execution key unavailable/);
assert.doesNotMatch(playerAi, /`player-ai-flank-\$\{Date\.now\(\)\}/);
assert.doesNotMatch(playerAi, /scheduledAtTurnToken:[^\n]*"no-turn-token"/);

const captured = Object.freeze({
  executionKey: "attack:1",
  grantId: "grant:1",
  generation: "generation:1",
  combatSession: "session:1",
  initiativeTurnId: "turn:1",
  actorId: "party-guard:1",
  targetId: "enemy-guard:1",
  actionSequence: 2,
});
assert.equal(validateCapturedFlankingAttackIdentity(captured, captured).accepted, true);
assert.equal(
  validateCapturedFlankingAttackIdentity(captured, { ...captured, targetId: "enemy-guard:2" }).reason,
  "targetId-mismatch",
);
assert.equal(
  validateCapturedFlankingAttackIdentity(captured, { ...captured, actorId: "party-guard:2" }).reason,
  "actorId-mismatch",
);
assert.equal(
  validateCapturedFlankingAttackIdentity(captured, { ...captured, generation: "generation:2" }).reason,
  "generation-mismatch",
);
assert.equal(
  validateCapturedFlankingAttackIdentity({ ...captured, executionKey: null }, captured).reason,
  "incomplete-captured-identity",
);

console.log("player AI flanking continuation captures a grant/key before delayed attack execution");

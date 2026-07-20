import assert from "node:assert/strict";

import { hasPlayerAiActionProgress } from "../src/utils/ai/playerGrappleDispatcher.js";

const baseline = {
  remainingActions: 2,
  actionToken: null,
  pendingContinuation: null,
  authoritativeExecution: null,
  activeActorId: "player-knight",
};

assert.equal(hasPlayerAiActionProgress(baseline, { ...baseline }, {}), false);
assert.equal(hasPlayerAiActionProgress(baseline, { ...baseline, remainingActions: 1 }, {}), true);
assert.equal(hasPlayerAiActionProgress(baseline, { ...baseline, actionToken: "initiative:1" }, {}), true);
assert.equal(hasPlayerAiActionProgress(baseline, { ...baseline, authoritativeExecution: "grapple-action:1" }, {}), true);
assert.equal(hasPlayerAiActionProgress(baseline, { ...baseline, pendingContinuation: "continuation:2" }, {}), true);
assert.equal(hasPlayerAiActionProgress(baseline, { ...baseline, activeActorId: "enemy-knight" }, {}), true);
assert.equal(hasPlayerAiActionProgress(baseline, { ...baseline }, { turnHandoffStarted: true }), true);
assert.equal(hasPlayerAiActionProgress(baseline, { ...baseline }, { combatEnded: true }), true);

console.log("✅ Phase 3B1 player AI zero-progress invariant runtime tests passed");
